import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { CitySuggestion } from './types';

/**
 * Debounced Google Places city suggestions (through the backend).
 * Call `done()` after a pick so the next search starts a new Google billing session.
 */
export function useCitySuggestions(query: string, enabled = true) {
  const [results, setResults] = useState<CitySuggestion[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const session = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!enabled || query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => { setLoading(true); setError(''); try { setResults(await api.searchCities(query.trim(), session.current)); } catch (e: any) { setResults([]); setError(e.response?.data?.response_error || 'City search is unavailable.'); } finally { setLoading(false); } }, 300);
    return () => window.clearTimeout(timer);
  }, [query, enabled]);
  const done = () => { setResults([]); session.current = crypto.randomUUID(); };
  return { results, loading, error, done };
}
