import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, Check, Clock3, Copy, Eye, EyeOff, Image as ImageIcon, MapPin, Pencil, Plus, Search, Sparkles, Trash2, Users } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import type { OrganizationAnalytics, OrganizationProgram, ProgramStop, Trip } from './types';
import { ProgramEditor } from './ProgramEditor';
import './organization.css';
import './program-cards.css';

export const programPrice = (program: OrganizationProgram) => program.price == null ? null : new Intl.NumberFormat('en', { style: 'currency', currency: program.currency || 'EUR', maximumFractionDigits: program.price % 1 ? 2 : 0 }).format(program.price);
export const programStops = (program: OrganizationProgram) => (Array.isArray(program.content) ? program.content : [program.content]) as ProgramStop[];
export const organizationName = (program: OrganizationProgram) => program.organization?.organizationName || program.organization?.firstName || 'Local partner';
const cover = (program: OrganizationProgram) => program.images?.[0];

export function OrganizationDashboard() {
  const [programs, setPrograms] = useState<OrganizationProgram[] | null>(null); const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null); const [error, setError] = useState(''); const [editing, setEditing] = useState<OrganizationProgram | null>(null); const [busy, setBusy] = useState<number | null>(null);
  const load = () => Promise.all([api.organizationPrograms(), api.organizationAnalytics()]).then(([p, a]) => { setPrograms(p); setAnalytics(a); }).catch((e) => setError(apiError(e)));
  useEffect(() => { load(); }, []);
  const saved = () => { setEditing(null); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const togglePublish = async (program: OrganizationProgram) => { setBusy(program.id); try { await api.updateOrganizationProgram(program.id, { isPublished: !program.isPublished }); await load(); } catch (e) { setError(apiError(e)); } finally { setBusy(null); } };
  const remove = async (program: OrganizationProgram) => { if (!confirm(`Delete “${program.title}” and its photos? This cannot be undone.`)) return; setBusy(program.id); try { await api.deleteOrganizationProgram(program.id); if (editing?.id === program.id) setEditing(null); await load(); } catch (e) { setError(apiError(e)); } finally { setBusy(null); } };
  return <section className="organization-page"><div className="topline"><div><p className="eyebrow">ORGANIZATION STUDIO</p><h1>Programs that travellers can use.</h1><p className="muted">Publish individual activities or curated itineraries with photos and details, then see how often they make it into a plan.</p></div>{editing && <button className="primary compact" onClick={() => setEditing(null)}><Plus size={16}/> New program</button>}</div>
    {analytics && <div className="org-stats"><Metric label="Programs" value={analytics.totalPrograms}/><Metric label="Published" value={analytics.publishedPrograms}/><Metric label="Added to plans" value={analytics.totalUses}/><Metric label="Itineraries" value={analytics.tripPrograms}/></div>}
    {error && <p className="error">{error}</p>}
    <div className="org-layout"><ProgramEditor program={editing} onSaved={saved} onCancel={editing ? () => setEditing(null) : undefined}/>
      <section className="program-list"><div className="section-head"><div><p className="eyebrow">YOUR LIBRARY</p><h2>Programs</h2></div><span>{programs?.length ?? 0} total</span></div>
        {programs === null ? <p className="muted">Loading your programs…</p> : programs.length ? programs.map((program) => <article className={`program-card studio-card ${editing?.id === program.id ? 'is-editing' : ''}`} key={program.id}>
          <div className="studio-thumb">{cover(program) ? <img src={assetUrl(cover(program)!.url)} alt=""/> : <ImageIcon size={22}/>}{(program.images?.length ?? 0) > 1 && <small>{program.images!.length} photos</small>}</div>
          <div className="studio-body"><div className="studio-meta"><span className={program.isPublished ? 'program-status live' : 'program-status'}>{program.isPublished ? 'Published' : 'Draft'}</span><span className="program-kind">{program.programType === 'trip' ? 'ITINERARY' : 'ACTIVITY'}</span>{program.category && <span className="program-kind soft">{program.category}</span>}</div>
            <h3>{program.title}</h3><p>{program.description || 'No description yet.'}</p>
            <footer><span>{program.destination || 'Flexible destination'} · {program.durationDays} day{program.durationDays === 1 ? '' : 's'}{programPrice(program) ? ` · ${programPrice(program)}` : ''}</span><b><Copy size={14}/>{program.useCount} uses</b></footer>
            <div className="studio-actions"><Link to={`/programs/${program.id}`}><Eye size={15}/> View</Link><button onClick={() => { setEditing(program); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={15}/> Edit</button><button onClick={() => togglePublish(program)} disabled={busy === program.id}>{program.isPublished ? <><EyeOff size={15}/> Unpublish</> : <><Check size={15}/> Publish</>}</button><button className="danger" onClick={() => remove(program)} disabled={busy === program.id}><Trash2 size={15}/> Delete</button></div>
          </div></article>) : <div className="empty"><div className="empty-icon"><Sparkles/></div><h2>Your library is empty.</h2><p>Create the first activity or itinerary for travellers.</p></div>}
      </section></div></section>;
}
const Metric = ({ label, value }: { label: string; value: number }) => <article><BarChart3 size={18}/><div><small>{label}</small><strong>{value}</strong></div></article>;

/** One published program as a card; the photo, the title and "View details" all open the detail page. */
export function ProgramCard({ program, footer }: { program: OrganizationProgram; footer?: ReactNode }) {
  const first = programStops(program)[0] ?? {}; const price = programPrice(program);
  return <article className="program-card public program-apply-card">
    <Link to={`/programs/${program.id}`} className="program-cover">{cover(program) ? <img src={assetUrl(cover(program)!.url)} alt={program.title}/> : <div className="program-cover-placeholder"><Sparkles size={28}/></div>}<span className="program-kind">{program.programType === 'trip' ? 'ITINERARY' : 'ACTIVITY'}</span>{price && <b className="program-price">from {price}</b>}</Link>
    <div className="program-card-top"><span className="partner-mark">{organizationName(program).slice(0, 2).toUpperCase()}</span><div><p className="eyebrow">{organizationName(program).toUpperCase()}</p><small>{program.category || 'Curated experience'}</small></div></div>
    <Link to={`/programs/${program.id}`}><h3>{program.title}</h3></Link><p className="clamp-3">{program.description || 'A local recommendation tailored for your itinerary.'}</p>
    <div className="program-facts"><span><MapPin size={14}/>{program.destination || first.placeName || 'Flexible location'}</span><span><CalendarDays size={14}/>{program.durationDays} day{program.durationDays === 1 ? '' : 's'}</span>{program.programType === 'activity' && first.startTime && <span><Clock3 size={14}/>{first.startTime.slice(0, 5)}–{first.endTime?.slice(0, 5)}</span>}{program.maxGroupSize && <span><Users size={14}/>Up to {program.maxGroupSize}</span>}</div>
    <Link className="view-details" to={`/programs/${program.id}`}>View details <ArrowRight size={15}/></Link>
    {footer}
  </article>;
}

export function ProgramsPage() {
  const [programs, setPrograms] = useState<OrganizationProgram[] | null>(null); const [trips, setTrips] = useState<Trip[]>([]); const [target, setTarget] = useState<Record<number, string>>({}); const [message, setMessage] = useState(''); const [query, setQuery] = useState(''); const [category, setCategory] = useState(''); const [kind, setKind] = useState('');
  useEffect(() => { api.publishedPrograms().then(setPrograms).catch(() => { setPrograms([]); setMessage('Programs are not available right now.'); }); api.myTrips().then((result) => setTrips(Array.isArray(result) ? result : result.items)).catch(() => {}); }, []);
  const categories = useMemo(() => [...new Set((programs ?? []).map((p) => p.category).filter(Boolean) as string[])].sort(), [programs]);
  const shown = (programs ?? []).filter((p) => (!category || p.category === category) && (!kind || p.programType === kind) && (!query.trim() || `${p.title} ${p.description ?? ''} ${p.destination ?? ''} ${organizationName(p)}`.toLowerCase().includes(query.trim().toLowerCase())));
  const apply = async (program: OrganizationProgram) => { const tripId = Number(target[program.id]); if (!tripId) return setMessage('Choose a trip first.'); try { const created = await api.applyProgram(program.id, tripId); setMessage(`${created.length} item${created.length === 1 ? '' : 's'} added to your trip.`); } catch (e) { setMessage(apiError(e)); } };
  return <section className="organization-page"><div className="topline"><div><p className="eyebrow">ORGANIZATION PROGRAMS</p><h1>Make a trip feel local.</h1><p className="muted">Choose a trusted local experience, open it to see every detail, then place it exactly where it belongs in your trip.</p></div></div>
    <div className="program-filters"><label className="program-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, city or partner"/></label><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option><option value="activity">Activities</option><option value="trip">Itineraries</option></select>{categories.length > 0 && <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>}</div>
    {message && <p className="org-message"><Check size={16}/>{message}</p>}
    {programs === null ? <p className="muted">Loading programs…</p> : shown.length ? <div className="public-program-grid">{shown.map((program) => { const selectedTrip = trips.find((trip) => String(trip.id) === target[program.id]); return <ProgramCard key={program.id} program={program} footer={<><label className="trip-choice">Add to<select value={target[program.id] || ''} onChange={(e) => setTarget({ ...target, [program.id]: e.target.value })}><option value="">Select one of your trips…</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name} · {trip.startDate}</option>)}</select></label>{selectedTrip && <p className="selected-trip"><Check size={13}/> Will be added to <b>{selectedTrip.name}</b></p>}<button className="primary compact" disabled={!target[program.id]} onClick={() => apply(program)}><Copy size={15}/> Add to my plan <ArrowRight size={15}/></button></>}/>; })}</div> : <div className="empty"><div className="empty-icon"><Sparkles/></div><h2>{programs.length ? 'No programs match these filters.' : 'No programs published yet.'}</h2></div>}
  </section>;
}
