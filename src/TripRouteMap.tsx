/// <reference types="google.maps" />
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { APIProvider, AdvancedMarker, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, Bed, Car, ExternalLink, Footprints, MapPin, MapPinned, Navigation, TrainFront } from 'lucide-react';
import { api, apiError } from './api';
import { canEdit, type Activity, type DayRoute, type RouteLeg, type RouteStop, type Trip } from './types';
import { directions, distance, duration, legPath, offlineRoute, stopPoint, type LatLng } from './tripRoute';
import './trip-route.css';

// Browser key: restrict it to your site's URLs and to the Maps JavaScript API only.
// The server's Google key must never be used here.
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;
const MODE_LABEL = { walking: 'walking', transit: 'public transport', driving: 'driving' };
const LEG_STYLE: Record<RouteLeg['mode'], { color: string; dotted: boolean; label: string; icon: typeof Footprints }> = {
  walk: { color: '#0cb8c0', dotted: true, label: 'walk', icon: Footprints },
  public_transport: { color: '#7b5cf0', dotted: false, label: 'public transport', icon: TrainFront },
  drive: { color: '#1f4e79', dotted: false, label: 'drive', icon: Car },
};

/** /trips/:id/route: one day at a time. Real routes between the activities (Google Routes, via the backend). */
export function TripRoute() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [trip, setTrip] = useState<Trip | null>(null); const [activities, setActivities] = useState<Activity[]>([]); const [error, setError] = useState('');
  const requestedDay = Number(searchParams.get('day')) || 1;
  const requestedActivity = Number(searchParams.get('activity')) || null;
  const [day, setDay] = useState(() => requestedDay); const [includeHotel, setIncludeHotel] = useState(false); const [selected, setSelected] = useState<number | null>(null);
  const [route, setRoute] = useState<DayRoute | null>(null); const [loading, setLoading] = useState(false); const [offline, setOffline] = useState('');
  useEffect(() => { api.trip(id).then(setTrip).catch(() => setError('This trip could not be found or you no longer have access to it.')); api.activities(id).then((v) => setActivities(Array.isArray(v) ? v : v.items || [])).catch(() => {}); }, [id]);
  useEffect(() => {
    let live = true; setLoading(true); setSelected(null);
    api.tripRoute(id, day, includeHotel).then((r) => { if (live) { setRoute(r); setOffline(''); } }).catch((e) => { if (live) { setRoute(null); setOffline(apiError(e, 'Routes are unavailable right now.')); } }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, day, includeHotel]);
  // If the route endpoint fails, still show the stops with straight lines.
  const shown = useMemo(() => route ?? (trip && offline ? offlineRoute(trip, activities, day, includeHotel) : null), [route, trip, offline, activities, day, includeHotel]);
  const link = useMemo(() => (shown ? directions(shown) : null), [shown]);
  useEffect(() => {
    if (!requestedActivity || !shown) return;
    const index = shown.stops.findIndex((stop) => stop.activityId === requestedActivity);
    if (index >= 0) setSelected(index);
  }, [requestedActivity, shown]);

  if (error) return <p className="error">{error}</p>;
  if (!trip) return <p className="muted">Loading your route…</p>;
  const activityCount = shown?.stops.filter((s) => s.kind === 'activity').length ?? 0;
  const hotelLocated = trip.hotelLatitude != null && trip.hotelLongitude != null;

  return <section className="extra-page trip-route">
    <div className="extra-heading"><div><p className="eyebrow">ACTIVITY MAP</p><h1>See the route.</h1><p>{trip.name} · how to get from one activity to the next.</p></div><Link className="outline-button" to={`/trips/${id}`}>Back to trip</Link></div>
    <div className="route-toolbar"><div className="day-switcher">{Array.from({ length: trip.durationDays || 1 }, (_, i) => <button className={day === i + 1 ? 'selected' : ''} onClick={() => setDay(i + 1)} key={i}>Day {i + 1}</button>)}</div><label className={`route-toggle${hotelLocated ? '' : ' disabled'}`} title={hotelLocated ? '' : 'Choose a hotel for the trip first'}><input type="checkbox" checked={includeHotel} disabled={!hotelLocated} onChange={(e) => setIncludeHotel(e.target.checked)}/> Start and end at the hotel</label></div>
    {!trip.cityPlaceId && <div className="route-warning"><AlertTriangle size={15}/><span>This trip has no destination city yet. {canEdit(trip) ? <>Set it on the <Link to={`/trips/${id}`}>trip page</Link> so place search works nearby.</> : ''}</span></div>}
    <div className="route-layout">
      <div className="route-canvas">{MAPS_KEY ? <RouteMap trip={trip} route={shown} selected={selected} onSelect={setSelected}/> : <MapSetup/>}{loading && <span className="route-loading">Finding routes…</span>}</div>
      <div className="route-stops">
        <p className="eyebrow">DAY {day}{shown?.date ? ` · ${new Date(`${shown.date}T00:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''} · {activityCount} STOP{activityCount === 1 ? '' : 'S'}</p>
        {shown && shown.totalDurationSeconds > 0 && <p className="route-total">Travel: <b>{duration(shown.totalDurationSeconds)}</b> · {distance(shown.totalDistanceMeters)}</p>}
        {shown && shown.warnings.length > 0 && <ul className="route-warnings">{shown.warnings.map((w) => <li key={w}><AlertTriangle size={13}/>{w}</li>)}</ul>}
        {shown && shown.missing.length > 0 && <p className="route-hint">Not on the map: {shown.missing.map((m) => `${m.name} (${m.startTime})`).join(', ')}.{canEdit(trip) ? <> Edit {shown.missing.length === 1 ? 'it' : 'them'} on the <Link to={`/trips/${id}`}>trip page</Link> and pick the place from the search.</> : ''}</p>}
        {shown?.stops.length ? <ol className="route-list">{shown.stops.map((s, i) => <Fragment key={`${s.kind}-${i}`}>{i > 0 && <LegRow leg={shown.legs[i - 1]}/>}<StopRow stop={s} number={s.kind === 'activity' ? shown.stops.slice(0, i + 1).filter((x) => x.kind === 'activity').length : null} active={selected === i} onClick={() => setSelected(i)}/></Fragment>)}</ol> : !loading && <p className="muted">No stops yet. Add an activity with a place to build your route.</p>}
        {link?.url && <a className="primary compact route-open" href={link.url} target="_blank" rel="noreferrer"><Navigation size={15}/> Open this day in Google Maps <ExternalLink size={13}/></a>}
        {link?.url && (shown?.stops.length ?? 0) > 1 && <small className="route-note">Google Maps opens with {MODE_LABEL[link.mode]} for the whole day{link.mode === 'transit' && (shown?.stops.length ?? 0) > 2 ? ' (it shows public transport from the first to the last stop only)' : ''}{link.truncated ? '. Only the first 11 stops fit in the link.' : '.'}</small>}
      </div>
    </div>
  </section>;
}

function StopRow({ stop, number, active, onClick }: { stop: RouteStop; number: number | null; active: boolean; onClick: () => void }) {
  return <li className={`stop-${stop.kind}${active ? ' active' : ''}`}><button type="button" onClick={onClick}><b>{stop.kind === 'hotel' ? <Bed size={13}/> : number}</b><div><strong>{stop.name}</strong><p>{stop.startTime ? `${stop.startTime}–${stop.endTime} · ` : ''}{stop.place || (stop.kind === 'hotel' ? 'Hotel' : '')}</p></div></button></li>;
}

function LegRow({ leg }: { leg?: RouteLeg }) {
  if (!leg) return null;
  const style = LEG_STYLE[leg.mode]; const Icon = style.icon;
  const text = leg.status === 'ok' && leg.durationSeconds != null ? <>{duration(leg.durationSeconds)} {style.label}{leg.distanceMeters ? ` · ${distance(leg.distanceMeters)}` : ''}{leg.transit && leg.transit !== 'On foot' ? <em> · {leg.transit}</em> : null}</> : leg.status === 'no_route' ? <>No {style.label} route found</> : <>Route unavailable</>;
  return <li className={`route-leg ${leg.mode}${leg.late ? ' late' : ''}${leg.status !== 'ok' ? ' failed' : ''}`} aria-label="Travel to the next stop"><span className="leg-line" style={{ borderColor: style.color }}/><Icon size={13}/><span>{text}{leg.late && <strong> · {leg.gapMinutes != null && leg.gapMinutes < 0 ? 'times overlap' : `only ${leg.gapMinutes} min between`}</strong>}</span></li>;
}

/** Shown until VITE_GOOGLE_MAPS_KEY is set; the stops, travel times and the Google Maps link still work. */
function MapSetup() {
  return <div className="map-setup"><MapPinned size={28}/><strong>The map isn't set up yet</strong><p>Add a Google Maps browser key to the frontend <code>.env</code> and restart Vite:</p><pre>VITE_GOOGLE_MAPS_KEY=…{'\n'}VITE_GOOGLE_MAP_ID=…</pre><small>Travel times between stops and “Open this day in Google Maps” work without it.</small></div>;
}

function RouteMap({ trip, route, selected, onSelect }: { trip: Trip; route: DayRoute | null; selected: number | null; onSelect: (index: number) => void }) {
  const city = trip.cityLatitude != null && trip.cityLongitude != null ? { lat: Number(trip.cityLatitude), lng: Number(trip.cityLongitude) } : null;
  const stops = route?.stops ?? [];
  const center = stops[0] ? stopPoint(stops[0]) : city ?? { lat: 20, lng: 0 };
  // With the hotel, it is both the first and last stop: one marker.
  const markers = stops.filter((s, i) => !(s.kind === 'hotel' && i > 0));
  const paths = useMemo(() => (route ? route.legs.map((l) => ({ leg: l, path: legPath(l, stops) })) : []), [route]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = paths.flatMap((p) => p.path).concat(stops.map(stopPoint));
  let n = 0;
  return <APIProvider apiKey={MAPS_KEY as string}>
    <Map defaultCenter={center} defaultZoom={stops.length || city ? 13 : 2} mapId={MAP_ID || undefined} gestureHandling="greedy" clickableIcons={false} className="route-google-map">
      {markers.map((s) => { const label = s.kind === 'hotel' ? 'H' : String(++n); return MAP_ID
        ? <AdvancedMarker key={s.index} position={stopPoint(s)} title={s.name} zIndex={selected === s.index ? 10 : 1} onClick={() => onSelect(s.index)}><span className={`route-pin ${s.kind}${selected === s.index ? ' active' : ''}`}>{s.kind === 'hotel' ? <Bed size={14}/> : label}</span></AdvancedMarker>
        : <Marker key={s.index} position={stopPoint(s)} title={s.name} label={label} zIndex={selected === s.index ? 10 : 1} onClick={() => onSelect(s.index)}/>; })}
      {paths.map(({ leg, path }) => <LegLine key={`${leg.from}-${leg.to}-${leg.polyline ?? 'straight'}`} path={path} mode={leg.mode} straight={!leg.polyline}/>)}
      <FitBounds points={all} selected={selected != null && stops[selected] ? stopPoint(stops[selected]) : null}/>
    </Map>
    {!stops.length && <div className="map-empty"><MapPin size={16}/> Nothing to show on the map for this day yet.</div>}
  </APIProvider>;
}

/** One leg on the map: dotted for walking (and straight fallbacks), solid for transit and driving. */
function LegLine({ path, mode, straight }: { path: LatLng[]; mode: RouteLeg['mode']; straight: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const { color, dotted } = LEG_STYLE[mode];
    const dots = dotted || straight;
    const line = new google.maps.Polyline({ map, path, strokeColor: straight ? '#9ab0bd' : color, strokeOpacity: dots ? 0 : 0.9, strokeWeight: 5, icons: dots ? [{ icon: { path: google.maps.SymbolPath.CIRCLE, scale: 3, fillColor: straight ? '#9ab0bd' : color, fillOpacity: 1, strokeOpacity: 0 }, offset: '0', repeat: '12px' }] : undefined });
    return () => line.setMap(null);
  }, [map, path, mode, straight]);
  return null;
}

/** Fits the whole day in view; pans to a stop picked from the list. */
function FitBounds({ points, selected }: { points: LatLng[]; selected: LatLng | null }) {
  const map = useMap(); const key = JSON.stringify(points.length ? [points[0], points[points.length - 1], points.length] : []);
  useEffect(() => {
    if (!map || !points.length) return;
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(15); return; }
    const bounds = new google.maps.LatLngBounds(); points.forEach((p) => bounds.extend(p)); map.fitBounds(bounds, 56);
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (map && selected) map.panTo(selected); }, [map, selected]);
  return null;
}
