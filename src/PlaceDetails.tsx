import { useEffect, useState } from 'react';
import { ChevronDown, Clock3, ExternalLink, Globe, Loader2, MapPin, Phone, Star } from 'lucide-react';
import { api, apiError } from './api';
import { PhotoCarousel } from './PhotoCarousel';
import type { PlaceDetails as Details } from './types';
import './place-details.css';

const PRICE = ['Free', '€', '€€', '€€€', '€€€€'];
const longDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' });

/**
 * "Details" toggle for a place (activity, hotel…): loads Google details on first open.
 * `date` (YYYY-MM-DD) shows the opening hours for that day of the trip.
 */
export function PlaceDetailsToggle({ placeId, date, label = 'Details', compact = false }: { placeId: string; date?: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="place-details-toggle">
    <button type="button" className={`details-button${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}><ChevronDown size={14}/> {open ? 'Hide details' : label}</button>
    {open && <PlaceDetailsCard placeId={placeId} date={date} compact={compact}/>}
  </div>;
}

export function PlaceDetailsCard({ placeId, date, compact = false }: { placeId: string; date?: string; compact?: boolean }) {
  const [d, setD] = useState<Details | null>(null); const [error, setError] = useState('');
  useEffect(() => { setD(null); setError(''); api.placeDetails(placeId, date).then(setD).catch((e) => setError(apiError(e, 'Details are unavailable right now.'))); }, [placeId, date]);
  if (error) return <div className={`place-details${compact ? ' compact' : ''}`}><p className="muted">{error}</p></div>;
  if (!d) return <div className={`place-details${compact ? ' compact' : ''}`}><p className="muted"><Loader2 size={14} className="spin"/> Loading details…</p></div>;
  const review = d.reviews.find((r) => r.text);
  return <div className={`place-details${compact ? ' compact' : ''}`}>
    {d.photos.length > 0 && <PhotoCarousel photos={d.photos} title={d.name} className="small"/>}
    <div className="place-details-body">
      <div className="place-details-head">
        <div><strong>{d.name}</strong>{d.category && <small>{d.category}</small>}</div>
        {d.rating != null && <span className="place-rating" title={`${d.rating} out of 5`}><Star size={13} fill="currentColor"/> {d.rating.toFixed(1)}{d.userRatingCount ? <small> ({d.userRatingCount.toLocaleString('en')})</small> : null}{d.priceLevel != null && <em> · {PRICE[d.priceLevel]}</em>}</span>}
      </div>
      {d.summary && <p className="place-summary">{d.summary}</p>}
      <ul className="place-facts">
        {(d.hoursOnDate || d.weeklyHours.length > 0) && <li><Clock3 size={14}/><span>{d.hoursOnDate ? <><b>{date ? `On ${longDate(date)}:` : 'Today:'}</b> {d.hoursOnDate.replace(/^[A-Za-z]+:\s*/, '')}</> : 'See opening hours'}{d.weeklyHours.length > 0 && <details><summary>All week</summary><ul>{d.weeklyHours.map((h) => <li key={h}>{h}</li>)}</ul></details>}</span></li>}
        {d.address && <li><MapPin size={14}/><span>{d.address}</span></li>}
        {d.phone && <li><Phone size={14}/><a href={`tel:${d.phone.replace(/\s+/g, '')}`}>{d.phone}</a></li>}
        {d.websiteUri && <li><Globe size={14}/><a href={d.websiteUri} target="_blank" rel="noreferrer">{new URL(d.websiteUri).hostname.replace(/^www\./, '')}</a></li>}
      </ul>
      {d.amenities.length > 0 && <div className="place-amenities">{d.amenities.map((a) => <span key={a}>{a}</span>)}</div>}
      {review && <blockquote className="place-review">“{review.text!.length > 220 ? `${review.text!.slice(0, 220)}…` : review.text}”<footer>{review.rating != null && <><Star size={11} fill="currentColor"/> {review.rating} · </>}{review.author ?? 'Google user'}{review.when ? ` · ${review.when}` : ''}</footer></blockquote>}
      {d.googleMapsUri && <a className="text-link maps-link" href={d.googleMapsUri} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={13}/></a>}
    </div>
  </div>;
}
