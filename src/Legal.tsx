import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, X } from 'lucide-react';
import { api, apiError } from './api';
import { Markdown, headingsOf } from './Markdown';
import type { LegalDocument, LegalKind, LegalStatus, LegalVersion, User } from './types';
import './legal.css';

const nice = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
const OTHER: Record<LegalKind, { to: string; label: string }> = { 'privacy-policy': { to: '/terms', label: 'Terms of Use' }, terms: { to: '/privacy', label: 'Privacy Policy' } };

/** Public page for the privacy policy or the terms of use, with contents and past versions. */
export function LegalPage({ kind, user }: { kind: LegalKind; user: User | null }) {
  const [doc, setDoc] = useState<LegalDocument | null>(null); const [versions, setVersions] = useState<LegalVersion[]>([]); const [error, setError] = useState(''); const [lang, setLang] = useState('en');
  useEffect(() => { setDoc(null); setError(''); api.legal(kind, lang).then(setDoc).catch((e) => setError(apiError(e, 'This document is not available right now.'))); api.legalVersions(kind).then(setVersions).catch(() => setVersions([])); window.scrollTo(0, 0); }, [kind, lang]);
  const showVersion = (version: string) => { setError(''); api.legalVersion(kind, version).then(setDoc).catch((e) => setError(apiError(e, 'That version could not be loaded.'))); };
  const toc = useMemo(() => (doc ? headingsOf(doc.content).filter((h) => h.level === 2) : []), [doc]);
  const Icon = kind === 'terms' ? FileText : ShieldCheck;

  return <main className="legal-page">
    <header><Link className="brand dark" to={user ? '/trips' : '/discover'}><span>G</span> GoCity</Link><nav><Link to={OTHER[kind].to}>{OTHER[kind].label}</Link>{user ? <Link to="/trips">My trips</Link> : <Link className="mini-primary" to="/register">Get started</Link>}</nav></header>
    {error && !doc ? <div className="legal-missing"><p className="error">{error}</p><Link className="text-link" to="/discover"><ArrowLeft size={15}/> Back to GoCity</Link></div>
      : !doc ? <p className="muted legal-loading">Loading…</p>
      : <div className="legal-layout" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <aside className="legal-toc"><p className="eyebrow">ON THIS PAGE</p><ol>{toc.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ol></aside>
        <article>
          <div className="legal-head"><span className="legal-icon"><Icon size={22}/></span><div><p className="eyebrow">LEGAL</p><h1>{doc.title}</h1><p className="legal-meta">Version {doc.version} · Effective {nice(doc.effectiveDate)}{!doc.isCurrent && <b> · Archived version</b>}</p></div><select className="legal-language" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language"><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></div>
          {versions.length > 1 && <label className="legal-versions">Version<select value={doc.version} onChange={(e) => showVersion(e.target.value)}>{versions.map((v) => <option key={v.version} value={v.version}>{v.version} · {nice(v.effectiveDate)}{v.isCurrent ? ' (current)' : ''}</option>)}</select></label>}
          {error && <p className="error">{error}</p>}
          <Markdown source={doc.content}/>
          <p className="legal-foot">See also our <Link to={OTHER[kind].to}>{OTHER[kind].label}</Link>.</p>
        </article>
      </div>}
  </main>;
}

/** "Privacy · Terms" links for footers. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return <nav className={`legal-links ${className}`} aria-label="Legal"><Link to="/privacy">Privacy</Link><span>·</span><Link to="/terms">Terms</Link></nav>;
}

/** Asks signed-in users to accept new versions of the terms / privacy policy. */
export function LegalBanner() {
  const [status, setStatus] = useState<LegalStatus | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [hidden, setHidden] = useState(false);
  useEffect(() => { api.legalStatus().then(setStatus).catch(() => {}); }, []);
  if (!status?.needsAcceptance || hidden) return null;
  const first = !status.terms.acceptedVersion && !status.privacy.acceptedVersion;
  const docs = [status.terms.needsAcceptance && <Link key="t" to="/terms" target="_blank">Terms of Use</Link>, status.privacy.needsAcceptance && <Link key="p" to="/privacy" target="_blank">Privacy Policy</Link>].filter(Boolean);
  const accept = async () => { setBusy(true); setError(''); try { setStatus(await api.acceptLegal()); } catch (e) { setError(apiError(e, 'Could not save. Please try again.')); } finally { setBusy(false); } };
  return <div className="legal-banner" role="region" aria-label="Updated terms"><ShieldCheck size={18}/><p>{first ? 'Please review and accept our ' : 'We updated our '}{docs.length === 2 ? <>{docs[0]} and {docs[1]}</> : docs[0]}{first ? '.' : '. Please review the changes.'}{error && <small className="error"> {error}</small>}</p><button className="primary compact" onClick={accept} disabled={busy}>{busy ? 'Saving…' : 'I accept'}</button><button className="legal-banner-close" onClick={() => setHidden(true)} aria-label="Remind me later"><X size={16}/></button></div>;
}
