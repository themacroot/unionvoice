import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_PAGES = 6;
const MAX_HTML_BYTES = 1_000_000;
const PAGE_TIMEOUT_MS = 8_000;
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
const RELEVANT_LINK = /about|leadership|office.?bear|team|committee|executive|contact|people|directory/i;
const RELEVANT_TEXT = /president|chairperson|chairman|secretary|treasurer|office.?bear|leadership|executive|committee|contact|team/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSafeUrl(value: string, expectedOrigin?: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
    if (expectedOrigin && url.origin !== expectedOrigin) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function parsePage(html: string, pageUrl: URL) {
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, ' ').trim() || pageUrl.hostname);
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const links = anchors.flatMap(([, attributes, rawLabel]) => {
    const href = attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    const label = decodeHtml(rawLabel.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!href || !RELEVANT_LINK.test(`${href} ${label}`)) return [];
    let target: URL | null = null;
    try { target = isSafeUrl(new URL(href, pageUrl).toString(), pageUrl.origin); } catch { return []; }
    return target && target.pathname !== pageUrl.pathname ? [target.toString()] : [];
  });
  const text = decodeHtml(html
    .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
  const snippets = text.split(/(?<=[.!?])\s+/).filter((sentence) => RELEVANT_TEXT.test(sentence));
  const excerpt = (snippets.length ? snippets.join(' ') : text).slice(0, 1400).trim();
  return { page_title: title.slice(0, 240), excerpt, links };
}

async function fetchHtml(url: URL, origin: string): Promise<{ url: URL; html: string }> {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isSafeUrl(currentUrl.toString(), origin)) throw new Error('The website redirected outside its approved HTTPS domain.');
    const response = await fetch(currentUrl, {
      headers: { 'User-Agent': 'UnionVoiceAssociationDirectory/1.0 (+public-page review)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === 3) throw new Error('The public page redirected too many times.');
      await response.body?.cancel();
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) throw new Error(`The public website returned HTTP ${response.status}.`);
    if (!(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) throw new Error('The website did not return an HTML page.');
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error('The page is larger than the allowed fetch size.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Could not read the public page.');
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error('The page is larger than the allowed fetch size.');
      }
      chunks.push(value);
    }
    const allBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { allBytes.set(chunk, offset); offset += chunk.byteLength; }
    return { url: currentUrl, html: new TextDecoder().decode(allBytes) };
  }
  throw new Error('Could not fetch the public page.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in as an administrator first.' }, 401);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !anonKey || !serviceRoleKey) return json({ error: 'The Edge Function is missing Supabase configuration.' }, 500);

  const userClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const adminClient = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } });
  const accessToken = authorization.slice('Bearer '.length);
  const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !user) return json({ error: 'Your session is invalid or expired.' }, 401);
  const { data: profile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return json({ error: 'Only portal administrators can fetch association websites.' }, 403);

  let associationId: string;
  try {
    associationId = (await request.json()).association_id;
    if (typeof associationId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(associationId)) return json({ error: 'Provide a valid association ID.' }, 400);
  } catch {
    return json({ error: 'Request must include an association ID.' }, 400);
  }

  const { data: association, error: associationError } = await adminClient
    .from('associations').select('id, name, acronym, homepage_url').eq('id', associationId).eq('status', 'approved').maybeSingle();
  if (associationError || !association) return json({ error: 'Approved association not found.' }, 404);
  const { data: latestFinding } = await adminClient.from('association_site_findings')
    .select('fetched_at').eq('association_id', association.id).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
  if (latestFinding && Date.now() - new Date(latestFinding.fetched_at).getTime() < REFRESH_COOLDOWN_MS) {
    return json({ error: 'This association was fetched recently. Please wait 10 minutes before refreshing again.' }, 429);
  }
  const homepage = isSafeUrl(association.homepage_url || '');
  if (!homepage) return json({ error: 'Add a valid HTTPS homepage to this association first.' }, 400);

  try {
    const firstPage = await fetchHtml(homepage, homepage.origin);
    const firstParsed = parsePage(firstPage.html, firstPage.url);
    const pageUrls = [...new Set([firstPage.url.toString(), ...firstParsed.links])].slice(0, MAX_PAGES);
    const pages = await Promise.all(pageUrls.slice(1).map(async (url) => {
      try { return await fetchHtml(new URL(url), homepage.origin); } catch { return null; }
    }));
    const fetchedPages = [firstPage, ...pages.filter((page): page is { url: URL; html: string } => page !== null)];
    const findings = fetchedPages.map((page) => {
      const parsed = parsePage(page.html, page.url);
      return {
        association_id: association.id,
        source_url: page.url.toString(),
        page_title: parsed.page_title,
        excerpt: parsed.excerpt || 'No readable page text was found.',
        review_status: 'pending',
      };
    });
    const { data: existingFindings } = await adminClient.from('association_site_findings')
      .select('source_url, excerpt, review_status').eq('association_id', association.id);
    const existingByUrl = new Map((existingFindings || []).map((finding) => [finding.source_url, finding]));
    const findingsWithReviewState = findings.map((finding) => {
      const existing = existingByUrl.get(finding.source_url);
      return {
        ...finding,
        review_status: existing?.excerpt === finding.excerpt ? existing.review_status : 'pending',
        fetched_at: new Date().toISOString(),
      };
    });
    const { data: inserted, error: insertError } = await adminClient
      .from('association_site_findings')
      .upsert(findingsWithReviewState, { onConflict: 'association_id,source_url', ignoreDuplicates: false })
      .select('id, association_id, source_url, page_title, excerpt, review_status, fetched_at');
    if (insertError) return json({ error: 'Pages were fetched, but findings could not be saved. Apply the association website migration first.' }, 500);
    return json({ association: association.acronym, findings: inserted || [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not fetch the public association website.' }, 422);
  }
});
