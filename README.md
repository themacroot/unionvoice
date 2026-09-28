# Union Voice

A configurable employee-to-association question portal. The frontend is a static Vite app; Supabase provides Google OAuth, Postgres, and row-level security. It can be deployed on Vercel, Netlify, or Cloudflare Pages free tiers.

## Run locally

1. Install Node.js 20+.
2. Run `npm install` and `npm run dev`. The project installs Supabase CLI locally; invoke it with `npx supabase` from this folder.
3. Without Supabase environment variables, the site runs in browser-local demo mode. Demo posts stay in that browser and are not shared.
4. To connect a backend, create a Supabase project, copy `.env.template` to `.env.local`, and fill in the project URL and publishable/anon key. Keep OAuth client secrets in Supabase provider settings, not in local frontend environment files.
5. For a new Supabase project, run `supabase/schema.sql` in SQL Editor. If you already installed the earlier starter schema, run `supabase/migrations/20260928000001_association_directory.sql`, `supabase/migrations/20260928000002_association_site_findings.sql`, `supabase/migrations/20260928000003_hall_of_fame_and_comments.sql`, `supabase/migrations/20260928000004_question_moderation.sql`, and `supabase/migrations/20260928000005_seed_bank_union_directory.sql`; do not rerun the original schema because its named RLS policies already exist. The directory seed adds the seven UFBU constituents notified in August 2026, source links, and the officers' bodies published in AIBOC's affiliate roster. It is an initial sourced catalogue, not a complete register of every bank union.
6. In Google Cloud Console, configure Google Auth Platform branding and audience. Choose **External** if employees may use personal Gmail or accounts outside one Workspace domain; choose **Internal** only if every user belongs to your organization's Google Workspace. While an External app is in testing, add the initial admin and representative accounts as test users. Create a **Web application** OAuth client and add frontend origins (`http://localhost:5173` and your deployed site origin) under Authorized JavaScript origins. Add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) under Authorized redirect URIs. Copy the Google client ID and secret into **Supabase Dashboard → Authentication → Sign In / Providers → Google** and enable the provider. In Supabase **Authentication → URL Configuration**, set the Site URL and allow-list `http://localhost:5173/**` plus your deployed site URL (for example `https://your-site.vercel.app/**`). This app uses basic Google identity scopes (`openid`, `email`, `profile`); it does not need Gmail API access.
7. In **Authentication → Sign In / Providers → Email**, enable email/password and email OTP, and require email confirmation for registration. In **Authentication → Email Templates**, make the **Confirm signup** and **Magic Link** templates display `{{ .Token }}` so Supabase sends a numeric code that users can enter in the portal. The built-in email sender is for testing and is rate-limited; configure a custom SMTP provider in Supabase Auth settings before inviting employees, and test inbox delivery and spam handling.
8. Sign in once with the intended administrator's account. In SQL Editor, promote it with `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@example.com');` using that account's email, then sign out and back in. Admins can delete questions from the feed; deletion also permanently removes replies.
9. Add representative accounts in `association_members` after they have signed in. Assign each one to the association they represent. Admins can approve association requests from the Associations directory. The directory and hierarchy use `association_type`, `parent_id`, and `homepage_url` on each association.
10. To enable no-model website review, run `npx supabase login`, link this folder with `npx supabase link --project-ref <project-ref>`, and deploy with `npx supabase functions deploy fetch-association-site`. Supabase supplies the function's project URL and service-role environment variables. In the Associations directory, an admin adds an HTTPS homepage, clicks **Fetch website information**, then approves or hides each source excerpt. Fetching is bounded to six same-domain HTML pages per manual run; it does not infer names or roles, so verify the source excerpt yourself. No AI/model provider key is needed.

## Deploy free

Push this folder to GitHub and import it into Vercel, Netlify, or Cloudflare Pages. Set the build command to `npm run build`, output directory to `dist`, and add only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as frontend build environment variables. Add the deployed URL to Supabase's redirect URL allow-list. Keep the Google client secret in Supabase provider settings; never put it in Vite environment variables. Never expose the Supabase service-role key in this app. Check the free tiers' current quotas and inactivity rules before launch.

## Values and credentials to provide

- Supabase project URL, available under **Project Settings → API**.
- Supabase publishable key (or legacy anon key), also under **Project Settings → API**. This is designed for browser use with RLS enabled.
- Google OAuth Web client ID and client secret. These are entered into Supabase's Google provider settings, not into the frontend.
- For reliable email OTP delivery, SMTP host, port, username, password, and sender address from your chosen email provider. Enter these in Supabase Auth SMTP settings, never in the frontend.
- Your Google OAuth audience decision: External for Gmail/cross-organization users, or Internal for one Google Workspace organization only.
- Your admin Google account email, to promote after the first sign-in.
- Representative Google account emails and the association each should represent.
- Official homepage URLs and parent association for each body. These can also be filled in later through the association form.

Do not send or commit a Google client secret, Supabase service-role key, or other private credential in chat or source control. Put frontend values in local `.env.local` and the hosting provider's environment-variable settings.

## Included workflows

- Public question feed tagged with department, cluster, and region.
- Anonymous or named question submission routed to an approved association.
- Google sign-in for staff and representatives.
- Email/password registration with email OTP verification, password login, and passwordless email-code login.
- Association request form and administrator approval queue.
- Association directory with homepage links and an editable apex-to-bank hierarchy.
- Admin-triggered public homepage fetch with source-linked excerpts and human approval; no model/API subscription required.
- Representative replies restricted to members of the question's association.
- Duplicate-question warnings based on normalized or closely matching titles within the selected association.
- Filtering the question feed by association, in addition to answered/unanswered status.
- A Hall of Fame feed where representatives and employees post association achievements, with public comment threads.
- Comment threads on both questions and Hall of Fame posts, supporting anonymous or named participation.
- Admin question deletion protected by RLS.
- Postgres RLS policies for public reading, safe submission, and role-gated actions.

## Before production

This is a starter, not a complete bank-grade case-management system. Configure Google OAuth and Supabase, promote at least one administrator, assign representatives, review privacy/retention requirements, and test policies with non-admin accounts before inviting employees. Anonymous questions do not store a submitter identity. Supabase's publishable key belongs in frontend configuration; never expose a service-role key in this app.
