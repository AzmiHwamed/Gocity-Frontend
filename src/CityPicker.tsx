import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { CitySuggestion } from './types';
import { useCitySuggestions } from './useCitySuggestions';
import './hotel-picker.css';

/**
 * City autocomplete (Google Places via the backend).
 * Inside a <form> it posts `cityPlaceId` and `city`; `onSelect` lets parents react too.
 */
export function CityPicker({ label = 'Destination city', initial, onSelect }: { label?: string; initial?: { city?: string | null; cityPlaceId?: string | null }; onSelect?: (city: CitySuggestion | null) => void }) {
  const [query, setQuery] = useState(initial?.city || ''); const [selected, setSelected] = useState<{ name: string; placeId: string } | null>(initial?.cityPlaceId ? { name: initial.city || '', placeId: initial.cityPlaceId } : null);
  const { results, loading, error, done } = useCitySuggestions(query, !selected);
  const pick = (city: CitySuggestion) => { setSelected({ name: city.fullText, placeId: city.placeId }); setQuery(city.fullText); done(); onSelect?.(city); };
  return <label className="hotel-picker">{label}<div className="hotel-search"><input value={query} onChange={(e) => { setSelected(null); setQuery(e.target.value); onSelect?.(null); }} placeholder="Start typing a city…" autoComplete="off"/><span className="picker-icon">{loading ? <Loader2 size={17} className="spin"/> : <MapPin size={17}/>}</span></div><input type="hidden" name="cityPlaceId" value={selected?.placeId || ''}/><input type="hidden" name="city" value={selected ? selected.name.split(',')[0] : query.trim()}/>{results.length > 0 && <div className="hotel-results">{results.map((city) => <button type="button" key={city.placeId} onClick={() => pick(city)}><MapPin size={15}/><span><strong>{city.name}</strong><small>{city.description}</small></span></button>)}</div>}{error && <small className="error">{error}</small>}</label>;
}
