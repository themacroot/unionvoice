import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowDown, ArrowUpRight, BadgeCheck, Building2, Check, ChevronDown, CircleHelp, ExternalLink, EyeOff, Filter, KeyRound, LoaderCircle, LogIn, Mail, MessageCircle, Network, Plus, Search, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import './style.css';

const cloudflareAnalyticsToken = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
if (import.meta.env.PROD && cloudflareAnalyticsToken) {
  const analyticsScript = document.createElement('script');
  analyticsScript.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  analyticsScript.type = 'module';
  analyticsScript.defer = true;
  analyticsScript.setAttribute('data-cf-beacon', JSON.stringify({ token: cloudflareAnalyticsToken }));
  document.head.append(analyticsScript);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const demoApex = { id: 'demo-aiboc', name: 'All India Bank Officers Confederation', acronym: 'AIBOC', description: 'Apex body for affiliated bank officers associations', association_type: 'apex', parent_id: null, homepage_url: null, status: 'approved' };
const demoAssociation = { id: 'demo-siboa', name: "SIB's Officers Association", acronym: 'SIBOA', description: 'South Indian Bank Officers Association', association_type: 'bank', parent_id: demoApex.id, homepage_url: null, status: 'approved' };
const demoQuestions = [
  { id: 'demo-1', title: 'Clarification on the revised transfer policy', body: 'Could the association clarify how the new transfer guidelines apply to officers who have completed a tenure in a rural branch?', department: 'Operations', cluster: 'Chennai', region: 'South', is_anonymous: false, created_at: '2026-09-25T10:10:00Z', associations: demoAssociation, answers: [{ id: 'a1', body: 'We have raised this with HR and requested the circular in writing. We will share an update as soon as we receive it.', created_at: '2026-09-26T08:30:00Z' }], comments: [] },
  { id: 'demo-2', title: 'Medical reimbursement claim timeline', body: 'Has there been any update on the expected processing time for pending medical reimbursement claims?', department: 'Credit', cluster: 'Coimbatore', region: 'South', is_anonymous: true, created_at: '2026-09-24T13:00:00Z', associations: demoAssociation, answers: [], comments: [] },
  { id: 'demo-3', title: 'Request for guidance on the new performance review format', body: 'The new format has a few sections that are not clear to our team. Can someone explain the process for seeking a review?', department: 'Retail Banking', cluster: 'Kochi', region: 'South', is_anonymous: false, created_at: '2026-09-22T07:45:00Z', associations: demoAssociation, answers: [], comments: [] },
];
const demoAchievements = [
  { id: 'demo-a1', title: 'Secured revised transfer guidelines for rural postings', body: 'Following sustained representation, the association secured written clarification protecting officers who complete a rural tenure from repeat postings.', achieved_on: '2026-09-10', author_name: 'SIBOA representative', created_at: '2026-09-15T09:00:00Z', associations: demoAssociation, comments: [] },
];

function timeAgo(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function normalizeQuestionText(value) {
  return (value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function questionTitleSimilarity(first, second) {
  const firstWords = new Set(normalizeQuestionText(first).split(' ').filter(Boolean));
  const secondWords = new Set(normalizeQuestionText(second).split(' ').filter(Boolean));
  if (!firstWords.size || !secondWords.size) return 0;
  const shared = [...firstWords].filter((word) => secondWords.has(word)).length;
  return shared / new Set([...firstWords, ...secondWords]).size;
}

function findPossibleDuplicates(title, associationId, questions) {
  const normalizedTitle = normalizeQuestionText(title);
  if (!normalizedTitle || !associationId) return [];
  return questions
    .filter((question) => question.association_id === associationId)
    .map((question) => ({ question, similarity: questionTitleSimilarity(title, question.title) }))
    .filter(({ question, similarity }) => normalizeQuestionText(question.title) === normalizedTitle || (normalizedTitle.length >= 18 && similarity >= 0.72))
    .sort((first, second) => second.similarity - first.similarity)
    .slice(0, 3);
}

function safeHomepageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function AssociationRequestForm({ associations, admin, onSubmit }) {
  return <form className="association-form directory-form" onSubmit={onSubmit}>
    <label className="field-label">Association name<input name="name" required placeholder="Full name" /></label>
    <label className="field-label">Short name<input name="acronym" required maxLength="12" placeholder="e.g. SIBOA" /></label>
    <label className="field-label">Organization level<select name="association_type" defaultValue="bank"><option value="apex">Apex body</option><option value="bank">Bank association</option><option value="other">Other</option></select></label>
    <label className="field-label">Reports to<select name="parent_id" defaultValue=""><option value="">No parent (top level)</option>{associations.map((association) => <option key={association.id} value={association.id}>{association.acronym} · {association.name}</option>)}</select></label>
    <label className="field-label">Association homepage<input name="homepage_url" type="url" placeholder="https://..." /></label>
    <label className="field-label">What does it represent?<textarea name="description" rows="3" placeholder="Brief description" /></label>
    {!admin && <label className="field-label">Contact email<input name="contact_email" type="email" required placeholder="name@association.org" /></label>}
    <button className="button button-dark" type="submit">{admin ? 'Add association' : 'Send for approval'} <ArrowUpRight size={15} /></button>
  </form>;
}

function AssociationTreeNode({ association, childrenByParent }) {
  const children = childrenByParent.get(association.id) || [];
  const homepageUrl = safeHomepageUrl(association.homepage_url);
  return <li>
    <div className="tree-node"><span className={`tree-mark ${association.association_type || 'bank'}`}><Building2 size={17} /></span><div className="tree-copy"><strong>{association.acronym}</strong><span>{association.name}</span></div>{homepageUrl && <a className="icon-link" href={homepageUrl} target="_blank" rel="noreferrer" aria-label={`${association.acronym} homepage`}><ExternalLink size={15} /></a>}</div>
    {children.length > 0 && <ul>{children.map((child) => <AssociationTreeNode key={child.id} association={child} childrenByParent={childrenByParent} />)}</ul>}
  </li>;
}

function AssociationDirectoryCard({ association, associations, findings, admin, editingHomepage, homepageDraft, onHomepageDraftChange, onEditHomepage, onSaveHomepage, isRefreshing, reviewingFindingId, onRefresh, onReview }) {
  const parent = associations.find((item) => item.id === association.parent_id);
  const homepageUrl = safeHomepageUrl(association.homepage_url);
  const sourceUrl = safeHomepageUrl(association.source_url);
  return <article className="directory-card" key={association.id}>
    <div className="directory-card-top"><span className="association-badge"><Building2 size={17} /></span><span className="level-label">{association.association_type === 'apex' || association.acronym === 'UFBU' ? 'NATIONAL BODY' : association.association_type === 'bank' ? 'BANK ASSOCIATION' : 'ASSOCIATION'}</span></div>
    <h2>{association.name}</h2><p className="directory-acronym">{association.acronym}</p><p className="directory-description">{association.description || 'Association information has not been added yet.'}</p>
    <div className="directory-parent">{association.parent_id ? `Reports to ${parent?.acronym || 'parent association'}` : 'Top-level organization'}</div>
    {homepageUrl ? <a className="text-action directory-link" href={homepageUrl} target="_blank" rel="noreferrer">Visit homepage <ExternalLink size={14} /></a> : <span className="no-homepage">Homepage not provided</span>}
    {sourceUrl && <a className="text-action directory-link" href={sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a>}
    {admin && !editingHomepage && <button className="text-action edit-homepage" onClick={() => onEditHomepage(association)}><Plus size={13} />{homepageUrl ? 'Change homepage' : 'Add homepage'}</button>}
    {admin && editingHomepage && <form className="homepage-edit-form" onSubmit={(event) => onSaveHomepage(event, association)}><label className="field-label">Official HTTPS homepage<input name="homepage_url" type="url" required value={homepageDraft} onChange={(event) => onHomepageDraftChange(event.target.value)} placeholder="https://association.org" /></label><div><button className="button button-dark" type="submit">Save homepage</button><button className="text-action" type="button" onClick={() => onEditHomepage(null)}>Cancel</button></div></form>}
    <AssociationSiteFindings association={association} findings={findings} admin={admin} isRefreshing={isRefreshing} reviewingFindingId={reviewingFindingId} onRefresh={onRefresh} onReview={onReview} />
  </article>;
}

function AssociationSiteFindings({ association, findings, admin, isRefreshing, reviewingFindingId, onRefresh, onReview }) {
  const associationFindings = findings.filter((finding) => finding.association_id === association.id);
  return <section className="site-findings">
    <div className="site-findings-heading"><strong>Website information</strong><span>{associationFindings.filter((finding) => finding.review_status === 'approved').length} verified</span></div>
    <p className="site-findings-note">Public website excerpts. Names and roles need human verification.</p>
    {associationFindings.map((finding) => <article className="site-finding" key={finding.id}>
      <div className="site-finding-title"><a href={safeHomepageUrl(finding.source_url) || '#'} target="_blank" rel="noreferrer">{finding.page_title || finding.source_url}<ExternalLink size={12} /></a><span className={`finding-status ${finding.review_status}`}>{finding.review_status === 'approved' ? 'Verified' : finding.review_status === 'pending' ? 'Review' : 'Hidden'}</span></div>
      <p>{finding.excerpt}</p>
      <small>Fetched {new Date(finding.fetched_at).toLocaleDateString()}</small>
      {admin && finding.review_status === 'pending' && <div className="finding-actions"><button className="text-action" onClick={() => onReview(finding, 'approved')} disabled={Boolean(reviewingFindingId)}><Check size={13} /> {reviewingFindingId === finding.id ? 'Saving...' : 'Approve'}</button><button className="text-action" onClick={() => onReview(finding, 'hidden')} disabled={Boolean(reviewingFindingId)}><X size={13} /> Hide</button></div>}
    </article>)}
    {admin && <button className="text-action scan-site-button" onClick={() => onRefresh(association)} disabled={isRefreshing || !association.homepage_url}><ExternalLink size={13} />{isRefreshing ? 'Fetching public pages...' : 'Fetch website information'}</button>}
    {!associationFindings.length && <p className="site-findings-empty">{association.homepage_url ? 'No reviewed website information yet.' : 'Add the official homepage to enable fetching.'}</p>}
  </section>;
}

function CommentThread({ comments, onSubmit, busy }) {
  const list = comments || [];
  return <div className="comment-thread">
    <div className="comment-list">
      {list.length === 0 && <p className="comment-empty">No comments yet.</p>}
      {list.map((comment) => <div className="comment-item" key={comment.id}>
        <div className="comment-meta"><strong>{comment.is_anonymous ? 'Anonymous' : (comment.author_name || 'Colleague')}</strong><span>{timeAgo(comment.created_at)}</span></div>
        <p>{comment.body}</p>
      </div>)}
    </div>
    <form className="comment-form" onSubmit={onSubmit}>
      <textarea name="comment" required minLength="2" maxLength="4000" rows="2" placeholder="Add a comment..." />
      <div className="comment-form-footer">
        <label className="comment-anonymous"><input type="checkbox" name="anonymous" /> Post anonymously</label>
        <button className="text-action" type="submit" disabled={busy}><Send size={13} /> {busy ? 'Posting...' : 'Comment'}</button>
      </div>
    </form>
  </div>;
}

function App() {
  const [associations, setAssociations] = useState([demoApex, demoAssociation]);
  const [questions, setQuestions] = useState(demoQuestions);
  const [achievements, setAchievements] = useState(demoAchievements);
  const [requests, setRequests] = useState([]);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberIds, setMemberIds] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All questions');
  const [associationFilter, setAssociationFilter] = useState('All associations');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showAchievementForm, setShowAchievementForm] = useState(false);
  const [isSubmittingAchievement, setIsSubmittingAchievement] = useState(false);
  const [commentBusyKey, setCommentBusyKey] = useState(null);
  const [questionTitleDraft, setQuestionTitleDraft] = useState('');
  const [questionAssociationDraft, setQuestionAssociationDraft] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [siteFindings, setSiteFindings] = useState([]);
  const [refreshingAssociationId, setRefreshingAssociationId] = useState(null);
  const [reviewingFindingId, setReviewingFindingId] = useState(null);
  const [editingHomepageId, setEditingHomepageId] = useState(null);
  const [homepageDraft, setHomepageDraft] = useState('');
  const [showAssociationForm, setShowAssociationForm] = useState(false);
  const [activeView, setActiveView] = useState('questions');
  const [notice, setNotice] = useState('');
  const [authModal, setAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(supabase));

  async function refresh() {
    if (!supabase) {
      const saved = localStorage.getItem('union-voice-demo-questions');
      if (saved) setQuestions([...JSON.parse(saved), ...demoQuestions]);
      setLoading(false);
      return;
    }
    const [associationResult, questionResult, findingsResult, achievementResult] = await Promise.all([
      supabase.from('associations').select('*').eq('status', 'approved').order('name'),
      supabase.from('questions').select('*, associations(name, acronym), answers(id, body, created_at), comments(id, body, created_at, author_name, is_anonymous)').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('association_site_findings').select('*').order('fetched_at', { ascending: false }),
      supabase.from('achievements').select('*, associations(name, acronym), comments(id, body, created_at, author_name, is_anonymous)').eq('status', 'published').order('created_at', { ascending: false }),
    ]);
    if (associationResult.error) setNotice(associationResult.error.message);
    else setAssociations(associationResult.data || []);
    if (questionResult.error) setNotice(questionResult.error.message);
    else setQuestions(questionResult.data || []);
    if (findingsResult.error) setNotice(findingsResult.error.message);
    else setSiteFindings(findingsResult.data || []);
    if (achievementResult.error) setNotice(achievementResult.error.message);
    else setAchievements(achievementResult.data || []);
    if (session?.user) {
      const { data: requestsData } = await supabase.from('association_requests').select('*').eq('status', 'pending').order('created_at');
      setRequests(requestsData || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) {
      refresh();
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    async function loadUserContext() {
      if (!session?.user) {
        setProfile(null);
        setMemberIds([]);
        return;
      }
      const [{ data: nextProfile }, { data: memberships }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').eq('id', session.user.id).maybeSingle(),
        supabase.from('association_members').select('association_id').eq('user_id', session.user.id).eq('status', 'active'),
      ]);
      if (!active) return;
      setProfile(nextProfile);
      setMemberIds((memberships || []).map((entry) => entry.association_id));
    }
    loadUserContext();
    return () => { active = false; };
  }, [session]);

  useEffect(() => { refresh(); }, [session]);

  const visibleQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesSearch = !query || [question.title, question.body, question.department, question.cluster, question.region, question.associations?.acronym].some((item) => item?.toLowerCase().includes(query));
      const matchesFilter = filter === 'All questions' || (filter === 'Unanswered' && !(question.answers || []).length) || (filter === 'Answered' && (question.answers || []).length > 0);
      const matchesAssociation = associationFilter === 'All associations' || question.association_id === associationFilter;
      return matchesSearch && matchesFilter && matchesAssociation;
    });
  }, [questions, search, filter, associationFilter]);
  const possibleDuplicates = useMemo(
    () => findPossibleDuplicates(questionTitleDraft, questionAssociationDraft, questions),
    [questionTitleDraft, questionAssociationDraft, questions],
  );

  const childrenByParent = useMemo(() => {
    const children = new Map();
    associations.forEach((association) => {
      if (association.parent_id) children.set(association.parent_id, [...(children.get(association.parent_id) || []), association]);
    });
    return children;
  }, [associations]);
  const roots = associations.filter((association) => !association.parent_id || !associations.some((candidate) => candidate.id === association.parent_id));

  async function signIn() {
    if (!supabase) {
      setNotice('Google sign-in becomes available after Supabase is connected. Anonymous posting works in demo mode.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setNotice(error.message);
  }

  function openAuth(mode = 'login') {
    setAuthMode(mode);
    setAuthMessage('');
    setAuthModal(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!supabase) {
      setAuthMessage('Connect Supabase before using email authentication.');
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = (data.get('email') || authEmail).trim().toLowerCase();
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password: data.get('password'),
          options: { data: { full_name: data.get('full_name').trim() } },
        });
        if (error) throw error;
        setAuthEmail(email);
        if (result.session) {
          setAuthModal(false);
          setNotice('Account created. Email confirmation is disabled for this Supabase project.');
        } else {
          setAuthMode('verify-signup');
          setAuthMessage(`Enter the verification code sent to ${email}.`);
        }
      } else if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: data.get('password') });
        if (error) throw error;
        setAuthModal(false);
      } else if (authMode === 'email-code') {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (error) throw error;
        setAuthEmail(email);
        setAuthMode('verify-email');
        setAuthMessage(`Enter the sign-in code sent to ${email}.`);
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email: authEmail,
          token: data.get('token').trim(),
          type: authMode === 'verify-signup' ? 'signup' : 'email',
        });
        if (error) throw error;
        setAuthModal(false);
        setAuthMessage('');
      }
    } catch (error) {
      setAuthMessage(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendEmailCode() {
    if (!supabase || !authEmail) return;
    setAuthBusy(true);
    const type = authMode === 'verify-signup' ? 'signup' : 'email';
    const { error } = await supabase.auth.resend({ type, email: authEmail });
    setAuthMessage(error ? error.message : `A new code was sent to ${authEmail}.`);
    setAuthBusy(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setNotice('Signed out.');
  }

  async function submitQuestion(event) {
    event.preventDefault();
    if (isSubmittingQuestion) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = data.get('title').trim();
    const body = data.get('body').trim();
    const associationId = data.get('association_id');
    const normalizedTitle = normalizeQuestionText(title);
    const normalizedBody = normalizeQuestionText(body);
    const exactDuplicate = questions.find((existing) => existing.association_id === associationId
      && (normalizeQuestionText(existing.title) === normalizedTitle || normalizeQuestionText(existing.body) === normalizedBody));
    if (exactDuplicate) {
      setNotice(`This appears to match an existing question: “${exactDuplicate.title}”. Please review it before posting.`);
      return;
    }
    setIsSubmittingQuestion(true);
    try {
      const anonymous = data.get('anonymous') === 'on';
      const question = {
        title, body, association_id: associationId,
        department: data.get('department').trim() || null, cluster: data.get('cluster').trim() || null,
        region: data.get('region').trim() || null, is_anonymous: anonymous, user_id: anonymous ? null : session?.user?.id || null,
      };
      if (!supabase) {
        const demoQuestion = { ...question, id: crypto.randomUUID(), created_at: new Date().toISOString(), associations: associations.find((entry) => entry.id === associationId) || demoAssociation, answers: [] };
        const existing = JSON.parse(localStorage.getItem('union-voice-demo-questions') || '[]');
        localStorage.setItem('union-voice-demo-questions', JSON.stringify([demoQuestion, ...existing]));
        setQuestions((current) => [demoQuestion, ...current]);
        setNotice('Your question is posted in this browser demo. Configure Supabase to publish it for everyone.');
      } else {
        const { error } = await supabase.from('questions').insert(question);
        if (error) throw error;
        setNotice('Your question has been posted.');
        await refresh();
      }
      form.reset();
      setQuestionTitleDraft('');
      setQuestionAssociationDraft('');
      setShowQuestionForm(false);
    } catch (error) {
      setNotice(error.message || 'Could not post your question. Please try again.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  }

  async function deleteQuestion(question) {
    if (!admin || !supabase || deletingQuestionId) return;
    if (!window.confirm(`Permanently delete “${question.title}”? This also removes its replies.`)) return;
    setDeletingQuestionId(question.id);
    const { error } = await supabase.from('questions').delete().eq('id', question.id);
    if (error) setNotice(error.message);
    else {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setNotice('Question and its replies were deleted.');
    }
    setDeletingQuestionId(null);
  }

  async function submitAssociationRequest(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rawHomepageUrl = data.get('homepage_url').trim();
    if (rawHomepageUrl && !safeHomepageUrl(rawHomepageUrl)) {
      setNotice('Enter an association homepage beginning with https:// or http://.');
      return;
    }
    const association = {
      name: data.get('name').trim(), acronym: data.get('acronym').trim().toUpperCase(),
      description: data.get('description').trim() || null, association_type: data.get('association_type'),
      parent_id: data.get('parent_id') || null, homepage_url: safeHomepageUrl(rawHomepageUrl),
    };
    if (!supabase) {
      setNotice('Association requests require a signed-in account and a connected Supabase project.');
      return;
    }
    if (admin) {
      const { error } = await supabase.from('associations').insert({ ...association, status: 'approved' });
      if (error) { setNotice(error.message); return; }
      event.currentTarget.reset();
      setShowAssociationForm(false);
      setNotice(`${association.acronym} added to the directory.`);
      await refresh();
      return;
    }
    if (!session?.user) { setNotice('Sign in with Google before requesting an association.'); return; }
    const { error } = await supabase.from('association_requests').insert({ ...association, contact_email: data.get('contact_email').trim(), requested_by: session.user.id });
    if (error) { setNotice(error.message); return; }
    event.currentTarget.reset();
    setShowAssociationForm(false);
    setNotice('Request sent to the portal administrator for review.');
  }

  async function submitAchievement(event) {
    event.preventDefault();
    if (isSubmittingAchievement) return;
    if (!session?.user) { setNotice('Sign in to post a Hall of Fame update.'); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    const associationId = data.get('association_id');
    const title = data.get('title').trim();
    const body = data.get('body').trim();
    const achievedOn = data.get('achieved_on') || null;
    setIsSubmittingAchievement(true);
    try {
      const authorName = profile?.full_name || session.user.email;
      if (!supabase) {
        const demoAchievement = { id: crypto.randomUUID(), association_id: associationId, title, body, achieved_on: achievedOn, author_name: authorName, created_at: new Date().toISOString(), associations: associations.find((entry) => entry.id === associationId) || demoAssociation, comments: [] };
        setAchievements((current) => [demoAchievement, ...current]);
        setNotice('Your Hall of Fame post is shown in this preview only. Configure Supabase to publish it for everyone.');
      } else {
        const { error } = await supabase.from('achievements').insert({ association_id: associationId, title, body, achieved_on: achievedOn, author_id: session.user.id, author_name: authorName });
        if (error) throw error;
        setNotice('Hall of Fame post published.');
        await refresh();
      }
      form.reset();
      setShowAchievementForm(false);
    } catch (error) {
      setNotice(error.message || 'Could not post to the Hall of Fame. Please try again.');
    } finally {
      setIsSubmittingAchievement(false);
    }
  }

  async function submitComment(event, { questionId, achievementId }) {
    event.preventDefault();
    if (commentBusyKey) return;
    const key = questionId ? `q-${questionId}` : `a-${achievementId}`;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = (data.get('comment') || '').trim();
    if (!body) return;
    const anonymous = data.get('anonymous') === 'on';
    const authorName = !anonymous ? (profile?.full_name || session?.user?.email || null) : null;
    setCommentBusyKey(key);
    try {
      if (!supabase) {
        const comment = { id: crypto.randomUUID(), body, is_anonymous: anonymous, author_name: authorName, created_at: new Date().toISOString() };
        if (questionId) setQuestions((current) => current.map((item) => item.id === questionId ? { ...item, comments: [...(item.comments || []), comment] } : item));
        else setAchievements((current) => current.map((item) => item.id === achievementId ? { ...item, comments: [...(item.comments || []), comment] } : item));
        setNotice('Your comment is shown in this preview only. Configure Supabase to publish it for everyone.');
      } else {
        const { error } = await supabase.from('comments').insert({
          question_id: questionId || null,
          achievement_id: achievementId || null,
          user_id: anonymous ? null : session?.user?.id || null,
          author_name: authorName,
          body,
          is_anonymous: anonymous,
        });
        if (error) throw error;
        setNotice('Comment posted.');
        await refresh();
      }
      form.reset();
    } catch (error) {
      setNotice(error.message || 'Could not post your comment. Please try again.');
    } finally {
      setCommentBusyKey(null);
    }
  }

  async function submitAnswer(event, question) {
    event.preventDefault();
    if (!session?.user) { setNotice('Sign in to answer as a representative.'); return; }
    const data = new FormData(event.currentTarget);
    const body = data.get('answer').trim();
    const { error } = await supabase.from('answers').insert({ question_id: question.id, association_id: question.association_id, author_id: session.user.id, body });
    if (error) { setNotice(error.message); return; }
    event.currentTarget.reset();
    setNotice('Reply published.');
    await refresh();
  }

  async function approveRequest(request) {
    const { data: association, error: createError } = await supabase.from('associations').insert({ name: request.name, acronym: request.acronym, description: request.description, association_type: request.association_type, parent_id: request.parent_id, homepage_url: request.homepage_url, status: 'approved' }).select().single();
    if (createError) { setNotice(createError.message); return; }
    const { error } = await supabase.from('association_requests').update({ status: 'approved', reviewed_at: new Date().toISOString(), association_id: association.id }).eq('id', request.id);
    if (error) setNotice(error.message);
    else { setNotice(`${request.acronym} approved and added to the portal.`); await refresh(); }
  }

  function editAssociationHomepage(association) {
    setEditingHomepageId(association?.id || null);
    setHomepageDraft(association?.homepage_url || '');
  }

  async function saveAssociationHomepage(event, association) {
    event.preventDefault();
    const homepageUrl = safeHomepageUrl(homepageDraft.trim());
    if (!homepageUrl || !homepageUrl.startsWith('https://')) {
      setNotice('Enter an official homepage beginning with https://.');
      return;
    }
    const { error } = await supabase.from('associations').update({ homepage_url: homepageUrl }).eq('id', association.id);
    if (error) { setNotice(error.message); return; }
    setAssociations((current) => current.map((item) => item.id === association.id ? { ...item, homepage_url: homepageUrl } : item));
    setEditingHomepageId(null);
    setNotice(`${association.acronym} homepage saved.`);
  }

  async function fetchAssociationWebsite(association) {
    if (!admin || !supabase || refreshingAssociationId) return;
    setRefreshingAssociationId(association.id);
    setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('fetch-association-site', { body: { association_id: association.id } });
      if (error) {
        let message = error.message;
        try { message = (await error.context.json()).error || message; } catch {}
        throw new Error(message);
      }
      const { data: findings, error: findingsError } = await supabase.from('association_site_findings').select('*').order('fetched_at', { ascending: false });
      if (findingsError) throw findingsError;
      setSiteFindings(findings || []);
      setNotice(`Fetched ${data.findings?.length || 0} public pages for ${association.acronym}. Review each excerpt before approving it.`);
    } catch (error) {
      setNotice(error.message || 'Could not fetch the association website.');
    } finally {
      setRefreshingAssociationId(null);
    }
  }

  async function reviewAssociationFinding(finding, reviewStatus) {
    if (!admin || !supabase || reviewingFindingId) return;
    setReviewingFindingId(finding.id);
    const { error } = await supabase.from('association_site_findings').update({ review_status: reviewStatus }).eq('id', finding.id);
    if (error) setNotice(error.message);
    else {
      setSiteFindings((current) => current.map((item) => item.id === finding.id ? { ...item, review_status: reviewStatus } : item));
      setNotice(reviewStatus === 'approved' ? 'Source excerpt approved and visible in the directory.' : 'Source excerpt hidden from the public directory.');
    }
    setReviewingFindingId(null);
  }

  const admin = profile?.role === 'admin';
  const modeLabel = supabase ? 'Supabase connected' : 'Preview mode';
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Union Voice home">
          <span className="brand-mark"><MessageCircle size={19} strokeWidth={2.4} /></span>
          <span className="brand-name">union<span>voice</span></span>
          <span className="brand-divider" />
          <span className="brand-org">AIBOC portal</span>
        </a>
        <div className="topbar-actions">
          <nav className="primary-nav" aria-label="Main navigation">
            <button className={activeView === 'questions' ? 'active' : ''} onClick={() => setActiveView('questions')}>Questions</button>
            <button className={activeView === 'associations' ? 'active' : ''} onClick={() => setActiveView('associations')}>Associations</button>
            <button className={activeView === 'achievements' ? 'active' : ''} onClick={() => setActiveView('achievements')}>Hall of Fame</button>
            <button className={activeView === 'hierarchy' ? 'active' : ''} onClick={() => setActiveView('hierarchy')}><Network size={14} /> Structure</button>
          </nav>
          <span className={`connection ${supabase ? 'is-live' : ''}`}><i />{modeLabel}</span>
          {session?.user ? <button className="user-menu" onClick={signOut} title="Sign out"><span className="avatar">{(profile?.full_name || session.user.email || 'U')[0].toUpperCase()}</span><span className="user-name">{profile?.full_name || session.user.email}</span><ChevronDown size={15} /></button> : <button className="button button-outline sign-in" onClick={() => openAuth('login')}><LogIn size={15} /> Sign in</button>}
        </div>
      </header>

      <main id="top">
        {activeView === 'questions' && <section className="intro-band">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> AIBOC · EMPLOYEE VOICE</div>
            <h1>Good questions<br /><em>move us forward.</em></h1>
            <p>A direct, thoughtful channel between bank employees and the representatives working for them.</p>
            <div className="intro-actions">
              <button className="button button-dark" onClick={() => setShowQuestionForm((value) => !value)}><Plus size={17} /> Ask a question</button>
              <span className="privacy-note"><ShieldCheck size={15} /> Ask in your name or anonymously</span>
            </div>
          </div>
          <div className="intro-art" aria-label="Illustration of an employee conversation">
            <div className="art-caption">YOUR VOICE<br />BELONGS HERE</div>
            <div className="art-disc" />
            <div className="art-note note-one"><MessageCircle size={18} /><span>Ask openly.<br />Or privately.</span></div>
            <div className="art-note note-two"><span className="note-dot" /><span>Heard by your<br />representatives</span></div>
            <div className="art-lines"><i /><i /><i /></div>
            <span className="art-star">✳</span>
          </div>
        </section>}

        {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button></div>}

        {activeView === 'questions' ? <section className="portal-content">
          <div className="feed-column">
            {showQuestionForm && <form className="compose-panel" onSubmit={submitQuestion}>
              <div className="form-heading"><div><span className="section-kicker">YOUR QUESTION</span><h2>Start a conversation</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => setShowQuestionForm(false)}><X size={18} /></button></div>
              <label className="field-label">Send to association<select name="association_id" required value={questionAssociationDraft} onChange={(event) => setQuestionAssociationDraft(event.target.value)}><option value="" disabled>Select an association</option>{associations.filter((association) => association.association_type !== 'apex').map((association) => <option key={association.id} value={association.id}>{association.acronym} · {association.name}</option>)}</select></label>
              <label className="field-label">Question title<input name="title" value={questionTitleDraft} onChange={(event) => setQuestionTitleDraft(event.target.value)} required maxLength="160" placeholder="What would you like clarity on?" /></label>
              {possibleDuplicates.length > 0 && <div className="duplicate-warning" role="status"><strong>Check for a similar question before posting</strong>{possibleDuplicates.map(({ question }) => <a key={question.id} href={`#question-${question.id}`}>{question.title} <ArrowUpRight size={13} /></a>)}</div>}
              <label className="field-label">Details<textarea name="body" required rows="4" placeholder="Add context that will help your representative respond..." /></label>
              <div className="tag-fields"><label className="field-label">Department<input name="department" placeholder="e.g. Operations" /></label><label className="field-label">Cluster<input name="cluster" placeholder="e.g. Chennai" /></label><label className="field-label">Region<input name="region" placeholder="e.g. South" /></label></div>
              <label className="anonymous-toggle"><input type="checkbox" name="anonymous" /><span className="toggle-track"><i /></span><span><strong>Post anonymously</strong><small>Your identity will not be attached to this question.</small></span><EyeOff size={18} /></label>
              <div className="form-footer"><span><ShieldCheck size={15} /> Please do not include account or customer information.</span><button className="button button-dark" type="submit" disabled={isSubmittingQuestion}>{isSubmittingQuestion ? <><LoaderCircle className="button-spinner" size={15} /> Posting...</> : <><Send size={15} /> Publish question</>}</button></div>
            </form>}

            <div className="feed-heading">
              <div><span className="section-kicker">THE CONVERSATION</span><h2>Questions from colleagues <span className="count">{visibleQuestions.length}</span></h2></div>
              <button className="button button-mobile-ask" onClick={() => setShowQuestionForm((value) => !value)}><Plus size={16} /> Ask</button>
            </div>
            <div className="feed-tools">
              <label className="search-box"><Search size={17} /><input aria-label="Search questions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, teams, places..." />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
              <div className="filter-select"><Filter size={15} /><select aria-label="Filter questions" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All questions</option><option>Unanswered</option><option>Answered</option></select><ChevronDown size={14} /></div>
              <div className="filter-select"><Building2 size={15} /><select aria-label="Filter by association" value={associationFilter} onChange={(event) => setAssociationFilter(event.target.value)}><option>All associations</option>{associations.map((association) => <option key={association.id} value={association.id}>{association.acronym}</option>)}</select><ChevronDown size={14} /></div>
            </div>
            <div className="question-list">
              {loading ? <div className="empty-state"><span className="loader" /><p>Loading the conversation...</p></div> : visibleQuestions.length ? visibleQuestions.map((question) => {
                const isRepresentative = admin || memberIds.includes(question.association_id);
                return <article className="question-item" id={`question-${question.id}`} key={question.id}>
                  <div className="question-meta"><span className="association-label"><span className="association-symbol">{(question.associations?.acronym || 'U').slice(0, 1)}</span>{question.associations?.acronym || 'Association'}</span><span className="meta-separator">·</span><span>{timeAgo(question.created_at)}</span>{question.is_anonymous && <span className="anonymous-label"><EyeOff size={12} /> Anonymous</span>}</div>
                  <h3>{question.title}</h3><p className="question-body">{question.body}</p>
                  <div className="question-tags">{[question.department, question.cluster, question.region].filter(Boolean).map((tag, index) => <span key={`${tag}-${index}`} className={`tag tag-${index}`}>{tag}</span>)}</div>
                  {(question.answers || []).map((answer) => <div className="answer-block" key={answer.id}><div className="answer-heading"><span className="answer-check"><Check size={12} /></span><strong>Representative reply</strong><span>{timeAgo(answer.created_at)}</span></div><p>{answer.body}</p></div>)}
                  {isRepresentative && supabase && <details className="reply-details"><summary><MessageCircle size={14} /> Reply as representative</summary><form onSubmit={(event) => submitAnswer(event, question)}><textarea name="answer" required rows="3" placeholder="Write a clear, helpful response..." /><button className="button button-dark" type="submit"><Send size={14} /> Publish reply</button></form></details>}
                  <CommentThread comments={question.comments} onSubmit={(event) => submitComment(event, { questionId: question.id })} busy={commentBusyKey === `q-${question.id}`} />
                  <div className="question-bottom"><span><MessageCircle size={14} /> {(question.answers || []).length} {(question.answers || []).length === 1 ? 'reply' : 'replies'}</span><div className="question-actions">{admin && <button className="text-action delete-question" onClick={() => deleteQuestion(question)} disabled={Boolean(deletingQuestionId)}><Trash2 size={14} /> {deletingQuestionId === question.id ? 'Deleting...' : 'Delete question'}</button>}<button className="text-action" onClick={() => setNotice(session?.user ? 'Replies are added by representatives assigned to this association.' : 'Sign in with your work account to participate as a representative.')}><ArrowUpRight size={14} /> Follow conversation</button></div></div>
                </article>;
              }) : <div className="empty-state"><CircleHelp size={26} /><h3>No questions found</h3><p>Try a different search, or be the first to ask.</p><button className="text-action" onClick={() => setShowQuestionForm(true)}><Plus size={15} /> Ask a question</button></div>}
            </div>
          </div>

          <aside className="side-column">
            <section className="side-section association-section"><div className="side-title"><span className="section-kicker">YOUR ASSOCIATIONS</span><Users size={16} /></div><p className="side-description">Questions are routed to the association best placed to help.</p>
              {associations.map((association) => <div className="association-row" key={association.id}><span className="association-badge">{association.acronym.slice(0, 1)}</span><span><strong>{association.acronym}</strong><small>{association.name}</small></span><BadgeCheck size={16} className="verified-icon" /></div>)}
              <button className="text-action request-link" onClick={() => { setActiveView('associations'); setShowAssociationForm(true); }}><Plus size={14} /> View directory / request</button>
            </section>

            {admin && <section className="side-section admin-section"><div className="side-title"><span className="section-kicker">ADMIN REVIEW</span><span className="pending-count">{requests.length}</span></div><p className="side-description">Association requests awaiting approval.</p>{requests.length ? requests.map((request) => <div className="request-card" key={request.id}><strong>{request.acronym} · {request.name}</strong><p>{request.description || 'No description provided.'}</p><button className="text-action" onClick={() => approveRequest(request)}><Check size={14} /> Approve association</button></div>) : <p className="no-requests">No requests waiting.</p>}</section>}

            <section className="side-section how-section"><div className="side-title"><span className="section-kicker">A BETTER WAY TO BE HEARD</span><ArrowDown size={16} /></div><div className="step-row"><span>01</span><div><strong>Ask clearly</strong><p>Choose an association and add useful context.</p></div></div><div className="step-row"><span>02</span><div><strong>Stay private, if you prefer</strong><p>Anonymous questions do not show your name.</p></div></div><div className="step-row"><span>03</span><div><strong>Get a considered reply</strong><p>Representatives answer in the open, for everyone.</p></div></div></section>

            <div className="privacy-card"><ShieldCheck size={19} /><div><strong>Built around trust</strong><p>Never share customer data, account numbers, or confidential bank information.</p></div></div>
          </aside>
        </section> : activeView === 'associations' ? <section className="directory-page">
          <div className="page-heading"><div><span className="section-kicker">THE NETWORK</span><h1>Associations</h1><p>Browse national bank unions and officers’ associations.</p><p className="directory-scope">Sourced coverage: the seven UFBU constituents notified on 6 August 2026 and AIBOC’s published bank-wise affiliate roster. This is not a complete register of every regional or independent union.</p></div><button className="button button-dark" onClick={() => setShowAssociationForm((value) => !value)}><Plus size={16} /> {admin ? 'Add association' : 'Request association'}</button></div>
          {showAssociationForm && <div className="directory-form-wrap"><div className="form-heading"><div><span className="section-kicker">{admin ? 'DIRECTORY ADMIN' : 'PROPOSE A BODY'}</span><h2>{admin ? 'Add an association' : 'Request an association'}</h2></div><button type="button" className="icon-button" aria-label="Close association form" onClick={() => setShowAssociationForm(false)}><X size={18} /></button></div><AssociationRequestForm associations={associations} admin={admin} onSubmit={submitAssociationRequest} /></div>}
          <div className="directory-grid">{associations.map((association) => <AssociationDirectoryCard key={association.id} association={association} associations={associations} findings={siteFindings} admin={admin} editingHomepage={editingHomepageId === association.id} homepageDraft={homepageDraft} onHomepageDraftChange={setHomepageDraft} onEditHomepage={editAssociationHomepage} onSaveHomepage={saveAssociationHomepage} isRefreshing={refreshingAssociationId === association.id} reviewingFindingId={reviewingFindingId} onRefresh={fetchAssociationWebsite} onReview={reviewAssociationFinding} />)}</div>
          {admin && <section className="side-section admin-section directory-review"><div className="side-title"><span className="section-kicker">ADMIN REVIEW</span><span className="pending-count">{requests.length}</span></div><p className="side-description">Association requests awaiting approval.</p>{requests.length ? requests.map((request) => <div className="request-card" key={request.id}><strong>{request.acronym} · {request.name}</strong><p>{request.description || 'No description provided.'}</p><p>{request.parent_id ? `Parent: ${associations.find((item) => item.id === request.parent_id)?.acronym || 'selected association'}` : 'Top-level organization'}</p><button className="text-action" onClick={() => approveRequest(request)}><Check size={14} /> Approve association</button></div>) : <p className="no-requests">No requests waiting.</p>}</section>}
        </section> : activeView === 'achievements' ? <section className="directory-page hall-of-fame-page">
          <div className="page-heading"><div><span className="section-kicker">RECOGNIZED WINS</span><h1>Hall of Fame</h1><p>Achievements shared by representatives and employees across associations.</p></div><button className="button button-dark" onClick={() => setShowAchievementForm((value) => !value)}><Plus size={16} /> Share an achievement</button></div>
          {showAchievementForm && <div className="directory-form-wrap"><div className="form-heading"><div><span className="section-kicker">SHARE A WIN</span><h2>Post a Hall of Fame update</h2></div><button type="button" className="icon-button" aria-label="Close achievement form" onClick={() => setShowAchievementForm(false)}><X size={18} /></button></div>
            <form className="association-form directory-form" onSubmit={submitAchievement}>
              <label className="field-label">Association<select name="association_id" required defaultValue=""><option value="" disabled>Select an association</option>{associations.map((association) => <option key={association.id} value={association.id}>{association.acronym} · {association.name}</option>)}</select></label>
              <label className="field-label">Title<input name="title" required minLength="5" maxLength="160" placeholder="What did the association achieve?" /></label>
              <label className="field-label">Date achieved<input name="achieved_on" type="date" /></label>
              <label className="field-label">Details<textarea name="body" required minLength="10" rows="4" placeholder="Describe the win and how it helps employees..." /></label>
              {!session?.user && <p className="auth-message" role="status">Sign in to post a Hall of Fame update.</p>}
              <button className="button button-dark" type="submit" disabled={isSubmittingAchievement}>{isSubmittingAchievement ? 'Posting...' : 'Publish achievement'} <ArrowUpRight size={15} /></button>
            </form>
          </div>}
          <div className="achievement-list">
            {achievements.length ? achievements.map((achievement) => <article className="achievement-card" key={achievement.id}>
              <div className="question-meta"><span className="association-label"><span className="association-symbol">{(achievement.associations?.acronym || 'U').slice(0, 1)}</span>{achievement.associations?.acronym || 'Association'}</span><span className="meta-separator">·</span><span>{timeAgo(achievement.created_at)}</span></div>
              <h3>{achievement.title}</h3>
              <p className="question-body">{achievement.body}</p>
              {achievement.achieved_on && <p className="achievement-date">Achieved {new Date(achievement.achieved_on).toLocaleDateString()}</p>}
              <p className="achievement-author">Posted by {achievement.author_name || 'a member'}</p>
              <CommentThread comments={achievement.comments} onSubmit={(event) => submitComment(event, { achievementId: achievement.id })} busy={commentBusyKey === `a-${achievement.id}`} />
            </article>) : <div className="empty-state"><CircleHelp size={26} /><h3>No achievements posted yet</h3><p>Be the first to celebrate a win.</p></div>}
          </div>
        </section> : <section className="directory-page hierarchy-page">
          <div className="page-heading"><div><span className="section-kicker">HOW WE CONNECT</span><h1>Association structure</h1><p>Explore national bodies and the bank associations connected to them.</p></div><Network size={27} /></div>
          <div className="hierarchy-panel"><div className="hierarchy-caption"><Network size={16} /><span>ORGANIZATIONAL HIERARCHY</span></div><ul className="association-tree">{roots.map((association) => <AssociationTreeNode key={association.id} association={association} childrenByParent={childrenByParent} />)}</ul></div>
          <button className="text-action hierarchy-action" onClick={() => { setActiveView('associations'); setShowAssociationForm(true); }}><Plus size={15} /> Request a new association or add a child body</button>
        </section>}
      </main>
      {authModal && <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthModal(false); }}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button auth-close" aria-label="Close sign-in dialog" onClick={() => setAuthModal(false)}><X size={18} /></button>
        <span className="auth-icon"><Mail size={19} /></span>
        <span className="section-kicker">UNION VOICE ACCOUNT</span>
        <h2 id="auth-title">{authMode === 'signup' ? 'Create your account' : authMode === 'verify-signup' ? 'Verify your email' : authMode === 'email-code' || authMode === 'verify-email' ? 'Sign in with email' : 'Welcome back'}</h2>
        <p className="auth-intro">{authMode === 'signup' ? 'Register with your email. We will send a verification code before your account is activated.' : authMode.startsWith('verify') ? `A one-time code will verify ${authEmail}.` : 'Sign in to participate as a representative or request an association.'}</p>
        <form className="auth-form" onSubmit={submitAuth}>
          {authMode === 'signup' && <label className="field-label">Full name<input name="full_name" autoComplete="name" required maxLength="120" placeholder="Your name" /></label>}
          {!authMode.startsWith('verify') && <label className="field-label">Email address<input name="email" type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /></label>}
          {(authMode === 'login' || authMode === 'signup') && <label className="field-label">Password<input name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength="8" placeholder="At least 8 characters" /></label>}
          {authMode.startsWith('verify') && <label className="field-label">Email verification code<input name="token" inputMode="numeric" autoComplete="one-time-code" required minLength="6" maxLength="8" placeholder="Enter the code from your email" /></label>}
          {authMessage && <p className="auth-message" role="status">{authMessage}</p>}
          <button className="button button-dark auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'signup' ? 'Create account' : authMode === 'verify-signup' ? 'Verify and register' : authMode === 'email-code' ? 'Send sign-in code' : authMode === 'verify-email' ? 'Verify and sign in' : 'Sign in'}</button>
        </form>
        {authMode.startsWith('verify') && <button className="text-action auth-resend" onClick={resendEmailCode} disabled={authBusy}>Resend code</button>}
        {authMode === 'login' && <div className="auth-links"><button onClick={() => { setAuthMode('email-code'); setAuthMessage(''); }}>Sign in with email code</button><button onClick={() => { setAuthMode('signup'); setAuthMessage(''); }}>Create account</button></div>}
        {(authMode === 'signup' || authMode === 'email-code') && <button className="auth-back-link" onClick={() => { setAuthMode('login'); setAuthMessage(''); }}>Back to password sign in</button>}
        {authMode.startsWith('verify') && <button className="auth-back-link" onClick={() => { setAuthMode(authMode === 'verify-signup' ? 'signup' : 'email-code'); setAuthMessage(''); }}>Use a different email</button>}
        {!authMode.startsWith('verify') && <><div className="auth-separator"><span>OR</span></div><button className="button button-outline auth-google" onClick={signIn}><LogIn size={15} /> Continue with Google</button></>}
        <p className="auth-footnote"><KeyRound size={13} /> Your credentials are handled securely by Supabase Auth.</p>
      </section></div>}
      <footer><span>UNION VOICE <span className="footer-dot">·</span> AIBOC</span><span>For employees. With representatives.</span><button onClick={session?.user ? signOut : () => openAuth('login')}>{session?.user ? 'Sign out' : 'Representative sign in'} <ArrowUpRight size={13} /></button></footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
