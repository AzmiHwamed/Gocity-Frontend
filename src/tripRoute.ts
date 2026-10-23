import type { Activity, DayRoute, RouteLeg, RouteStop, Trip } from './types';

export interface LatLng { lat: number; lng: number }
export type TravelMode = 'walking' | 'transit' | 'driving';

const MODES: Record<NonNullable<Activity['transportation']>, TravelMode> = { walk: 'walking', public_transport: 'transit', drive: 'driving' };
/** Google Maps directions URLs accept up to 9 stops between origin and destination. */
const MAX_WAYPOINTS = 9;
const located = (lat?: number | null, lng?: number | null) => lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

export const stopPoint = (s: RouteStop): LatLng => ({ lat: s.latitude, lng: s.longitude });

/** Decodes a Google encoded polyline (https://developers.google.com/maps/documentation/utilities/polylinealgorithm). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []; let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0; let shift = 0; let byte: number;
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** The leg's drawn path: Google's route, or a straight line when there is none. */
export const legPath = (leg: RouteLeg, stops: RouteStop[]): LatLng[] => (leg.polyline ? decodePolyline(leg.polyline) : [stopPoint(stops[leg.from]), stopPoint(stops[leg.to])]);

/**
 * The same day built in the browser, without routes (straight lines), for when the route
 * endpoint can't be reached.
 */
export function offlineRoute(trip: Trip, activities: Activity[], day: number, includeHotel: boolean): DayRoute {
  const today = activities.filter((a) => a.dayNumber === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const stops: RouteStop[] = []; const missing: DayRoute['missing'] = [];
  for (const a of today) {
    const meeting = located(a.meetingLatitude, a.meetingLongitude);
    if (!meeting && !located(a.placeLatitude, a.placeLongitude)) { missing.push({ id: a.id, name: a.name, startTime: a.startTime.slice(0, 5) }); continue; }
    stops.push({ index: 0, kind: 'activity', activityId: a.id, name: a.name, place: meeting ? a.meetingPointText || 'Meeting point' : a.placeName ?? null, startTime: a.startTime.slice(0, 5), endTime: a.endTime.slice(0, 5), latitude: Number(meeting ? a.meetingLatitude : a.placeLatitude), longitude: Number(meeting ? a.meetingLongitude : a.placeLongitude), transportation: a.transportation });
  }
  const withHotel = includeHotel && located(trip.hotelLatitude, trip.hotelLongitude) && stops.length > 0;
  if (withHotel) {
    const hotel = (): RouteStop => ({ index: 0, kind: 'hotel', activityId: null, name: trip.hotelName || 'Hotel', place: trip.hotelAddress ?? null, startTime: null, endTime: null, latitude: Number(trip.hotelLatitude), longitude: Number(trip.hotelLongitude) });
    stops.unshift(hotel()); stops.push(hotel());
  }
  stops.forEach((s, i) => (s.index = i));
  const legs: RouteLeg[] = stops.slice(1).map((to, i) => ({ from: i, to: i + 1, mode: (to.transportation ?? stops[i].transportation ?? 'walk'), status: 'failed', distanceMeters: null, durationSeconds: null, polyline: null, transit: null, gapMinutes: null, late: false }));
  return { day, date: '', includeHotel: withHotel, stops, legs, missing, totalDistanceMeters: 0, totalDurationSeconds: 0, routingAvailable: false, warnings: ['Routes could not be loaded; showing straight lines between stops.'] };
}

/** A google.com/maps link for the day (no key needed): directions through the stops, or the single place. */
export function directions(route: Pick<DayRoute, 'stops' | 'legs'>): { url: string | null; mode: TravelMode; truncated: boolean } {
  const path = route.stops.map(stopPoint);
  const counts = new Map<TravelMode, number>();
  route.legs.forEach((l) => { const m = MODES[l.mode] ?? 'walking'; counts.set(m, (counts.get(m) ?? 0) + 1); });
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'walking';
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  if (!path.length) return { url: null, mode, truncated: false };
  if (path.length === 1) return { url: `https://www.google.com/maps/search/?api=1&query=${fmt(path[0])}`, mode, truncated: false };
  const truncated = path.length > MAX_WAYPOINTS + 2;
  const used = truncated ? path.slice(0, MAX_WAYPOINTS + 2) : path;
  const params = new URLSearchParams({ api: '1', origin: fmt(used[0]), destination: fmt(used[used.length - 1]), travelmode: mode });
  const middle = used.slice(1, -1);
  if (middle.length) params.set('waypoints', middle.map(fmt).join('|'));
  return { url: `https://www.google.com/maps/dir/?${params.toString()}`, mode, truncated };
}

/** "1 h 05 min", "12 min". */
export const duration = (seconds: number) => { const m = Math.max(1, Math.round(seconds / 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };
/** "850 m", "7.3 km". */
export const distance = (meters: number) => (meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`);
