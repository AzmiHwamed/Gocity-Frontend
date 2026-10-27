import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ExternalLink, Home, Loader2, Plane, PlaneLanding, PlaneTakeoff, Search, Smartphone, Users } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import { PhotoCarousel } from './PhotoCarousel';
import type { EsimList, FlightOffer, FlightPlace, FlightPrices, Traveller, Trip, TripBooking as TripBookingInfo, TripFlights } from './types';
import './booking.css';

const money = (amount: number, currency: string) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
const time = (iso: string) => iso.slice(11, 16);
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
const hours = (minutes: number | null) => (minutes == null ? null : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`);
const stopsLabel = (n: number | null) => (n == null ? '' : n === 0 ? 'Direct' : `${n} stop${n === 1 ? '' : 's'}`);
const placeLabel = (p: FlightPlace) => `${p.type === 'airport' ? p.name : p.cityName || p.name} (${p.code})${p.countryName ? ` · ${p.countryName}` : ''}`;
const placeName = (p: FlightPlace | null, code: string) => (p ? (p.type === 'airport' ? p.name : p.cityName || p.name) : code);
const names = (list: Traveller[]) => list.map((t) => (t.isMe ? 'You' : t.firstName)).join(', ');

/**
 * Booking for one trip, everything prefilled from it: destination photos, flights from each
 * member's home airport, a free flight search, and eSIM plans for the destination country.
 */
export function TripBooking({ trip }: { trip: Trip }) {
  const [info, setInfo] = useState<TripBookingInfo | null>(null); const [error, setError] = useState('');
  const [origin, setOrigin] = useState<FlightPlace | null>(null); const [destination, setDestination] = useState<FlightPlace | null>(null);
  const [result, setResult] = useState<FlightPrices | null>(null); const [busy, setBusy] = useState(false); const [searchError, setSearchError] = useState('');
  const [airportVersion, setAirportVersion] = useState(0); const [saving, setSaving] = useState('');

  useEffect(() => { setInfo(null); setResult(null); api.tripBooking(String(trip.id)).then((r) => { setInfo(r); setDestination(r.destination); setOrigin(r.myHomeAirport); }).catch((e) => setError(apiError(e, 'Booking suggestions are unavailable right now.'))); }, [trip.id, trip.cityPlaceId, trip.startDate, trip.endDate]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!origin || !destination) return setSearchError('Choose where you fly from and to.');
    const f = new FormData(event.currentTarget); setBusy(true); setSearchError('');
    try { setResult(await api.flightPrices({ origin: origin.code, destination: destination.code, departDate: String(f.get('departDate')), returnDate: String(f.get('returnDate') || '') || undefined, adults: Number(f.get('adults')) || 1 })); }
    catch (e) { setSearchError(apiError(e, 'Flight search failed. Please try again.')); }
    finally { setBusy(false); }
  };
  /** Your home airport is saved on your profile, so the whole group sees where you fly from. */
  const saveHomeAirport = async (p: FlightPlace | null) => {
    setOrigin(p); if (!p) return;
    setSaving('Saving your home airport…');
    try { await api.updateMe({ homeAirportCode: p.code }); setSaving(`Saved: you fly from ${placeName(p, p.code)}.`); setAirportVersion((v) => v + 1); }
    catch (e) { setSaving(apiError(e, 'Could not save your home airport.')); }
  };

  if (error) return <section className="booking-panel"><p className="muted">{error}</p></section>;
  if (!info) return <section className="booking-panel"><p className="muted"><Loader2 size={14} className="spin"/> Loading booking ideas…</p></section>;
  const photos = result?.destinationPhotos.length ? result.destinationPhotos : info.photos;

  return <section className="booking-panel">
    <div className="section-head"><div><p className="eyebrow">BOOK YOUR TRAVEL</p><h2>{info.destination ? `Getting to ${info.destination.cityName || info.destination.name}` : 'Flights & connectivity'}</h2><p className="muted booking-sub">{day(info.departDate)} – {day(info.returnDate)} · {info.adults} traveller{info.adults === 1 ? '' : 's'}</p></div></div>
    {photos.length > 0 && <PhotoCarousel photos={photos} title={info.destination?.cityName || trip.city || trip.name}/>}

    {info.destination && <TravellersFlights tripId={trip.id} reloadKey={airportVersion} onPickMine={saveHomeAirport} message={saving}/>}

    <h3 className="booking-title"><Search size={16}/> Search other flights</h3>
    <form className="flight-form" onSubmit={search}>
      <AirportPicker label="From (your home airport)" icon={<PlaneTakeoff size={15}/>} value={origin} onChange={saveHomeAirport} placeholder="Your city or airport"/>
      <AirportPicker label="To" icon={<PlaneLanding size={15}/>} value={destination} onChange={setDestination} placeholder="Destination"/>
      <label>Depart<input type="date" name="departDate" defaultValue={info.departDate} required/></label>
      <label>Return<input type="date" name="returnDate" defaultValue={info.returnDate}/></label>
      <label className="adults">Travellers<input type="number" name="adults" min={1} max={9} defaultValue={Math.min(info.adults, 9)}/></label>
      <button className="primary compact" disabled={busy}>{busy ? <Loader2 size={15} className="spin"/> : <Search size={15}/>} Find flights</button>
    </form>
    {searchError && <p className="error">{searchError}</p>}
    {result && <FlightResults result={result}/>}

    <Esims esims={info.esims}/>
    <small className="booking-note">Prices and bookings are handled by our travel partners. GoCity may earn a commission.</small>
  </section>;
}

/** One block per home airport: who flies from there and their cheapest options for the trip dates. */
function TravellersFlights({ tripId, reloadKey, onPickMine, message }: { tripId: number; reloadKey: number; onPickMine: (p: FlightPlace | null) => void; message: string }) {
  const [data, setData] = useState<TripFlights | null>(null); const [error, setError] = useState('');
  useEffect(() => { setError(''); api.tripFlights(String(tripId)).then(setData).catch((e) => setError(apiError(e, 'Flights for the group are unavailable right now.'))); }, [tripId, reloadKey]);
  const meMissing = data?.withoutAirport.find((t) => t.isMe);
  return <div className="travellers-flights">
    <h3 className="booking-title"><Users size={16}/> Flights for each traveller</h3>
    {message && <p className="flight-message info">{message}</p>}
    {error && <p className="muted">{error}</p>}
    {!data && !error && <p className="muted"><Loader2 size={14} className="spin"/> Finding flights for everyone…</p>}
    {data && <>
      {meMissing && <div className="home-airport-prompt"><Home size={15}/><span>Where do you usually fly from? Your choice is saved to your profile.</span><AirportPicker label="" icon={<PlaneTakeoff size={15}/>} value={null} onChange={onPickMine} placeholder="Your city or airport"/></div>}
      {data.groups.map((g) => <article className="traveller-group" key={g.originCode}>
        <header><div className="avatars">{g.travellers.slice(0, 4).map((t) => t.avatarUrl ? <img key={t.userId} src={assetUrl(t.avatarUrl)} alt="" title={`${t.firstName} ${t.lastName}`}/> : <span key={t.userId} title={`${t.firstName} ${t.lastName}`}>{t.firstName[0]}{t.lastName[0]}</span>)}</div><div><strong>{names(g.travellers)}</strong><small>From {placeName(g.origin, g.originCode)} ({g.originCode}) · {g.travellers.length} traveller{g.travellers.length === 1 ? '' : 's'}</small></div><a className="text-link" href={g.searchUrl} target="_blank" rel="noreferrer sponsored">All flights <ExternalLink size={12}/></a></header>
        {g.message && <p className={`flight-message${g.datesMatched === 'month' ? ' info' : ''}`}>{g.message}</p>}
        {g.offers.length > 0 && <div className="offer-list compact">{g.offers.map((o, i) => <OfferCard key={`${o.departureAt}-${o.flightNumber}-${i}`} offer={o} cheapest={i === 0}/>)}</div>}
      </article>)}
      {data.atDestination.length > 0 && <p className="muted traveller-note"><Home size={13}/> {names(data.atDestination)} {data.atDestination.length === 1 && !data.atDestination[0].isMe ? 'lives' : 'live'} at the destination: no flight needed.</p>}
      {data.withoutAirport.filter((t) => !t.isMe).length > 0 && <p className="muted traveller-note"><PlaneTakeoff size={13}/> No home airport yet: {names(data.withoutAirport.filter((t) => !t.isMe))}. They can set it from this panel.</p>}
      {!data.groups.length && !meMissing && !data.atDestination.length && <p className="muted">Nobody has a home airport yet.</p>}
    </>}
  </div>;
}

export function Esims({ esims }: { esims: EsimList }) {
  const checked = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  return <div className="esim-block">
    <h3 className="booking-title"><Smartphone size={17}/> Stay connected{esims.country ? <> in {esims.country.name} <img className="flag" src={esims.country.flagUrl} alt="" width={22} height={16}/></> : ''}</h3>
    {esims.message && <p className="flight-message info">{esims.message}</p>}
    {esims.plans.length > 0 && <div className="esim-plans" role="table" aria-label="eSIM plans">
      <div className="esim-plan head" role="row"><span role="columnheader">Plan</span><span role="columnheader">Data</span><span role="columnheader">Valid</span><span role="columnheader">Price</span><span/></div>
      {esims.plans.map((p, i) => <div className="esim-plan" role="row" key={`${p.provider}-${p.title}-${i}`}>
        <span role="cell"><b>{p.provider}</b>{p.network ? <small> · {p.network}</small> : null}<small className="plan-title">{p.title}</small></span>
        <span role="cell">{p.isUnlimited ? 'Unlimited' : p.dataLabel ?? '—'}</span>
        <span role="cell">{p.validityDays} day{p.validityDays === 1 ? '' : 's'}</span>
        <span role="cell"><b>{money(p.price, p.currency)}</b><small className={`plan-source ${p.source}`}>{p.source === 'airalo_api' ? 'Live price' : `Listed by GoCity · ${checked(p.checkedAt)}`}</small></span>
        <a role="cell" className="text-link" href={p.url} target="_blank" rel="noreferrer sponsored">View <ExternalLink size={12}/></a>
      </div>)}
    </div>}
    <div className="esim-grid">{esims.items.map((e) => <article className="esim-card" key={e.provider}><header><img src={e.providerLogo} alt="" width={28} height={28}/><div><strong>{e.provider}</strong><small>{e.title}</small></div></header><p>{e.description}</p><ul>{e.highlights.map((h) => <li key={h}>{h}</li>)}</ul><a className="text-link" href={e.url} target="_blank" rel="noreferrer sponsored">{e.ctaLabel} <ExternalLink size={13}/></a></article>)}</div>
  </div>;
}

export function FlightResults({ result }: { result: FlightPrices }) {
  const from = result.route.origin; const to = result.route.destination;
  return <div className="flight-results">
    <div className="flight-results-head"><strong>{from?.cityName || from?.name || result.route.originCode} → {to?.cityName || to?.name || result.route.destinationCode}</strong><a className="text-link" href={result.searchUrl} target="_blank" rel="noreferrer sponsored">All flights on {result.provider.name.split(' /')[0]} <ExternalLink size={13}/></a></div>
    {result.message && <p className={`flight-message${result.datesMatched === 'month' ? ' info' : ''}`}>{result.message}</p>}
    {result.offers.length > 0 && <div className="offer-list">{result.offers.map((o, i) => <OfferCard key={`${o.departureAt}-${o.flightNumber}-${i}`} offer={o} cheapest={i === 0}/>)}</div>}
  </div>;
}

function OfferCard({ offer: o, cheapest }: { offer: FlightOffer; cheapest: boolean }) {
  return <article className={`offer-card${cheapest ? ' cheapest' : ''}`}>
    <div className="offer-airline">{o.airline ? <img src={o.airline.logoUrl} alt="" width={36} height={36} loading="lazy"/> : <Plane size={20}/>}<div><strong>{o.airline?.name ?? 'Airline'}</strong><small>{o.flightNumber ?? ''}</small></div></div>
    <div className="offer-legs">
      <Leg label="Out" at={o.departureAt} from={o.originAirport} to={o.destinationAirport} minutes={o.durationMinutes} stops={o.stops}/>
      {o.returnAt && <Leg label="Back" at={o.returnAt} from={o.destinationAirport} to={o.originAirport} minutes={o.returnDurationMinutes} stops={o.returnStops}/>}
    </div>
    <div className="offer-price">{cheapest && <span className="badge">Cheapest</span>}<b>{money(o.price, o.currency)}</b><small>{o.returnAt ? 'round trip' : 'one way'}</small><a className="primary compact" href={o.bookingUrl} target="_blank" rel="noreferrer sponsored">{o.ctaLabel} <ExternalLink size={13}/></a></div>
  </article>;
}

function Leg({ label, at, from, to, minutes, stops }: { label: string; at: string; from: string | null; to: string | null; minutes: number | null; stops: number | null }) {
  return <div className="offer-leg"><span className="leg-label">{label}</span><span><b>{day(at)} · {time(at)}</b><small>{[from && to ? `${from} → ${to}` : null, hours(minutes), stopsLabel(stops)].filter(Boolean).join(' · ')}</small></span></div>;
}

/** City or airport autocomplete (Travelpayouts via the backend). */
export function AirportPicker({ label, icon, value, onChange, placeholder }: { label: string; icon: ReactNode; value: FlightPlace | null; onChange: (p: FlightPlace | null) => void; placeholder: string }) {
  const [text, setText] = useState(value ? placeLabel(value) : ''); const [results, setResults] = useState<FlightPlace[]>([]); const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(value ? placeLabel(value) : ''); }, [value]);
  useEffect(() => { input.current?.setCustomValidity(value ? '' : 'Pick a city or airport from the list.'); }, [value]);
  useEffect(() => {
    if (!open || text.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(() => api.flightPlaces(text.trim()).then(setResults).catch(() => setResults([])), 250);
    return () => window.clearTimeout(timer);
  }, [text, open]);
  return <label className="airport-picker">{label}<span className="airport-input">{icon}<input ref={input} value={text} placeholder={placeholder} autoComplete="off" required onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}/></span>
    {open && results.length > 0 && <span className="airport-results" role="listbox">{results.map((p) => <button type="button" role="option" aria-selected="false" key={`${p.type}-${p.code}`} onClick={() => { onChange(p); setOpen(false); setResults([]); }}>{p.type === 'airport' ? <PlaneLanding size={14}/> : <Plane size={14}/>}<span><strong>{p.type === 'airport' ? p.name : p.cityName || p.name} <em>{p.code}</em></strong><small>{p.type === 'airport' ? `Airport · ${p.cityName ?? ''}` : p.airportName ? `All airports · ${p.airportName}` : 'All airports'}{p.countryName ? ` · ${p.countryName}` : ''}</small></span></button>)}</span>}
  </label>;
}
