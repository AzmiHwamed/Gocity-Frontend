import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BarChart3, Building2, Check, Compass, ExternalLink, Eye, EyeOff, LayoutDashboard, Loader2, LogOut, Pencil, Plus, Search, ShieldCheck, Smartphone, Sparkles, Tags, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api, apiError, assetUrl, clearSession } from './api';
import type { AdminEsimPlan, AdminOverview, Interest, OrganizationProgram, Paged, Trip, User } from './types';
import './admin-dashboard.css';

type View = 'analytics' | 'users' | 'trips' | 'programs' | 'esims' | 'interests';
const VIEWS: { view: View; path: string; label: string; icon: typeof Users }[] = [
  { view: 'analytics', path: '/admin', label: 'Analytics', icon: LayoutDashboard },
  { view: 'users', path: '/admin/users', label: 'Users', icon: Users },
  { view: 'trips', path: '/admin/trips', label: 'Trips', icon: Compass },
  { view: 'programs', path: '/admin/programs', label: 'Programs', icon: Sparkles },
  { view: 'esims', path: '/admin/esims', label: 'eSIM plans', icon: Smartphone },
  { view: 'interests', path: '/admin/interests', label: 'Interests', icon: Tags },
];
const PAGE_SIZE = 20;
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const me = (): User | null => { try { return JSON.parse(localStorage.getItem('gocity_user') || 'null'); } catch { return null; } };

/** Debounced copy of a value, so typing in a search box doesn't fire a request per key. */
function useDebounced<T>(value: T, ms = 300) { const [v, setV] = useState(value); useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]); return v; }

function Pager({ meta, onPage }: { meta?: Paged<unknown>['meta']; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return <div className="admin-pager"><button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button><span>Page {meta.page} of {meta.totalPages} · {meta.total} total</span><button disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next</button></div>;
}
const Tabs = ({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) => <div className="admin-tabs">{options.map(([v, label]) => <button key={v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>{label}</button>)}</div>;
const Toolbar = ({ children }: { children: ReactNode }) => <div className="admin-toolbar">{children}</div>;
const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => <label className="admin-search"><Search size={16}/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>{value && <button onClick={() => onChange('')} aria-label="Clear search"><X size={14}/></button>}</label>;

function Analytics() {
  const [overview, setOverview] = useState<AdminOverview | null>(null); const [programs, setPrograms] = useState<OrganizationProgram[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { api.adminOverview().then(setOverview).catch((e) => setError(apiError(e, 'Could not load administration data.'))); api.adminPrograms().then(setPrograms).catch(() => setPrograms([])); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!overview) return <p className="muted"><Loader2 className="spin" size={14}/> Loading analytics…</p>;
  const published = programs?.filter((p) => p.isPublished).length ?? 0; const uses = programs?.reduce((s, p) => s + p.useCount, 0) ?? 0;
  const cards = [
    { label: 'Users', value: overview.users, note: `${overview.newUsers30d ?? 0} new in 30 days`, icon: Users, to: '/admin/users' },
    { label: 'Agencies', value: overview.agencies, note: 'organization accounts', icon: Building2, to: '/admin/users' },
    { label: 'Trips', value: overview.trips, note: `${overview.newTrips30d ?? 0} new in 30 days`, icon: Compass, to: '/admin/trips' },
    { label: 'Programs', value: programs?.length ?? '…', note: `${published} published · ${uses} uses`, icon: Sparkles, to: '/admin/programs' },
  ];
  const roles = [['Travellers', overview.travellers], ['Agencies', overview.agencies], ['Admins', overview.admins]] as const;
  const visibility = [['Public', overview.publicTrips], ['Link only', overview.linkTrips ?? 0], ['Private', Math.max(0, overview.trips - overview.publicTrips - (overview.linkTrips ?? 0))]] as const;
  const bar = (rows: readonly (readonly [string, number])[], total: number) => <div className="admin-bars">{rows.map(([label, n]) => <div key={label}><span>{label}</span><i><b style={{ width: `${total ? (n / total) * 100 : 0}%` }}/></i><strong>{n}</strong></div>)}</div>;
  return <><p className="muted">A live view of GoCity’s community and publishing activity.</p>
    <div className="admin-metrics">{cards.map(({ label, value, note, icon: Icon, to }) => <Link to={to} key={label}><article><span><Icon size={19}/></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article></Link>)}</div>
    <div className="admin-panels"><section className="admin-panel"><h3>Accounts by role</h3>{bar(roles, overview.users)}{(overview.disabledUsers ?? 0) > 0 && <p className="muted">{overview.disabledUsers} account{overview.disabledUsers === 1 ? ' is' : 's are'} disabled.</p>}</section>
      <section className="admin-panel"><h3>Trips by visibility</h3>{bar(visibility, overview.trips)}<p className="muted">{overview.publicTrips} of {overview.trips} trips are discoverable to signed-in travellers.</p></section>
      <section className="admin-panel"><h3>Most used programs</h3>{programs === null ? <p className="muted">Loading…</p> : programs.length ? <ol className="admin-rank">{[...programs].sort((a, b) => b.useCount - a.useCount).slice(0, 5).map((p) => <li key={p.id}><Link to={`/programs/${p.id}`}>{p.title}</Link><small>{p.useCount} use{p.useCount === 1 ? '' : 's'}</small></li>)}</ol> : <p className="muted">No programs yet.</p>}</section></div>
  </>;
}

function UsersView() {
  const [query, setQuery] = useState(''); const search = useDebounced(query); const [role, setRole] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<User> | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState<number | null>(null); const [creating, setCreating] = useState(false);
  const self = me()?.id;
  const load = () => api.adminUsers({ page, limit: PAGE_SIZE, search: search.trim() || undefined, role: role || undefined }).then(setData).catch((e) => setError(apiError(e, 'Could not load users.')));
  useEffect(() => { setPage(1); }, [search, role]);
  useEffect(() => { setError(''); load(); }, [search, role, page]);
  const update = async (user: User, input: Partial<Pick<User, 'isActive' | 'role' | 'organizationName'>>) => { setBusy(user.id); setError(''); try { const updated = await api.adminUpdateUser(user.id, input); setData((d) => d && { ...d, items: d.items.map((u) => (u.id === user.id ? { ...u, ...updated } : u)) }); } catch (e) { setError(apiError(e, 'Could not update this user.')); } finally { setBusy(null); } };
  const remove = async (user: User) => { if (!confirm(`Delete ${user.organizationName || `${user.firstName} ${user.lastName}`}? Their account is removed and they can no longer sign in.`)) return; setBusy(user.id); try { await api.adminDeleteUser(user.id); await load(); } catch (e) { setError(apiError(e, 'Could not delete this user.')); } finally { setBusy(null); } };
  return <>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search by name, organization or email"/><Tabs value={role} onChange={setRole} options={[['', 'All'], ['user', 'Travellers'], ['organization', 'Agencies'], ['admin', 'Admins']]}/><button className="primary compact" onClick={() => setCreating(true)}><UserPlus size={15}/> Add user</button></Toolbar>
    {error && <p className="error">{error}</p>}
    <div className="admin-table users"><div className="admin-table-head"><span>Account</span><span>Role</span><span>Joined</span><span>Status</span><span/></div>
      {!data ? <p className="muted"><Loader2 className="spin" size={14}/> Loading users…</p> : data.items.map((user) => <article key={user.id}>
        <div className="admin-person">{user.avatar?.url ? <img src={assetUrl(user.avatar.url)} alt=""/> : <span>{(user.organizationName || user.firstName || '?')[0]}{user.organizationName ? '' : user.lastName?.[0] ?? ''}</span>}<div><b>{user.organizationName || `${user.firstName} ${user.lastName}`}{user.id === self && <em> (you)</em>}</b><small>{user.email}</small></div></div>
        <select className="admin-role-select" value={user.role || 'user'} disabled={busy === user.id || user.id === self} onChange={(e) => { const next = e.target.value as User['role']; if (!confirm(`Change this account’s role to “${next}”?`)) return; // Agencies need a public name; ask for one when the account doesn't have it yet.
          if (next === 'organization' && !user.organizationName) { const organizationName = prompt('Agency name shown to travellers:', `${user.firstName} ${user.lastName}`)?.trim(); if (!organizationName) return; update(user, { role: next, organizationName }); } else update(user, { role: next }); }}><option value="user">Traveller</option><option value="organization">Agency</option><option value="admin">Admin</option></select>
        <span>{date(user.createdAt)}</span>
        <span className={user.isActive ? 'admin-status live' : 'admin-status'}>{user.isActive ? 'Active' : 'Disabled'}</span>
        <span className="admin-row-actions">{user.id !== self && <><button onClick={() => update(user, { isActive: !user.isActive })} disabled={busy === user.id}>{user.isActive ? 'Disable' : 'Enable'}</button><button className="danger" onClick={() => remove(user)} disabled={busy === user.id} aria-label="Delete user"><Trash2 size={14}/></button></>}</span>
      </article>)}
      {data && !data.items.length && <p className="muted">No users match.</p>}</div>
    <Pager meta={data?.meta} onPage={setPage}/>
    {creating && <CreateUser onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }}/>}
  </>;
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [role, setRole] = useState('user'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget); const input: Record<string, string> = {}; f.forEach((v, k) => { if (String(v).trim()) input[k] = String(v).trim(); }); setBusy(true); setError(''); try { await api.adminCreateUser(input); onCreated(); } catch (e) { setError(apiError(e, 'Could not create this user.')); setBusy(false); } };
  return <div className="admin-modal" onClick={onClose}><form onClick={(e) => e.stopPropagation()} onSubmit={submit}><header><h3>Add a user</h3><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
    <label>Role<select name="role" value={role} onChange={(e) => setRole(e.target.value)}><option value="user">Traveller</option><option value="organization">Agency</option><option value="admin">Admin</option></select></label>
    <div className="two"><label>First name<input name="firstName" required/></label><label>Last name<input name="lastName" required/></label></div>
    {role === 'organization' && <label>Organization name<input name="organizationName" required/></label>}
    <label>Email<input name="email" type="email" required/></label>
    <label>Temporary password<input name="password" type="password" minLength={8} required/></label>
    {error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? <Loader2 className="spin" size={15}/> : <UserPlus size={15}/>} Create account</button></form></div>;
}

function TripsView() {
  const [query, setQuery] = useState(''); const search = useDebounced(query); const [visibility, setVisibility] = useState(''); const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Trip> | null>(null); const [error, setError] = useState('');
  useEffect(() => { setPage(1); }, [search, visibility]);
  useEffect(() => { setError(''); api.adminTrips({ page, limit: PAGE_SIZE, search: search.trim() || undefined, visibility: visibility || undefined }).then(setData).catch((e) => setError(apiError(e, 'Could not load trips.'))); }, [search, visibility, page]);
  return <>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search trips, cities or owners"/><Tabs value={visibility} onChange={setVisibility} options={[['', 'All'], ['public', 'Public'], ['link', 'Link only'], ['private', 'Private']]}/></Toolbar>
    {error && <p className="error">{error}</p>}
    <div className="admin-table trips"><div className="admin-table-head"><span>Trip</span><span>Owner</span><span>Visibility</span><span>Dates</span><span/></div>
      {!data ? <p className="muted"><Loader2 className="spin" size={14}/> Loading trips…</p> : data.items.map((trip) => <article key={trip.id}>
        <div><b>{trip.name}</b><small>{trip.city || 'Destination not set'} · {trip.durationDays} day{trip.durationDays === 1 ? '' : 's'} · {trip.travelersCount} traveller{trip.travelersCount === 1 ? '' : 's'}</small></div>
        <span>{trip.owner ? <>{trip.owner.firstName} {trip.owner.lastName}<small className="block">{trip.owner.email}</small></> : 'Unknown'}</span>
        <span className={`admin-role vis-${trip.visibility || 'private'}`}>{trip.visibility || 'private'}</span>
        <span>{date(trip.startDate)}<small className="block">to {date(trip.endDate)}</small></span>
        <span className="admin-row-actions">{trip.visibility === 'public' && <Link to={`/experiences/${trip.id}`} title="Open public page"><ExternalLink size={14}/></Link>}</span>
      </article>)}
      {data && !data.items.length && <p className="muted">No trips match.</p>}</div>
    <Pager meta={data?.meta} onPage={setPage}/>
  </>;
}

function ProgramsView() {
  const [programs, setPrograms] = useState<OrganizationProgram[] | null>(null); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState<number | null>(null);
  const load = () => api.adminPrograms().then(setPrograms).catch((e) => setError(apiError(e, 'Could not load programs.')));
  useEffect(() => { load(); }, []);
  const shown = (programs ?? []).filter((p) => (!status || (status === 'published') === p.isPublished) && `${p.title} ${p.destination ?? ''} ${p.organization?.organizationName ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = async (p: OrganizationProgram) => { setBusy(p.id); try { await api.adminSetProgramPublished(p.id, !p.isPublished); setPrograms((list) => list?.map((x) => (x.id === p.id ? { ...x, isPublished: !p.isPublished } : x)) ?? null); } catch (e) { setError(apiError(e)); } finally { setBusy(null); } };
  const remove = async (p: OrganizationProgram) => { if (!confirm(`Delete “${p.title}” and its photos? The organization will lose it.`)) return; setBusy(p.id); try { await api.adminDeleteProgram(p.id); setPrograms((list) => list?.filter((x) => x.id !== p.id) ?? null); } catch (e) { setError(apiError(e)); } finally { setBusy(null); } };
  return <>
    <Toolbar><SearchBox value={query} onChange={setQuery} placeholder="Search programs, places or agencies"/><Tabs value={status} onChange={setStatus} options={[['', 'All'], ['published', 'Published'], ['draft', 'Drafts']]}/></Toolbar>
    {error && <p className="error">{error}</p>}
    <div className="admin-table programs"><div className="admin-table-head"><span>Program</span><span>Agency</span><span>Status</span><span>Uses</span><span/></div>
      {!programs ? <p className="muted"><Loader2 className="spin" size={14}/> Loading programs…</p> : shown.map((p) => <article key={p.id}>
        <div className="admin-person">{p.images?.[0] ? <img src={assetUrl(p.images[0].url)} alt=""/> : <span><Sparkles size={15}/></span>}<div><b>{p.title}</b><small>{p.programType === 'trip' ? 'Itinerary' : 'Activity'} · {p.destination || 'Flexible'} · {p.durationDays} day{p.durationDays === 1 ? '' : 's'}</small></div></div>
        <span>{p.organization?.organizationName || p.organization?.firstName || '—'}</span>
        <span className={p.isPublished ? 'admin-status live' : 'admin-status'}>{p.isPublished ? 'Published' : 'Draft'}</span>
        <span>{p.useCount}</span>
        <span className="admin-row-actions"><Link to={`/programs/${p.id}`} title="View"><ExternalLink size={14}/></Link><button onClick={() => toggle(p)} disabled={busy === p.id} title={p.isPublished ? 'Unpublish' : 'Publish'}>{p.isPublished ? <EyeOff size={14}/> : <Eye size={14}/>}</button><button className="danger" onClick={() => remove(p)} disabled={busy === p.id} aria-label="Delete program"><Trash2 size={14}/></button></span>
      </article>)}
      {programs && !shown.length && <p className="muted">No programs match.</p>}</div>
  </>;
}

const emptyPlan = { countryCode: '', provider: 'Airalo', title: '', dataMb: '', isUnlimited: false, validityDays: '7', price: '', currency: 'USD', url: '', notes: '', isActive: true };
type PlanForm = typeof emptyPlan;
function EsimsView() {
  const [plans, setPlans] = useState<AdminEsimPlan[] | null>(null); const [country, setCountry] = useState(''); const [error, setError] = useState(''); const [editing, setEditing] = useState<{ id?: number; form: PlanForm } | null>(null); const [busy, setBusy] = useState(false);
  const filter = useDebounced(country.trim().toUpperCase());
  const load = () => api.adminEsimPlans(filter.length === 2 ? filter : undefined).then(setPlans).catch((e) => setError(apiError(e, 'Could not load eSIM plans.')));
  useEffect(() => { load(); }, [filter]);
  const toForm = (p: AdminEsimPlan): PlanForm => ({ countryCode: p.countryCode, provider: p.provider, title: p.title, dataMb: p.dataMb == null ? '' : String(p.dataMb), isUnlimited: p.isUnlimited, validityDays: String(p.validityDays), price: String(p.price), currency: p.currency, url: p.url, notes: p.notes ?? '', isActive: p.isActive });
  const save = async (event: FormEvent) => { event.preventDefault(); if (!editing) return; const f = editing.form; const input = { countryCode: f.countryCode.toUpperCase(), provider: f.provider, title: f.title, isUnlimited: f.isUnlimited, dataMb: f.isUnlimited || !f.dataMb ? null : Number(f.dataMb), validityDays: Number(f.validityDays), price: Number(f.price), currency: f.currency.toUpperCase(), url: f.url, notes: f.notes || null, isActive: f.isActive }; setBusy(true); setError(''); try { if (editing.id) await api.adminUpdateEsimPlan(editing.id, input); else await api.adminCreateEsimPlan(input); setEditing(null); await load(); } catch (e) { setError(apiError(e, 'Could not save this plan.')); } finally { setBusy(false); } };
  const remove = async (p: AdminEsimPlan) => { if (!confirm(`Delete “${p.title}”?`)) return; try { await api.adminDeleteEsimPlan(p.id); setPlans((list) => list?.filter((x) => x.id !== p.id) ?? null); } catch (e) { setError(apiError(e)); } };
  const toggle = async (p: AdminEsimPlan) => { try { const updated = await api.adminUpdateEsimPlan(p.id, { isActive: !p.isActive }); setPlans((list) => list?.map((x) => (x.id === p.id ? { ...x, ...updated } : x)) ?? null); } catch (e) { setError(apiError(e)); } };
  const set = (patch: Partial<PlanForm>) => setEditing((e) => e && { ...e, form: { ...e.form, ...patch } });
  return <>
    <p className="muted">Plans listed here appear on the Booking page as “Listed by GoCity” for countries where the partner API has no live plans.</p>
    <Toolbar><SearchBox value={country} onChange={setCountry} placeholder="Filter by country code, e.g. PT"/><button className="primary compact" onClick={() => setEditing({ form: { ...emptyPlan, countryCode: filter.length === 2 ? filter : '' } })}><Plus size={15}/> Add plan</button></Toolbar>
    {error && <p className="error">{error}</p>}
    <div className="admin-table esims"><div className="admin-table-head"><span>Plan</span><span>Data · validity</span><span>Price</span><span>Status</span><span/></div>
      {!plans ? <p className="muted"><Loader2 className="spin" size={14}/> Loading plans…</p> : plans.map((p) => <article key={p.id}>
        <div><b>{p.countryCode} · {p.title}</b><small>{p.provider}{p.notes ? ` · ${p.notes}` : ''} · updated {date(p.updatedAt)}</small></div>
        <span>{p.isUnlimited ? 'Unlimited' : p.dataMb ? (p.dataMb >= 1024 ? `${+(p.dataMb / 1024).toFixed(1)} GB` : `${p.dataMb} MB`) : '—'} · {p.validityDays} days</span>
        <span>{new Intl.NumberFormat('en', { style: 'currency', currency: p.currency }).format(p.price)}</span>
        <span className={p.isActive ? 'admin-status live' : 'admin-status'}>{p.isActive ? 'Shown' : 'Hidden'}</span>
        <span className="admin-row-actions"><a href={p.url} target="_blank" rel="noreferrer" title="Open partner page"><ExternalLink size={14}/></a><button onClick={() => toggle(p)} title={p.isActive ? 'Hide' : 'Show'}>{p.isActive ? <EyeOff size={14}/> : <Eye size={14}/>}</button><button onClick={() => setEditing({ id: p.id, form: toForm(p) })} title="Edit"><Pencil size={14}/></button><button className="danger" onClick={() => remove(p)} aria-label="Delete plan"><Trash2 size={14}/></button></span>
      </article>)}
      {plans && !plans.length && <p className="muted">No plans listed{filter.length === 2 ? ` for ${filter}` : ''} yet.</p>}</div>
    {editing && <div className="admin-modal" onClick={() => setEditing(null)}><form onClick={(e) => e.stopPropagation()} onSubmit={save}><header><h3>{editing.id ? 'Edit eSIM plan' : 'Add an eSIM plan'}</h3><button type="button" onClick={() => setEditing(null)} aria-label="Close"><X size={18}/></button></header>
      <div className="two"><label>Country code<input required maxLength={2} pattern="[A-Za-z]{2}" value={editing.form.countryCode} onChange={(e) => set({ countryCode: e.target.value.toUpperCase() })} placeholder="PT"/></label><label>Provider<input required minLength={2} maxLength={60} value={editing.form.provider} onChange={(e) => set({ provider: e.target.value })}/></label></div>
      <label>Title<input required minLength={2} maxLength={120} value={editing.form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Portugal 5 GB"/></label>
      <div className="two"><label>Data (MB)<input type="number" min={1} disabled={editing.form.isUnlimited} value={editing.form.dataMb} onChange={(e) => set({ dataMb: e.target.value })} placeholder="5120"/></label><label className="admin-check"><input type="checkbox" checked={editing.form.isUnlimited} onChange={(e) => set({ isUnlimited: e.target.checked })}/> Unlimited data</label></div>
      <div className="three"><label>Valid (days)<input type="number" required min={1} max={365} value={editing.form.validityDays} onChange={(e) => set({ validityDays: e.target.value })}/></label><label>Price<input type="number" required min={0} step="0.01" value={editing.form.price} onChange={(e) => set({ price: e.target.value })}/></label><label>Currency<input required maxLength={3} value={editing.form.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })}/></label></div>
      <label>Partner link (https)<input type="url" required pattern="https://.*" value={editing.form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://www.airalo.com/portugal-esim"/></label>
      <label>Notes<input maxLength={255} value={editing.form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Data only · 5G where available"/></label>
      <label className="admin-check"><input type="checkbox" checked={editing.form.isActive} onChange={(e) => set({ isActive: e.target.checked })}/> Show to travellers</label>
      <button className="primary" disabled={busy}>{busy ? <Loader2 className="spin" size={15}/> : <Check size={15}/>} Save plan</button></form></div>}
  </>;
}

function InterestsView() {
  const [items, setItems] = useState<Interest[] | null>(null); const [name, setName] = useState(''); const [editing, setEditing] = useState<{ id: number; name: string } | null>(null); const [error, setError] = useState('');
  useEffect(() => { api.interests().then(setItems).catch((e) => setError(apiError(e, 'Could not load interests.'))); }, []);
  const add = async (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; try { const created = await api.createInterest(name.trim()); setItems((list) => [...(list ?? []), created].sort((a, b) => a.name.localeCompare(b.name))); setName(''); } catch (e) { setError(apiError(e)); } };
  const rename = async (event: FormEvent) => { event.preventDefault(); if (!editing?.name.trim()) return; try { const updated = await api.updateInterest(editing.id, editing.name.trim()); setItems((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null); setEditing(null); } catch (e) { setError(apiError(e)); } };
  const remove = async (interest: Interest) => { if (!confirm(`Delete the interest “${interest.name}”? Travellers who picked it will lose it.`)) return; try { await api.deleteInterest(interest.id); setItems((list) => list?.filter((x) => x.id !== interest.id) ?? null); } catch (e) { setError(apiError(e)); } };
  return <>
    <p className="muted">Travellers pick these on their profile; they power trip recommendations.</p>
    <form className="admin-inline-form" onSubmit={add}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New interest, e.g. Street food" maxLength={60}/><button className="primary compact"><Plus size={15}/> Add</button></form>
    {error && <p className="error">{error}</p>}
    {!items ? <p className="muted"><Loader2 className="spin" size={14}/> Loading…</p> : <div className="admin-chips">{items.map((interest) => editing?.id === interest.id ? <form key={interest.id} className="admin-chip editing" onSubmit={rename}><input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}/><button aria-label="Save"><Check size={13}/></button><button type="button" onClick={() => setEditing(null)} aria-label="Cancel"><X size={13}/></button></form> : <span key={interest.id} className="admin-chip">{interest.name}<button onClick={() => setEditing({ id: interest.id, name: interest.name })} aria-label={`Rename ${interest.name}`}><Pencil size={12}/></button><button className="danger" onClick={() => remove(interest)} aria-label={`Delete ${interest.name}`}><Trash2 size={12}/></button></span>)}{!items.length && <p className="muted">No interests yet.</p>}</div>}
  </>;
}

export function AdminDashboard() {
  const { pathname } = useLocation();
  const current = VIEWS.find((v) => v.path !== '/admin' && pathname.startsWith(v.path)) ?? VIEWS[0];
  const user = me();
  return <main className="admin-dashboard"><aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><b>Go</b>City <span>Admin</span></Link><p>WORKSPACE</p>
      {VIEWS.map(({ view, path, label, icon: Icon }) => <Link key={view} className={current.view === view ? 'active' : ''} to={path}><Icon size={17}/> {label}</Link>)}
      <div className="admin-sidebar-bottom"><Link to="/trips"><Compass size={16}/> Open the app</Link><button onClick={() => { clearSession(); window.location.assign('/login'); }}><LogOut size={16}/> Sign out</button></div></aside>
    <section className="admin-content"><header><div><p className="eyebrow">PLATFORM ADMINISTRATION</p><h1>{current.view === 'analytics' ? 'Analytics' : current.label}</h1></div><span className="admin-profile"><ShieldCheck size={16}/> {user ? `${user.firstName} ${user.lastName}` : 'Administrator'}</span></header>
      {current.view === 'analytics' && <Analytics/>}{current.view === 'users' && <UsersView/>}{current.view === 'trips' && <TripsView/>}{current.view === 'programs' && <ProgramsView/>}{current.view === 'esims' && <EsimsView/>}{current.view === 'interests' && <InterestsView/>}
      <p className="muted admin-foot"><BarChart3 size={13}/> Changes here apply immediately for everyone.</p>
    </section></main>;
}
