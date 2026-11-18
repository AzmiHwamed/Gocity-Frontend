import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { CitySuggestion } from './types';

// Older Android WebViews and some in-app browsers do not implement crypto.randomUUID.
// Google only requires an opaque, stable value for the duration of a suggestion session.
const newSessionId = () => globalThis.crypto?.randomUUID?.() ?? `gocity-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Debounced Google Places city suggestions (through the backend).
 * Call `done()` after a pick so the next search starts a new Google billing session.
 */
export function useCitySuggestions(query: string, enabled = true) {
  const [results, setResults] = useState<CitySuggestion[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const session = useRef(newSessionId());
  useEffect(() => {
    if (!enabled || query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => { setLoading(true); setError(''); try { setResults(await api.searchCities(query.trim(), session.current)); } catch (e: any) { setResults([]); setError(e.response?.data?.response_error || 'City search is unavailable.'); } finally { setLoading(false); } }, 300);
    return () => window.clearTimeout(timer);
  }, [query, enabled]);
  const done = () => { setResults([]); session.current = newSessionId(); };
  return { results, loading, error, done };
}
