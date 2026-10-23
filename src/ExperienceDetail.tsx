import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bed, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, Film, Footprints, Images, Lightbulb, MapPin, Sparkles, TrainFront, Car, Users, Wallet, X } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import type { Activity, GalleryItem, Trip, User } from './types';
import { FavoriteButton, useFavoriteIds } from './Favorites';
import './experience-detail.css';

type PublicTrip = Trip & { memberCount?: number; spendDifferencePerPerson?: number | null; activities?: Activity[] };
const money = (amount?: number | null) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount || 0);
const isVideo = (m: GalleryItem) => !!m.mimeType?.startsWith('video/');
const nice = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A shared trip as other travellers see it: cover, gallery (with a viewer), story, tips,
 * day-by-day itinerary, budget vs real spend, copy, and favorites (trip, activities, hotel, city).
 * `embedded` renders it inside the app's sidebar layout; otherwise it's a standalone page.
 */
export function Experience({ user, embedded = false, fallback }: { user: User | null; embedded?: boolean; fallback?: (id: string) => Trip | undefined }) {
  const { id = '' } = useParams(); const nav = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(fallback?.(id) || null); const [error, setError] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);
  const [copying, setCopying] = useState(false); const [copyId, setCopyId] = useState<number | null>(null);
  // `live`: loaded from the API (the built-in demo trips can't be favorited).
  const [live, setLive] = useState(false);
  useEffect(() => { setError(''); setLive(false); api.publicTrip(id).then((t) => { setTrip(t); setLive(true); }).catch((e) => { if (!fallback?.(id)) setError(apiError(e, 'This experience is not available.')); }); }, [id]);

  const gallery = trip?.gallery || []; const media = gallery.length;
  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null); if (e.key === 'ArrowRight') setViewer((v) => (v === null ? v : (v + 1) % media)); if (e.key === 'ArrowLeft') setViewer((v) => (v === null ? v : (v - 1 + media) % media)); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [viewer, media]);

  const favorites = !!user && live;
  const activityFavs = useFavoriteIds('activity', (trip?.activities || []).map((a) => a.id), favorites);
  const hotelFavs = useFavoriteIds('hotel', [trip?.hotelPlaceId], favorites);
  const placeFavs = useFavoriteIds('place', [trip?.cityPlaceId], favorites);

  const copy = async () => { if (!user) return; setCopying(true); try { const created = await api.copyTrip(id); setCopyId(created.id); } catch (e) { setError(apiError(e, 'Unable to copy this trip.')); } finally { setCopying(false); } };

  const shell = (content: ReactNode) => embedded ? <section className="experience embedded">{content}</section> : <main className="experience"><header><Link className="brand dark" to="/discover"><span>G</span> GoCity</Link><nav>{user ? <Link to="/trips">My trips</Link> : <><Link to="/login">Sign in</Link><Link className="mini-primary" to="/register">Get started</Link></>}</nav></header>{content}</main>;
  if (error && !trip) return shell(<div className="experience-missing"><p className="error">{error}</p><Link className="text-link" to="/discover"><ArrowLeft size={15}/> Back to Discover</Link></div>);
  if (!trip) return shell(<p className="muted experience-loading">Loading experience…</p>);

  const place = [trip.city, trip.country].filter(Boolean).join(', ');
  const activities = [...(trip.activities || [])].sort((a, b) => a.dayNumber - b.dayNumber || a.startTime.localeCompare(b.startTime));
  const days = Array.from({ length: trip.durationDays || 1 }, (_, i) => ({ day: i + 1, rows: activities.filter((a) => a.dayNumber === i + 1) })).filter((d) => d.rows.length);
  const estimate = trip.budgetPerPerson; const actual = trip.actualSpentPerPerson;
  const facts = [
    { icon: CalendarDays, label: 'Dates', value: `${nice(trip.startDate)} – ${nice(trip.endDate)}` },
    { icon: Clock3, label: 'Duration', value: `${trip.durationDays} day${trip.durationDays === 1 ? '' : 's'}` },
    { icon: Users, label: 'Travellers', value: `${trip.travelersCount}${trip.memberCount ? ` · ${trip.memberCount} in the group` : ''}` },
    { icon: Bed, label: 'Stayed at', value: trip.hotelName || 'Not shared', sub: trip.hotelAddress || undefined },
    { icon: Wallet, label: 'Budget / person', value: estimate ? money(estimate) : 'Not set' },
    { icon: Wallet, label: 'Really spent / person', value: actual != null ? money(actual) : trip.totalExpensesPerPerson ? money(trip.totalExpensesPerPerson) : 'Not shared', sub: actual != null && estimate ? (actual > estimate ? `${money(actual - estimate)} over budget` : `${money(estimate - actual)} under budget`) : undefined },
  ];

  return shell(<>
    {embedded && <button className="experience-back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/discover'))}><ArrowLeft size={15}/> Back</button>}
    <div className="experience-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(15,27,38,.72), rgba(15,27,38,.1)), url(${assetUrl(trip.coverUrl)})` }}><div><p className="eyebrow">COMMUNITY EXPERIENCE{trip.owner ? ` · BY ${trip.owner.firstName.toUpperCase()} ${trip.owner.lastName.toUpperCase()}` : ''}</p><h1>{trip.name}</h1><p><MapPin size={16}/> {place || trip.hotelName || 'A traveller’s route'}{favorites && trip.cityPlaceId && <FavoriteButton className="fav-inline fav-on-dark" type="place" targetId={trip.cityPlaceId} title={trip.city || place} initial={placeFavs.has(trip.cityPlaceId)}/>} &nbsp; <Clock3 size={16}/> {trip.durationDays} days{media ? <> &nbsp; <Images size={16}/> {media} photo{media === 1 ? '' : 's'}</> : null}</p></div></div>

    <section className="experience-body">
      <article>
        <p className="eyebrow">THE STORY</p><h2>Made to be enjoyed slowly.</h2>
        <p className="story">{trip.story || trip.storyExcerpt || 'A flexible collection of places and moments that leaves plenty of room for your own discoveries.'}</p>

        <div className="experience-facts">{facts.map(({ icon: Icon, label, value, sub }) => <div key={label}><Icon size={17}/><span><small>{label}</small><b>{value}</b>{sub && <em>{sub}</em>}</span>{label === 'Stayed at' && favorites && trip.hotelPlaceId && <FavoriteButton className="fav-inline fav-end" type="hotel" targetId={trip.hotelPlaceId} title={trip.hotelName || 'Hotel'} initial={hotelFavs.has(trip.hotelPlaceId)}/>}</div>)}</div>

        {media > 0 && <section className="experience-section"><div className="section-row"><h3><Images size={18}/> Gallery</h3><small>{media} item{media === 1 ? '' : 's'} · click to enlarge</small></div>
          <div className={`experience-gallery count-${Math.min(media, 5)}`}>{gallery.slice(0, 5).map((m, i) => <button key={m.id} onClick={() => setViewer(i)} aria-label={`Open item ${i + 1}`}>{isVideo(m) ? <><video src={assetUrl(m.url)} muted preload="metadata"/><span className="play"><Film size={18}/></span></> : <img src={assetUrl(m.url)} alt={m.originalName || `Photo ${i + 1}`} loading="lazy"/>}{i === 4 && media > 5 && <span className="more">+{media - 5}</span>}</button>)}</div>
        </section>}

        {trip.tips && trip.tips.length > 0 && <section className="experience-section"><h3><Lightbulb size={18}/> Tips from the traveller</h3><ul className="experience-tips">{trip.tips.map((t) => <li key={t}><Check size={15}/>{t}</li>)}</ul></section>}

        {days.length > 0 && <section className="experience-section"><div className="section-row"><h3><Footprints size={18}/> The itinerary</h3><small>{activities.length} stop{activities.length === 1 ? '' : 's'}</small></div>
          <div className="experience-days">{days.map(({ day, rows }) => <div className="experience-day" key={day}><b>Day {day}</b><ol>{rows.map((a) => { const Icon = a.transportation === 'drive' ? Car : a.transportation === 'public_transport' ? TrainFront : Footprints; return <li key={a.id}><time>{a.startTime.slice(0, 5)}</time><div><strong>{a.name}{a.kind === 'plan' && <span className="kind">plan</span>}</strong><small><MapPin size={12}/> {a.placeName || 'Place to decide'} · <Icon size={12}/> {a.transportation === 'public_transport' ? 'Transit' : a.transportation === 'drive' ? 'Drive' : 'Walk'}{a.expense > 0 ? ` · ${money(a.expense)}` : ''}</small></div>{favorites && <FavoriteButton className="fav-inline fav-end" type="activity" targetId={a.id} title={a.name} initial={activityFavs.has(String(a.id))}/>}</li>; })}</ol></div>)}</div>
        </section>}
      </article>

      <aside className="copy-card"><Sparkles/><h3>Make it yours</h3><p>Copy this itinerary to your trips, then adjust the dates, hotel and every activity.</p>
        {favorites && <FavoriteButton className="save-experience-fav" type="trip" targetId={trip.id} title={trip.name} initial={!!trip.isFavorite} label/>}
        {user ? (copyId ? <Link className="primary" to={`/trips/${copyId}`}><Check size={17}/> Copied · open my trip</Link> : <button className="primary" onClick={copy} disabled={copying}><Copy size={17}/> {copying ? 'Copying…' : 'Copy this trip'}</button>) : <Link className="primary" to="/register">Start planning <ChevronRight size={17}/></Link>}
        {error && <p className="error">{error}</p>}
        <ul className="copy-includes"><li>{activities.length} activities & plans</li><li>{trip.hotelName ? 'Hotel details' : 'Room for your own hotel'}</li><li>Dates you can change</li></ul>
      </aside>
    </section>

    {viewer !== null && gallery[viewer] && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setViewer(null)}>
      <button className="lightbox-close" aria-label="Close" onClick={() => setViewer(null)}><X size={22}/></button>
      {media > 1 && <button className="lightbox-nav prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setViewer((viewer - 1 + media) % media); }}><ChevronLeft size={28}/></button>}
      <figure onClick={(e) => e.stopPropagation()}>{isVideo(gallery[viewer]) ? <video src={assetUrl(gallery[viewer].url)} controls autoPlay/> : <img src={assetUrl(gallery[viewer].url)} alt=""/>}<figcaption>{viewer + 1} / {media}</figcaption></figure>
      {media > 1 && <button className="lightbox-nav next" aria-label="Next" onClick={(e) => { e.stopPropagation(); setViewer((viewer + 1) % media); }}><ChevronRight size={28}/></button>}
    </div>}
  </>);
}
