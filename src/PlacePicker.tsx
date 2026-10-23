import { useEffect, useRef, useState } from 'react';
import { Check, MapPin, Search, Star } from 'lucide-react';
import { APIProvider, AdvancedMarker, Map, Marker } from '@vis.gl/react-google-maps';
import { api, apiError } from './api';
import type { PlaceResult } from './types';
import './place-picker.css';
import './map-location-picker.css';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;

/** Reads what a PlacePicker put in the form: name, plus placeId and coordinates when one was picked. */
export const placeFields = (f: FormData) => {
  const lat = f.get('placeLatitude'); const lng = f.get('placeLongitude');
  const placeId = f.get('placeId');
  return { placeName: f.get('placeName') || undefined, placeId: placeId || (lat && lng ? null : undefined), placeLatitude: lat ? Number(lat) : undefined, placeLongitude: lng ? Number(lng) : undefined };
};

/**
 * "Place" field for activities and ideas: search Google Places (near the trip's city) and pick a
 * result so the activity gets coordinates for the map and routes. With `required`, the form can't be
 * sent until a result is picked; without it, a typed name is kept as is.
 * Fills the form fields placeName, placeId, placeLatitude and placeLongitude.
 */
export function PlacePicker({ near, placeholder = 'Place', className = '', required = false, initialPlace, allowMapPin = false, mapCenter }: { near?: string | null; placeholder?: string; className?: string; required?: boolean; initialPlace?: { placeId?: string | null; name?: string; latitude?: number | null; longitude?: number | null }; allowMapPin?: boolean; mapCenter?: { lat: number; lng: number } | null }) {
  const input = useRef<HTMLInputElement>(null);
  const initiallyPicked = !!(initialPlace?.placeId && initialPlace.latitude != null && initialPlace.longitude != null);
  const [text, setText] = useState(initialPlace?.name || ''); const [picked, setPicked] = useState<PlaceResult | null>(initiallyPicked ? { placeId: initialPlace!.placeId!, name: initialPlace!.name || '', address: null, category: null, latitude: Number(initialPlace!.latitude), longitude: Number(initialPlace!.longitude), rating: null, googleMapsUri: null } : null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(!initiallyPicked && initialPlace?.latitude != null && initialPlace.longitude != null ? { lat: Number(initialPlace.latitude), lng: Number(initialPlace.longitude) } : null);
  const [results, setResults] = useState<PlaceResult[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const search = async () => {
    if (text.trim().length < 2) return setMessage('Type at least 2 characters.');
    setBusy(true); setMessage('');
    try { const found = await api.searchPlaces({ q: text.trim(), near: near || undefined }); setResults(found); if (!found.length) setMessage(required ? 'No places found. Try another name or add the city.' : 'No places found. You can keep the name as typed.'); }
    catch (e) { setMessage(apiError(e, required ? 'Place search is unavailable right now. Please try again.' : 'Place search is unavailable. You can keep the name as typed.')); }
    finally { setBusy(false); }
  };
  // Required: the form can't be sent until a search result is picked (so the activity has coordinates).
  useEffect(() => { input.current?.setCustomValidity(required && !picked && !pin ? (text.trim() ? 'Press search and pick a result, or drop a pin on the map.' : 'Search for the place and pick a result, or drop a pin on the map.') : ''); }, [required, picked, pin, text]);
  const pick = (p: PlaceResult) => { setPicked(p); setPin(null); setText(p.name); setResults([]); setMessage(''); };
  return <div className={`place-picker ${className}`}>
    <div className="place-input">{picked || pin ? <Check size={14} className="picked"/> : <MapPin size={14}/>}<input ref={input} name="placeName" required={required} value={text} placeholder={placeholder} autoComplete="off" onChange={(e) => { setText(e.target.value); setPicked(null); setPin(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}/><button type="button" onClick={search} disabled={busy} aria-label="Search places" title="Find it on the map"><Search size={14}/></button></div>
    <input type="hidden" name="placeId" value={picked?.placeId ?? ''}/><input type="hidden" name="placeLatitude" value={picked?.latitude ?? pin?.lat ?? ''}/><input type="hidden" name="placeLongitude" value={picked?.longitude ?? pin?.lng ?? ''}/>
    {results.length > 0 && <div className="place-results" role="listbox">{results.map((p) => <button type="button" role="option" aria-selected="false" key={p.placeId} onClick={() => pick(p)}><MapPin size={14}/><span><strong>{p.name}</strong><small>{[p.category, p.address].filter(Boolean).join(' · ')}</small></span>{p.rating != null && <em><Star size={11}/> {p.rating}</em>}</button>)}</div>}
    {message && <small className="place-message">{message}</small>}
    {allowMapPin && <div className="map-location-picker">{MAPS_KEY ? <APIProvider apiKey={MAPS_KEY}><Map defaultCenter={mapCenter || pin || { lat: 36.8065, lng: 10.1815 }} defaultZoom={mapCenter || pin ? 13 : 3} mapId={MAP_ID || undefined} gestureHandling="greedy" clickableIcons={false} onClick={(event) => { const point = event.detail.latLng; if (!point) return; setPicked(null); setPin(point); setText(`Dropped pin (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`); setResults([]); setMessage(''); }} className="place-google-map">{(picked || pin) && (MAP_ID ? <AdvancedMarker position={picked ? { lat: picked.latitude, lng: picked.longitude } : pin!}/> : <Marker position={picked ? { lat: picked.latitude, lng: picked.longitude } : pin!}/>)}</Map><small>Click the map to drop a pin, or search and choose a place above.</small></APIProvider> : <small className="map-picker-unavailable">Add a Google Maps browser key to choose a location from the map.</small>}</div>}
  </div>;
}
