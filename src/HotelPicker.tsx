import { useState } from 'react';
import { MapPin, Search, Star } from 'lucide-react';
import { api, assetUrl } from './api';
import type { Hotel } from './types';
import './hotel-picker.css';

/** Free-text hotel search for forms; searches around the chosen city when there is one. */
export function HotelPicker({ cityPlaceId }: { cityPlaceId?: string }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState<Hotel[]>([]); const [selected, setSelected] = useState<Hotel | null>(null); const [error, setError] = useState('');
  const search = async () => { if (query.trim().length < 2) return; setError(''); try { const page = await api.hotelSearch({ q: query.trim(), placeId: cityPlaceId || undefined, limit: 8 }); setResults(page.hotels); if (!page.hotels.length) setError('No hotels found for that search.'); } catch (e: any) { setError(e.response?.data?.response_error || 'Hotel search is unavailable.'); } };
  return <label className="hotel-picker">Where are you staying?<div className="hotel-search"><input value={selected?.name || query} onChange={(e) => { setSelected(null); setQuery(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder="Search a hotel or neighbourhood"/><button type="button" onClick={search} aria-label="Search hotels"><Search size={17}/></button></div><input type="hidden" name="hotelName" value={selected?.name || query}/><input type="hidden" name="hotelLatitude" value={selected?.latitude ?? ''}/><input type="hidden" name="hotelLongitude" value={selected?.longitude ?? ''}/>{results.length > 0 && <div className="hotel-results">{results.map((hotel) => <button type="button" key={hotel.placeId} onClick={() => { setSelected(hotel); setResults([]); }}>{hotel.photoUrl ? <img src={assetUrl(hotel.photoUrl)} alt="" loading="lazy"/> : <MapPin size={15}/>}<span><strong>{hotel.name}</strong><small>{hotel.address}</small></span>{hotel.rating && <em><Star size={12}/> {hotel.rating}</em>}</button>)}</div>}{error && <small className="error">{error}</small>}</label>;
}
