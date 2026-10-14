import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Bell, CalendarDays, Check, ChevronRight, Compass, MapPin, Users, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import { enablePush } from './fcm';
import { subscribeToNotifications } from './realtime';
import type { AppNotification, Trip, User } from './types';
import './flow.css';

const slides = [
  { image: 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?auto=format&fit=crop&w=1500&q=85', title: 'Discover trips worth following.', text: 'Save the places and moments that make a journey feel like your own.' },
  { image: 'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1500&q=85', title: 'Make your journey, your way.', text: 'Build a shared plan, one thoughtful detail at a time.' },
  { image: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1500&q=85', title: 'Plan together, travel better.', text: 'Invite your people, vote on ideas and keep everyone in sync.' },
];

export function Splash() {
  const nav = useNavigate();
  useEffect(() => { const timer = window.setTimeout(() => nav('/onboarding', { replace: true }), 1400); return () => window.clearTimeout(timer); }, [nav]);
  return <main className="splash"><div><span>G</span><strong>GoCity</strong><small>Plan better. Travel together.</small></div></main>;
}

export function Welcome() {
  const [step, setStep] = useState(0); const nav = useNavigate(); const item = slides[step];
  const next = () => step === slides.length - 1 ? nav('/register') : setStep(step + 1);
  return <main className="welcome"><div className="welcome-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 25%, #103c61c9), url(${item.image})` }}><Link className="welcome-brand" to="/discover"><span>G</span> GoCity</Link><div className="welcome-copy"><div className="welcome-dots">{slides.map((_, i) => <i className={i === step ? 'active' : ''} key={i}/>)}</div><h1>{item.title}</h1><p>{item.text}</p><button onClick={next}>{step === slides.length - 1 ? 'Get started' : 'Continue'} <ChevronRight size={17}/></button><button className="welcome-skip" onClick={() => nav('/discover')}>Skip for now</button></div></div></main>;
}

export function Profile({ user, setUser }: { user: User; setUser: (user: User) => void }) {
  const [editing, setEditing] = useState(false); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { const updated = await api.updateMe({ firstName: String(form.get('firstName')), lastName: String(form.get('lastName')), organizationName: String(form.get('organizationName') || '') }); setUser(updated); localStorage.setItem('gocity_user', JSON.stringify(updated)); setEditing(false); setNotice('Your profile has been updated.'); } finally { setBusy(false); } };
  return <section className="profile-page"><div className="screen-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Keep your travel identity up to date.</p></div>{!editing && <button className="primary compact" onClick={() => setEditing(true)}>Edit profile</button>}</div><article className="profile-card"><div className="profile-hero"><div className="big-avatar">{user.firstName[0]}{user.lastName[0]}</div><div><h2>{user.firstName} {user.lastName}</h2><span>Traveller</span></div></div>{notice && <p className="flow-notice"><Check size={15}/>{notice}</p>}{editing ? <form className="profile-form" onSubmit={save}><label>First name<input name="firstName" defaultValue={user.firstName} required/></label><label>Last name<input name="lastName" defaultValue={user.lastName} required/></label><label>Email<input value={user.email || ''} disabled/></label><label>Organisation <input name="organizationName" defaultValue={user.organizationName || ''} placeholder="Optional"/></label><div><button type="button" className="outline-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form> : <div className="profile-details"><div><small>Email</small><b>{user.email || 'Not provided'}</b></div><div><small>Organisation</small><b>{user.organizationName || 'Personal traveller'}</b></div></div>}</article></section>;
}

export function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]); const [loading, setLoading] = useState(true); const [pushNotice, setPushNotice] = useState(''); const [testToken, setTestToken] = useState('');
  useEffect(() => { api.notifications().then(setItems).finally(() => setLoading(false)); return subscribeToNotifications((item) => setItems((current) => current.some((existing) => existing.id === item.id) ? current : [item, ...current])); }, []);
  const markAll = async () => { await api.markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))); };
  const markRead = async (item: AppNotification) => { if (item.readAt) return; await api.markNotificationRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); };
  const respondToInvite = async (item: AppNotification, accept: boolean) => { const invitationId = Number(item.data?.invitationId); if (!invitationId) return; if (accept) await api.acceptInvitation(invitationId); else await api.declineInvitation(invitationId); await markRead(item); };
  const activatePush = async () => { try { const token = await enablePush((message) => { const title = message.title || 'GoCity update'; const body = message.body || ''; if (Notification.permission === 'granted') new Notification(title, { body }); setItems((current) => [{ id: Date.now(), title, body, type: message.type || 'general', data: message.data || null, createdAt: new Date().toISOString() }, ...current]); }); if (!token) return setPushNotice('Push permission was not enabled, or Firebase is not configured yet.'); await api.registerDevice(token); setTestToken(token); setPushNotice('Push notifications are enabled for this browser.'); } catch (error: any) { setPushNotice(error?.code ? `Push setup failed: ${error.code}` : 'We could not enable push notifications in this browser.'); } };
  return <section className="notifications-page"><div className="screen-heading"><div><p className="eyebrow">STAY IN THE LOOP</p><h1>Notifications</h1></div><div className="notification-actions"><button className="outline-button" onClick={activatePush}>Enable push</button><button className="text-link" onClick={markAll}>Mark all as read</button></div></div>{pushNotice && <p className="flow-notice"><Check size={15}/>{pushNotice}{testToken && <button className="token-copy" onClick={() => navigator.clipboard.writeText(testToken)}>Copy test token</button>}</p>}<div className="notification-list">{loading ? <p className="muted">Loading notifications…</p> : items.length ? items.map((item) => <article className={item.readAt ? '' : 'unread'} key={item.id} onClick={() => markRead(item)}><span><Bell size={17}/></span><div><h3>{item.title}</h3><p>{item.body}</p><small>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</small>{item.type === 'trip_invitation' && item.data?.invitationId && <div className="notification-invite-actions"><button className="accept" onClick={(event) => { event.stopPropagation(); respondToInvite(item, true); }}><Check size={14}/> Accept</button><button className="decline" onClick={(event) => { event.stopPropagation(); respondToInvite(item, false); }}><X size={14}/> Decline</button></div>}</div></article>) : <div className="notifications-empty"><Bell size={22}/><h2>You’re all caught up.</h2><p>Trip invitations and group updates will appear here.</p></div>}</div></section>;
}

export function InviteJoin() {
  const { code = '' } = useParams(); const nav = useNavigate(); const [trip, setTrip] = useState<Trip | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.previewInvite(code).then((result) => setTrip(result.trip || result)).catch(() => setError('This invitation is no longer available.')); }, [code]);
  const join = async () => { setBusy(true); try { const result = await api.joinInvite(code); nav(`/trips/${result.tripId}`); } catch { setError('We could not join this trip. Please ask the organiser for a new link.'); } finally { setBusy(false); } };
  if (error) return <section className="invite-join"><Link to="/discover"><ArrowLeft size={16}/> Back to GoCity</Link><div className="join-card"><h1>Invitation unavailable</h1><p>{error}</p></div></section>;
  return <section className="invite-join"><Link to="/discover"><ArrowLeft size={16}/> Back to GoCity</Link><div className="join-card"><div className="join-cover" style={{ backgroundImage: `url(${trip?.coverUrl || 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=80'})` }}/><p className="eyebrow">YOU’RE INVITED</p><h1>{trip?.name || 'Loading your trip…'}</h1><p className="join-meta"><MapPin size={15}/>{trip?.city || 'A new destination'} <CalendarDays size={15}/>{trip?.startDate || 'Dates to be confirmed'} <Users size={15}/>{trip?.travelersCount || 1} travellers</p><p className="muted">Join the group to see the complete plan, add your ideas and help decide what comes next.</p><button className="primary" disabled={!trip || busy} onClick={join}>{busy ? 'Joining…' : 'Join this trip'} <ChevronRight size={17}/></button></div></section>;
}
