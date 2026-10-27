import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, Gauge, Languages, MapPin, Package, Pencil, ShieldCheck, Sparkles, Tag, Users, X } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import { FavoriteButton, useFavoriteIds } from './Favorites';
import { ProgramCard, organizationName, programPrice, programStops } from './OrganizationPortal';
import type { OrganizationProgram, Trip, User } from './types';
import './program-detail.css';
import './program-cards.css';

const currentUser = (): User | null => { try { return JSON.parse(localStorage.getItem('gocity_user') || 'null'); } catch { return null; } };
const label = (value?: string | null) => (value ? value[0].toUpperCase() + value.slice(1) : '');

/** Big photo with thumbnails; Escape closes the full-screen view and the arrow keys move through photos. */
function Gallery({ program }: { program: OrganizationProgram }) {
  const images = program.images ?? []; const [index, setIndex] = useState(0); const [open, setOpen] = useState(false);
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, images.length]);
  if (!images.length) return <div className="program-hero-placeholder"><Sparkles size={40}/></div>;
  const current = images[Math.min(index, images.length - 1)];
  return <div className="program-gallery-main">
    <button type="button" className="gallery-stage" onClick={() => setOpen(true)} aria-label="Open photo full screen"><img src={assetUrl(current.url)} alt={`${program.title}, photo ${index + 1} of ${images.length}`}/></button>
    {images.length > 1 && <><button type="button" className="carousel-nav prev" onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft size={20}/></button><button type="button" className="carousel-nav next" onClick={() => go(1)} aria-label="Next photo"><ChevronRight size={20}/></button><span className="photo-count">{index + 1} / {images.length}</span></>}
    {images.length > 1 && <div className="gallery-thumbs">{images.map((image, i) => <button type="button" key={image.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`}><img src={assetUrl(image.url)} alt=""/></button>)}</div>}
    {open && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}><button type="button" className="lightbox-close" aria-label="Close"><X size={22}/></button><img src={assetUrl(current.url)} alt="" onClick={(e) => e.stopPropagation()}/>{images.length > 1 && <><button type="button" className="carousel-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo"><ChevronLeft size={24}/></button><button type="button" className="carousel-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo"><ChevronRight size={24}/></button></>}</div>}
  </div>;
}

const List = ({ title, items, icon }: { title: string; items?: string[] | null; icon: React.ReactNode }) => items?.length ? <div className="detail-list"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{icon}<span>{item}</span></li>)}</ul></div> : null;

/** POST /programs/:id/apply — the program's days start on the chosen trip day. */
function AddToPlan({ program }: { program: OrganizationProgram }) {
  const [trips, setTrips] = useState<Trip[] | null>(null); const [tripId, setTripId] = useState(''); const [day, setDay] = useState(1); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.myTrips().then((r) => setTrips(Array.isArray(r) ? r : r.items)).catch(() => setTrips([])); }, []);
  const trip = trips?.find((t) => String(t.id) === tripId); const lastStartDay = trip ? Math.max(1, trip.durationDays - program.durationDays + 1) : 1;
  const apply = async () => { setBusy(true); setMessage(null); try { const created = await api.applyProgram(program.id, Number(tripId), day, program.programType === 'activity' ? start || undefined : undefined, program.programType === 'activity' ? end || undefined : undefined); setMessage({ ok: true, text: `${created.length} item${created.length === 1 ? '' : 's'} added to ${trip?.name ?? 'your trip'}.` }); } catch (e) { setMessage({ ok: false, text: apiError(e) }); } finally { setBusy(false); } };
  return <div className="add-to-plan"><p className="eyebrow">ADD TO YOUR TRIP</p>
    {trips === null ? <p className="muted">Loading your trips…</p> : !trips.length ? <p className="muted">Create a trip first, then come back to add this program. <Link to="/create">Create a trip</Link></p> : <>
      <label>Trip<select value={tripId} onChange={(e) => { setTripId(e.target.value); setDay(1); }}><option value="">Choose one of your trips…</option>{trips.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.startDate}</option>)}</select></label>
      {trip && <label>Starting on day<select value={day} onChange={(e) => setDay(Number(e.target.value))}>{Array.from({ length: lastStartDay }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}</select></label>}
      {trip && program.programType === 'activity' && <div className="two"><label>Start <small>optional</small><input type="time" value={start} onChange={(e) => setStart(e.target.value)}/></label><label>End <small>optional</small><input type="time" value={end} onChange={(e) => setEnd(e.target.value)}/></label></div>}
      <button className="primary" disabled={!tripId || busy} onClick={apply}><Copy size={16}/>{busy ? 'Adding…' : 'Add to my plan'}</button></>}
    {message && <p className={message.ok ? 'org-message' : 'error'}>{message.ok && <Check size={15}/>}{message.text}</p>}
  </div>;
}

export function ProgramDetail() {
  // App mounts this page outside <Routes>, so useParams() is empty there; read the id from the URL as well.
  const params = useParams(); const { pathname } = useLocation(); const id = params.id ?? pathname.match(/\/programs\/(\d+)/)?.[1] ?? ''; const [program, setProgram] = useState<OrganizationProgram | null>(null); const [error, setError] = useState('');
  const saved = useFavoriteIds('program', [id]); const me = useMemo(currentUser, []);
  useEffect(() => { setProgram(null); setError(''); window.scrollTo({ top: 0 }); api.program(id).then(setProgram).catch((e) => setError(apiError(e, 'This program is no longer available.'))); }, [id]);
  if (error) return <section className="program-detail empty"><h2>Program unavailable</h2><p>{error}</p><Link className="primary compact" to="/programs">Back to programs</Link></section>;
  if (!program) return <section className="program-detail"><div className="detail-skeleton"/><div className="detail-skeleton short"/></section>;
  const entries = programStops(program); const org = organizationName(program); const price = programPrice(program); const isOwner = me?.id === program.organizationId;
  const days = entries.reduce<Record<number, typeof entries>>((groups, entry, i) => { const d = entry.dayNumber ?? i + 1; (groups[d] ??= []).push(entry); return groups; }, {});
  const facts = [
    price && { icon: <Tag size={16}/>, label: 'Price', value: `${price} per person` },
    { icon: <CalendarDays size={16}/>, label: 'Duration', value: `${program.durationDays} day${program.durationDays === 1 ? '' : 's'}` },
    program.maxGroupSize && { icon: <Users size={16}/>, label: 'Group size', value: `Up to ${program.maxGroupSize}` },
    program.languages?.length && { icon: <Languages size={16}/>, label: 'Languages', value: program.languages.join(', ') },
    program.difficulty && { icon: <Gauge size={16}/>, label: 'Difficulty', value: label(program.difficulty) },
    { icon: <MapPin size={16}/>, label: 'Destination', value: program.destination || 'Flexible' },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];
  const back = isOwner ? '/organization' : '/programs';
  return <section className="program-detail"><Link className="back-link" to={back}><ArrowLeft size={16}/> {isOwner ? 'Program studio' : 'All programs'}</Link>
    {isOwner && <div className="owner-banner"><span>{program.isPublished ? 'This is how travellers see your program.' : 'Draft: only you can see this program until you publish it.'}</span><Link className="secondary compact" to="/organization"><Pencil size={15}/> Edit in studio</Link></div>}
    <div className="program-hero"><Gallery program={program}/><div className="program-hero-copy"><p className="eyebrow">BY {org.toUpperCase()}{program.category ? ` · ${program.category.toUpperCase()}` : ''}</p><h1>{program.title}</h1><div className="program-facts"><span><MapPin size={15}/>{program.destination || 'Flexible location'}</span><span><CalendarDays size={15}/>{program.durationDays} day{program.durationDays === 1 ? '' : 's'}</span><span><Sparkles size={15}/>{program.programType === 'trip' ? `${entries.length} stops` : 'Single activity'}</span>{program.useCount > 0 && <span><Copy size={15}/>Added to {program.useCount} plan{program.useCount === 1 ? '' : 's'}</span>}</div>{price && <p className="hero-price">from <b>{price}</b> per person</p>}<FavoriteButton type="program" targetId={program.id} title={program.title} initial={saved.has(String(program.id))} label/></div></div>
    <div className="program-detail-grid"><article>
      {program.description && <section className="detail-section"><p className="eyebrow">ABOUT</p><p className="detail-description">{program.description}</p></section>}
      {program.highlights?.length ? <section className="detail-section"><p className="eyebrow">HIGHLIGHTS</p><ul className="highlights">{program.highlights.map((h) => <li key={h}><Sparkles size={15}/>{h}</li>)}</ul></section> : null}
      <section className="detail-section"><p className="eyebrow">{program.programType === 'trip' ? 'DAY BY DAY' : 'THE PLAN'}</p><h2>Your program</h2><div className="program-timeline">{Object.entries(days).map(([day, stops]) => <div key={day}>{program.programType === 'trip' && <h4 className="day-label">Day {day}</h4>}{stops.map((entry, index) => <div className="program-entry" key={`${entry.name}-${index}`}><b>{entry.startTime ? entry.startTime.slice(0, 5) : `STOP ${index + 1}`}</b><div><h3>{entry.name || 'Planned activity'}</h3>{entry.description && <p>{entry.description}</p>}<small>{entry.placeName && <><MapPin size={14}/>{entry.placeName}</>}{entry.startTime && <><Clock3 size={14}/>{entry.startTime.slice(0, 5)}{entry.endTime ? `–${entry.endTime.slice(0, 5)}` : ''}</>}{entry.expense ? <><Tag size={14}/>{new Intl.NumberFormat('en', { style: 'currency', currency: program.currency || 'EUR' }).format(entry.expense)}</> : null}</small></div></div>)}</div>)}</div></section>
      {(program.included?.length || program.excluded?.length) ? <section className="detail-section two-lists"><List title="What’s included" items={program.included} icon={<Check size={15} className="ok"/>}/><List title="Not included" items={program.excluded} icon={<Ban size={15} className="no"/>}/></section> : null}
      {program.whatToBring?.length ? <section className="detail-section"><List title="What to bring" items={program.whatToBring} icon={<Package size={15}/>}/></section> : null}
      {(program.meetingPoint || program.cancellationPolicy) && <section className="detail-section practical">{program.meetingPoint && <div><h3>Meeting point</h3><p><MapPin size={15}/>{program.meetingPoint}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(program.meetingPoint)}`} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={13}/></a></div>}{program.cancellationPolicy && <div><h3>Cancellation</h3><p><ShieldCheck size={15}/>{program.cancellationPolicy}</p></div>}</section>}
    </article>
    <aside><div className="facts-card">{facts.map((f) => <div key={f.label}>{f.icon}<span><small>{f.label}</small><b>{f.value}</b></span></div>)}</div>
      {!isOwner && <AddToPlan program={program}/>}
      {program.bookingUrl && <a className="secondary compact booking-link" href={program.bookingUrl} target="_blank" rel="noreferrer">Book or contact the partner <ExternalLink size={14}/></a>}
      <div className="partner-card"><p className="eyebrow">LOCAL PARTNER</p><div className="partner-head">{program.organization?.avatar?.url ? <img src={assetUrl(program.organization.avatar.url)} alt=""/> : <span className="partner-mark">{org.slice(0, 2).toUpperCase()}</span>}<div><h2>{org}</h2>{program.organization?.organizationLocationName && <small><MapPin size={13}/>{program.organization.organizationLocationName}</small>}</div></div><p>{program.organization?.organizationDescription || 'A trusted local organization sharing experiences for better trips.'}</p></div>
    </aside></div>
    {program.moreFromOrganization?.length ? <section className="more-programs"><p className="eyebrow">MORE FROM {org.toUpperCase()}</p><div className="public-program-grid">{program.moreFromOrganization.map((p) => <ProgramCard key={p.id} program={{ ...p, organization: program.organization }}/>)}</div></section> : null}
  </section>;
}
