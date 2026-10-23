import { useState, type FormEvent } from 'react';
import { BedDouble, Check, ExternalLink, Hotel as HotelIcon, MapPin, Pencil, Search, Star, Trash2, X } from 'lucide-react';
import { api, assetUrl } from './api';
import { CityPicker } from './CityPicker';
import { PlaceDetailsToggle } from './PlaceDetails';
import { FavoriteButton, useFavoriteIds } from './Favorites';
import { canEdit, type Hotel, type Trip } from './types';
import './hotel-picker.css';

const errorText = (e: any, fallback: string) => e?.response?.data?.response_error || fallback;
const priceLevel = (level: number | null) => (level == null ? '' : level === 0 ? 'Free' : '€'.repeat(level));

/**
 * The trip's destination city and hotel: Google hotel suggestions around the city,
 * then "choose" with a price (saved as the trip's hotel expense).
 */
export function TripHotelEditor({ trip, onChanged }: { trip: Trip; onChanged: () => void }) {
  const tripId = String(trip.id); const editable = canEdit(trip); const defaultNights = Math.max((trip.durationDays || 1) - 1, 1);
  const [editingCity, setEditingCity] = useState(false); const [hotels, setHotels] = useState<Hotel[]>([]); const [nextPage, setNextPage] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const [minRating, setMinRating] = useState(''); const [maxPrice, setMaxPrice] = useState(''); const [choosing, setChoosing] = useState<Hotel | null>(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const hotelFavs = useFavoriteIds('hotel', hotels.map((h) => h.placeId)); const placeFavs = useFavoriteIds('place', [trip.cityPlaceId]);

  const load = async (more = false) => { setBusy(true); setError(''); try { const page = await api.hotelSuggestions(tripId, { minRating: minRating ? Number(minRating) : undefined, maxPriceLevel: maxPrice ? Number(maxPrice) : undefined, limit: 9, pageToken: more ? nextPage || undefined : undefined }); setHotels(more ? [...hotels, ...page.hotels] : page.hotels); setNextPage(page.nextPageToken); setOpen(true); } catch (e) { setError(errorText(e, 'Hotel suggestions are unavailable right now.')); } finally { setBusy(false); } };
  const saveCity = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const cityPlaceId = String(form.get('cityPlaceId') || ''); const city = String(form.get('city') || '').trim(); void city; if (!cityPlaceId) return setError('Pick the city from the list.'); setBusy(true); setError(''); try { await api.updateTrip(tripId, { cityPlaceId }); setEditingCity(false); setHotels([]); setOpen(false); onChanged(); } catch (e) { setError(errorText(e, 'Unable to save the city.')); } finally { setBusy(false); } };
  const choose = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!choosing) return; const form = new FormData(event.currentTarget); const mode = String(form.get('mode')); const amount = Number(form.get('amount')); setBusy(true); setError(''); try { await api.setHotel(tripId, { placeId: choosing.placeId, ...(form.get('amount') ? (mode === 'total' ? { totalPrice: amount } : { pricePerNight: amount, nights: Number(form.get('nights')) || defaultNights }) : {}), currency: String(form.get('currency') || 'EUR') }); setChoosing(null); setOpen(false); setNotice(`${choosing.name} is now your hotel.`); onChanged(); } catch (e) { setError(errorText(e, 'Unable to save this hotel.')); } finally { setBusy(false); } };
  const remove = async () => { if (!window.confirm('Remove the hotel and its cost from this trip?')) return; setBusy(true); try { await api.removeHotel(tripId); setNotice('Hotel removed.'); onChanged(); } catch (e) { setError(errorText(e, 'Unable to remove the hotel.')); } finally { setBusy(false); } };

  return <section className="stay-panel">
    <div className="section-head"><div><p className="eyebrow">WHERE YOU'LL STAY</p><h2>{trip.city ? `Your base in ${trip.city}` : 'Pick a destination'}</h2></div></div>
    <div className="stay-row">
      <div className="stay-card"><MapPin size={18}/><div><small>Destination</small><strong>{trip.city ? `${trip.city}${trip.country ? `, ${trip.country}` : ''}` : 'No city yet'}</strong></div>{trip.cityPlaceId && <FavoriteButton className="fav-inline" type="place" targetId={trip.cityPlaceId} title={trip.city || 'City'} initial={placeFavs.has(trip.cityPlaceId)}/>}{editable && !editingCity && <button className="icon-button" onClick={() => setEditingCity(true)} aria-label="Change city"><Pencil size={15}/></button>}</div>
      <div className="stay-card"><HotelIcon size={18}/><div><small>Hotel</small><strong>{trip.hotelName || 'Not chosen yet'}</strong>{trip.hotelAddress && <small>{trip.hotelAddress}</small>}{trip.hotelPlaceId && <PlaceDetailsToggle placeId={trip.hotelPlaceId} date={trip.startDate} label="Hotel details" compact/>}</div>{editable && trip.hotelName && <button className="icon-button" onClick={remove} disabled={busy} aria-label="Remove hotel"><Trash2 size={15}/></button>}</div>
    </div>
    {editingCity && <form className="city-form" onSubmit={saveCity}><CityPicker required initial={{ city: trip.city, cityPlaceId: trip.cityPlaceId }}/><button className="primary compact" disabled={busy}><Check size={16}/> Save city</button><button type="button" className="text-button" onClick={() => setEditingCity(false)}>Cancel</button></form>}
    {(trip.city || trip.cityPlaceId) && <div className="hotel-filters"><select value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Minimum rating"><option value="">Any rating</option><option value="3.5">3.5+ ★</option><option value="4">4+ ★</option><option value="4.5">4.5+ ★</option></select><select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} aria-label="Maximum price"><option value="">Any price</option><option value="1">€ budget</option><option value="2">up to €€</option><option value="3">up to €€€</option></select><button className="primary compact" onClick={() => load()} disabled={busy}><Search size={16}/> {open ? 'Update suggestions' : `Find hotels in ${trip.city || 'the city'}`}</button></div>}
    {notice && <p className="workspace-notice">{notice}</p>}{error && <p className="error">{error}</p>}
    {open && <div className="hotel-grid">{hotels.length ? hotels.map((hotel) => <article className={`hotel-card${hotel.placeId === trip.hotelPlaceId ? ' current' : ''}`} key={hotel.placeId}>
      <div className="hotel-photo" style={{ backgroundImage: hotel.photoUrl ? `url(${assetUrl(hotel.photoUrl)})` : undefined }}>{!hotel.photoUrl && <BedDouble size={28}/>}<FavoriteButton type="hotel" targetId={hotel.placeId} title={hotel.name} initial={hotelFavs.has(hotel.placeId)}/></div>
      <div className="hotel-body"><h3>{hotel.name}</h3><p className="hotel-meta">{hotel.rating != null && <span><Star size={13}/> {hotel.rating}{hotel.userRatingCount ? ` (${hotel.userRatingCount})` : ''}</span>}{hotel.priceLevel != null && <span>{priceLevel(hotel.priceLevel)}</span>}</p><small>{hotel.address}</small>
        <div className="hotel-actions">{hotel.googleMapsUri && <a href={hotel.googleMapsUri} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Maps</a>}{editable && (hotel.placeId === trip.hotelPlaceId ? <b><Check size={14}/> Your hotel</b> : <button onClick={() => setChoosing(hotel)}>Choose</button>)}</div>
        {choosing?.placeId === hotel.placeId && <form className="choose-form" onSubmit={choose}><div className="mode"><label><input type="radio" name="mode" value="night" defaultChecked/> Per night</label><label><input type="radio" name="mode" value="total"/> Total</label></div><div className="two"><input name="amount" type="number" min="0" step="0.01" placeholder="Price (optional)"/><input name="nights" type="number" min="1" defaultValue={defaultNights} title="Nights"/></div><select name="currency" defaultValue="EUR"><option>EUR</option><option>USD</option><option>GBP</option><option>TND</option></select><div className="choose-buttons"><button className="primary compact" disabled={busy}><Check size={15}/> Save hotel</button><button type="button" className="icon-button" onClick={() => setChoosing(null)} aria-label="Cancel"><X size={15}/></button></div><small className="muted">The price is added to the trip's expenses.</small></form>}
      </div></article>) : <p className="muted">No hotels match these filters.</p>}</div>}
    {open && nextPage && <button className="add-empty load-more" onClick={() => load(true)} disabled={busy}>Show more hotels</button>}
  </section>;
}
