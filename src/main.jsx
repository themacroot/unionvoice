import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowDown, ArrowUpRight, BadgeCheck, Building2, Check, ChevronDown, CircleHelp, ExternalLink, EyeOff, Filter, KeyRound, LogIn, Mail, MessageCircle, Network, Plus, Search, Send, ShieldCheck, Users, X } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const demoApex = { id: 'demo-aiboc', name: 'All India Bank Officers Confederation', acronym: 'AIBOC', description: 'Apex body for affiliated bank officers associations', association_type: 'apex', parent_id: null, homepage_url: null, status: 'approved' };
const demoAssociation = { id: 'demo-siboa', name: "SIB's Officers Association", acronym: 'SIBOA', description: 'South Indian Bank Officers Association', association_type: 'bank', parent_id: demoApex.id, homepage_url: null, status: 'approved' };
const demoQuestions = [
  { id: 'demo-1', title: 'Clarification on the revised transfer policy', body: 'Could the association clarify how the new transfer guidelines apply to officers who have completed a tenure in a rural branch?', department: 'Operations', cluster: 'Chennai', region: 'South', is_anonymous: false, created_at: '2026-09-25T10:10:00Z', associations: demoAssociation, answers: [{ id: 'a1', body: 'We have raised this with HR and requested the circular in writing. We will share an update as soon as we receive it.', created_at: '2026-09-26T08:30:00Z' }] },
  { id: 'demo-2', title: 'Medical reimbursement claim timeline', body: 'Has there been any update on the expected processing time for pending medical reimbursement claims?', department: 'Credit', cluster: 'Coimbatore', region: 'South', is_anonymous: true, created_at: '2026-09-24T13:00:00Z', associations: demoAssociation, answers: [] },
  { id: 'demo-3', title: 'Request for guidance on the new performance review format', body: 'The new format has a few sections that are not clear to our team. Can someone explain the process for seeking a review?', department: 'Retail Banking', cluster: 'Kochi', region: 'South', is_anonymous: false, created_at: '2026-09-22T07:45:00Z', associations: demoAssociation, answers: [] },
];

function timeAgo(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
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

function App() {
  const [associations, setAssociations] = useState([demoApex, demoAssociation]);
  const [questions, setQuestions] = useState(demoQuestions);
  const [requests, setRequests] = useState([]);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberIds, setMemberIds] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All questions');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
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
    const [associationResult, questionResult] = await Promise.all([
      supabase.from('associations').select('*').eq('status', 'approved').order('name'),
      supabase.from('questions').select('*, associations(name, acronym), answers(id, body, created_at)').eq('status', 'published').order('created_at', { ascending: false }),
    ]);
    if (associationResult.error) setNotice(associationResult.error.message);
    else setAssociations(associationResult.data || []);
    if (questionResult.error) setNotice(questionResult.error.message);
    else setQuestions(questionResult.data || []);
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
      return matchesSearch && matchesFilter;
    });
  }, [questions, search, filter]);

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
    const data = new FormData(event.currentTarget);
    const anonymous = data.get('anonymous') === 'on';
    const question = {
      title: data.get('title').trim(), body: data.get('body').trim(), association_id: data.get('association_id'),
      department: data.get('department').trim() || null, cluster: data.get('cluster').trim() || null,
      region: data.get('region').trim() || null, is_anonymous: anonymous, user_id: anonymous ? null : session?.user?.id || null,
    };
    if (!supabase) {
      const demoQuestion = { ...question, id: crypto.randomUUID(), created_at: new Date().toISOString(), associations: associations.find((entry) => entry.id === question.association_id) || demoAssociation, answers: [] };
      const existing = JSON.parse(localStorage.getItem('union-voice-demo-questions') || '[]');
      localStorage.setItem('union-voice-demo-questions', JSON.stringify([demoQuestion, ...existing]));
      setQuestions((current) => [demoQuestion, ...current]);
      setNotice('Your question is posted in this browser demo. Configure Supabase to publish it for everyone.');
    } else {
      const { error } = await supabase.from('questions').insert(question);
      if (error) { setNotice(error.message); return; }
      setNotice('Your question has been posted.');
      await refresh();
    }
    event.currentTarget.reset();
    setShowQuestionForm(false);
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
              <label className="field-label">Send to association<select name="association_id" required defaultValue=""><option value="" disabled>Select an association</option>{associations.filter((association) => association.association_type !== 'apex').map((association) => <option key={association.id} value={association.id}>{association.acronym} · {association.name}</option>)}</select></label>
              <label className="field-label">Question title<input name="title" required maxLength="160" placeholder="What would you like clarity on?" /></label>
              <label className="field-label">Details<textarea name="body" required rows="4" placeholder="Add context that will help your representative respond..." /></label>
              <div className="tag-fields"><label className="field-label">Department<input name="department" placeholder="e.g. Operations" /></label><label className="field-label">Cluster<input name="cluster" placeholder="e.g. Chennai" /></label><label className="field-label">Region<input name="region" placeholder="e.g. South" /></label></div>
              <label className="anonymous-toggle"><input type="checkbox" name="anonymous" /><span className="toggle-track"><i /></span><span><strong>Post anonymously</strong><small>Your identity will not be attached to this question.</small></span><EyeOff size={18} /></label>
              <div className="form-footer"><span><ShieldCheck size={15} /> Please do not include account or customer information.</span><button className="button button-dark" type="submit"><Send size={15} /> Publish question</button></div>
            </form>}

            <div className="feed-heading">
              <div><span className="section-kicker">THE CONVERSATION</span><h2>Questions from colleagues <span className="count">{visibleQuestions.length}</span></h2></div>
              <button className="button button-mobile-ask" onClick={() => setShowQuestionForm((value) => !value)}><Plus size={16} /> Ask</button>
            </div>
            <div className="feed-tools">
              <label className="search-box"><Search size={17} /><input aria-label="Search questions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, teams, places..." />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
              <div className="filter-select"><Filter size={15} /><select aria-label="Filter questions" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All questions</option><option>Unanswered</option><option>Answered</option></select><ChevronDown size={14} /></div>
            </div>
            <div className="question-list">
              {loading ? <div className="empty-state"><span className="loader" /><p>Loading the conversation...</p></div> : visibleQuestions.length ? visibleQuestions.map((question) => {
                const isRepresentative = admin || memberIds.includes(question.association_id);
                return <article className="question-item" key={question.id}>
                  <div className="question-meta"><span className="association-label"><span className="association-symbol">{(question.associations?.acronym || 'U').slice(0, 1)}</span>{question.associations?.acronym || 'Association'}</span><span className="meta-separator">·</span><span>{timeAgo(question.created_at)}</span>{question.is_anonymous && <span className="anonymous-label"><EyeOff size={12} /> Anonymous</span>}</div>
                  <h3>{question.title}</h3><p className="question-body">{question.body}</p>
                  <div className="question-tags">{[question.department, question.cluster, question.region].filter(Boolean).map((tag, index) => <span key={`${tag}-${index}`} className={`tag tag-${index}`}>{tag}</span>)}</div>
                  {(question.answers || []).map((answer) => <div className="answer-block" key={answer.id}><div className="answer-heading"><span className="answer-check"><Check size={12} /></span><strong>Representative reply</strong><span>{timeAgo(answer.created_at)}</span></div><p>{answer.body}</p></div>)}
                  {isRepresentative && supabase && <details className="reply-details"><summary><MessageCircle size={14} /> Reply as representative</summary><form onSubmit={(event) => submitAnswer(event, question)}><textarea name="answer" required rows="3" placeholder="Write a clear, helpful response..." /><button className="button button-dark" type="submit"><Send size={14} /> Publish reply</button></form></details>}
                  <div className="question-bottom"><span><MessageCircle size={14} /> {(question.answers || []).length} {(question.answers || []).length === 1 ? 'reply' : 'replies'}</span><button className="text-action" onClick={() => setNotice(session?.user ? 'Replies are added by representatives assigned to this association.' : 'Sign in with your work account to participate as a representative.')}><ArrowUpRight size={14} /> Follow conversation</button></div>
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
          <div className="page-heading"><div><span className="section-kicker">THE NETWORK</span><h1>Associations</h1><p>Browse affiliated bodies and visit their official homepages.</p></div><button className="button button-dark" onClick={() => setShowAssociationForm((value) => !value)}><Plus size={16} /> {admin ? 'Add association' : 'Request association'}</button></div>
          {showAssociationForm && <div className="directory-form-wrap"><div className="form-heading"><div><span className="section-kicker">{admin ? 'DIRECTORY ADMIN' : 'PROPOSE A BODY'}</span><h2>{admin ? 'Add an association' : 'Request an association'}</h2></div><button type="button" className="icon-button" aria-label="Close association form" onClick={() => setShowAssociationForm(false)}><X size={18} /></button></div><AssociationRequestForm associations={associations} admin={admin} onSubmit={submitAssociationRequest} /></div>}
          <div className="directory-grid">{associations.map((association) => <article className="directory-card" key={association.id}><div className="directory-card-top"><span className="association-badge"><Building2 size={17} /></span><span className="level-label">{association.association_type === 'apex' ? 'APEX BODY' : association.association_type === 'bank' ? 'BANK ASSOCIATION' : 'ASSOCIATION'}</span></div><h2>{association.name}</h2><p className="directory-acronym">{association.acronym}</p><p className="directory-description">{association.description || 'Association information has not been added yet.'}</p><div className="directory-parent">{association.parent_id ? `Reports to ${associations.find((item) => item.id === association.parent_id)?.acronym || 'parent association'}` : 'Top-level organization'}</div>{safeHomepageUrl(association.homepage_url) ? <a className="text-action directory-link" href={safeHomepageUrl(association.homepage_url)} target="_blank" rel="noreferrer">Visit homepage <ExternalLink size={14} /></a> : <span className="no-homepage">Homepage not provided</span>}</article>)}</div>
          {admin && <section className="side-section admin-section directory-review"><div className="side-title"><span className="section-kicker">ADMIN REVIEW</span><span className="pending-count">{requests.length}</span></div><p className="side-description">Association requests awaiting approval.</p>{requests.length ? requests.map((request) => <div className="request-card" key={request.id}><strong>{request.acronym} · {request.name}</strong><p>{request.description || 'No description provided.'}</p><p>{request.parent_id ? `Parent: ${associations.find((item) => item.id === request.parent_id)?.acronym || 'selected association'}` : 'Top-level organization'}</p><button className="text-action" onClick={() => approveRequest(request)}><Check size={14} /> Approve association</button></div>) : <p className="no-requests">No requests waiting.</p>}</section>}
        </section> : <section className="directory-page hierarchy-page">
          <div className="page-heading"><div><span className="section-kicker">HOW WE CONNECT</span><h1>Association structure</h1><p>Explore the apex body and the bank associations connected to it.</p></div><Network size={27} /></div>
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
