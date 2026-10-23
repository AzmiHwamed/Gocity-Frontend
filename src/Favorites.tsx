import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, ChevronRight, Compass, ExternalLink, Footprints, Heart, MapPin, Sparkles, Trash2, type LucideIcon } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import type { Favorite, FavoriteCounts, FavoriteType } from './types';
import './favorites.css';

type Tab = FavoriteType | 'all';
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'All', icon: Heart },
  { key: 'trip', label: 'Trips', icon: Compass },
  { key: 'activity', label: 'Activities', icon: Footprints },
  { key: 'hotel', label: 'Hotels', icon: BedDouble },
  { key: 'place', label: 'Places', icon: MapPin },
  { key: 'program', label: 'Programs', icon: Sparkles },
];
const typeIcon = (type: FavoriteType) => TABS.find((t) => t.key === type)!.icon;
const typeLabel = { trip: 'Trip', activity: 'Activity', hotel: 'Hotel', place: 'Place', program: 'Program' } satisfies Record<FavoriteType, string>;
const emptyCounts: FavoriteCounts = { all: 0, trip: 0, activity: 0, hotel: 0, place: 0, program: 0 };
const LEGACY_KEY = 'gocity_saved_experiences';
const PAGE = 24;

/**
 * Favorites used to live only in this browser (trip ids under `gocity_saved_experiences`).
 * Moves them to the account once; ids that no longer exist are dropped.
 */
let migration: Promise<void> | null = null;
export const migrateLegacyFavorites = () => (migration ??= (async () => {
  let ids: unknown[] = [];
  try { ids = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); } catch { /* unreadable: drop it */ }
  const valid = (Array.isArray(ids) ? ids : []).map(String).filter((id) => /^\d+$/.test(id));
  await Promise.allSettled(valid.map((id) => api.addFavorite('trip', id)));
  localStorage.removeItem(LEGACY_KEY);
})());

/** Which of `ids` are favorites (for hearts on lists). Re-checks when the ids change. */
export function useFavoriteIds(type: FavoriteType, ids: (string | number | null | undefined)[], enabled = true) {
  const key = ids.filter((id) => id != null && id !== '').map(String).join(',');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled || !key) { setSaved(new Set()); return; }
    let live = true;
    api.checkFavorites(type, key.split(',')).then((found) => live && setSaved(new Set(found))).catch(() => {});
    return () => { live = false; };
  }, [type, key, enabled]);
  return saved;
}

/**
 * Heart toggle. Flips immediately and rolls back if the server says no.
 * Works inside links/cards: the click doesn't navigate.
 */
export function FavoriteButton({ type, targetId, title, initial = false, label = false, className = '', onChange }: { type: FavoriteType; targetId: string | number; title: string; initial?: boolean; label?: boolean; className?: string; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => setOn(initial), [initial, targetId]);
  const toggle = async (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); if (busy) return;
    const next = !on; setOn(next); setBusy(true); setError('');
    try { if (next) await api.addFavorite(type, targetId, title); else await api.removeFavorite(type, targetId); onChange?.(next); }
    catch (err) { setOn(!next); setError(apiError(err, 'Could not update your favorites.')); }
    finally { setBusy(false); }
  };
  const action = on ? `Remove ${title} from favorites` : `Add ${title} to favorites`;
  return <span className={`fav-wrap ${className}`}><button type="button" className={`fav-button${on ? ' on' : ''}${label ? ' with-label' : ''}`} onClick={toggle} aria-pressed={on} aria-label={action} title={error || action} data-busy={busy || undefined}><Heart size={label ? 17 : 16} fill={on ? 'currentColor' : 'none'}/>{label && <span>{on ? 'In your favorites' : 'Add to favorites'}</span>}</button>{error && label && <small className="fav-error" role="alert">{error}</small>}</span>;
}

/** Everything the user saved, by type, with counts. */
export function FavoritesPage() {
  const [tab, setTab] = useState<Tab>('all'); const [items, setItems] = useState<Favorite[]>([]); const [counts, setCounts] = useState<FavoriteCounts>(emptyCounts);
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  const load = async (nextTab: Tab, nextPage = 1) => {
    setLoading(true); setError('');
    try {
      await migrateLegacyFavorites();
      const res = await api.favorites({ type: nextTab === 'all' ? undefined : nextTab, page: nextPage, limit: PAGE });
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items])); setCounts(res.counts); setTotal(res.total); setPage(nextPage);
    } catch (e) { setError(apiError(e, 'We could not load your favorites.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); }, [tab]);

  const remove = async (f: Favorite) => {
    const before = { items, counts, total };
    setItems(items.filter((x) => x.id !== f.id)); setCounts({ ...counts, all: counts.all - 1, [f.type]: counts[f.type] - 1 }); setTotal(total - 1);
    try { await api.removeFavorite(f.type, f.targetId); }
    catch (e) { setItems(before.items); setCounts(before.counts); setTotal(before.total); setError(apiError(e, 'Could not remove it. Please try again.')); }
  };

  const current = TABS.find((t) => t.key === tab)!;
  return <section className="favorites-page">
    <div className="topline"><div><p className="eyebrow">SAVED FOR LATER</p><h1>Favorites</h1><p className="muted">Trips, activities, hotels and places you want to come back to.</p></div><Link className="primary compact" to="/discover"><Compass size={17}/> Discover more</Link></div>
    <div className="fav-tabs" role="tablist">{TABS.map(({ key, label, icon: Icon }) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={15}/> {label}<b>{counts[key]}</b></button>)}</div>
    {error && <p className="error">{error}</p>}
    {loading && !items.length ? <p className="muted">Loading your favorites…</p> : items.length ? <>
      <div className="fav-grid">{items.map((f) => <FavoriteCard key={f.id} favorite={f} onRemove={() => remove(f)}/>)}</div>
      {items.length < total && <button className="add-empty load-more" disabled={loading} onClick={() => load(tab, page + 1)}>{loading ? 'Loading…' : 'Show more'}</button>}
    </> : <section className="empty"><div className="empty-icon"><current.icon/></div><h2>{tab === 'all' ? 'Nothing saved yet.' : `No ${current.label.toLowerCase()} saved yet.`}</h2><p>Tap the heart on a trip, an activity, a hotel or a city to keep it here.</p><Link className="primary compact" to="/discover">Explore experiences</Link></section>}
  </section>;
}

function FavoriteCard({ favorite: f, onRemove }: { favorite: Favorite; onRemove: () => void }) {
  const Icon = typeIcon(f.type);
  const open = !f.available ? null : f.type === 'program' ? <Link to={`/programs/${f.targetId}`}>Open program <ChevronRight size={14}/></Link> : f.tripId ? <Link to={`/experiences/${f.tripId}`}>{f.type === 'activity' ? 'Open its trip' : 'Open trip'} <ChevronRight size={14}/></Link> : f.mapsUrl ? <a href={f.mapsUrl} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={13}/></a> : null;
  return <article className={`fav-card${f.available ? '' : ' unavailable'}`}>
    <div className="fav-image" style={{ backgroundImage: f.imageUrl && f.available ? `url(${assetUrl(f.imageUrl)})` : undefined }}>{(!f.imageUrl || !f.available) && <Icon size={28}/>}<span className="fav-type"><Icon size={12}/> {typeLabel[f.type]}</span></div>
    <div className="fav-body"><h3>{f.title}</h3>{f.available ? f.subtitle && <small>{f.subtitle}</small> : <small className="fav-gone">No longer available: it was deleted or is no longer shared.</small>}
      <div className="fav-actions">{open}<button type="button" onClick={onRemove} aria-label={`Remove ${f.title} from favorites`}><Trash2 size={14}/> Remove</button></div>
    </div>
  </article>;
}
