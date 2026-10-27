import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeftRight, Loader2, Plane, PlaneLanding, PlaneTakeoff, Search, Smartphone } from 'lucide-react';
import { api, apiError } from './api';
import { AirportPicker, Esims, FlightResults } from './TripBooking';
import { PhotoCarousel } from './PhotoCarousel';
import type { EsimList, FlightPlace, FlightPrices, User } from './types';
import './booking.css';

const today = () => new Date().toISOString().slice(0, 10);
const savedUser = (): User | null => { try { return JSON.parse(localStorage.getItem('gocity_user') || 'null'); } catch { return null; } };

/** Standalone travel marketplace: no trip needs to be created first. */
export function BookingPage() {
  const [origin, setOrigin] = useState<FlightPlace | null>(null);
  const [destination, setDestination] = useState<FlightPlace | null>(null);
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [flights, setFlights] = useState<FlightPrices | null>(null);
  const [esims, setEsims] = useState<EsimList | null>(null);
  const [flightError, setFlightError] = useState('');
  const [esimError, setEsimError] = useState('');
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingEsims, setLoadingEsims] = useState(false);

  // Start from the traveller's saved home airport, when they have one.
  useEffect(() => {
    const code = savedUser()?.homeAirportCode; if (!code) return;
    api.flightPlaces(code).then((places) => setOrigin((current) => current ?? places.find((p) => p.code === code) ?? null)).catch(() => undefined);
  }, []);

  const loadEsims = async (country: string) => {
    setLoadingEsims(true); setEsimError('');
    try { setEsims(await api.esims(country)); } catch (reason) { setEsims(null); setEsimError(apiError(reason, 'eSIM plans are unavailable right now.')); } finally { setLoadingEsims(false); }
  };

  const searchFlights = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!origin || !destination) return setFlightError('Pick where you fly from and to from the suggestions.');
    if (origin.code === destination.code) return setFlightError('Departure and destination must be different.');
    if (returnDate && returnDate < departDate) return setFlightError('The return date must be on or after the departure date.');
    const adults = Number(new FormData(event.currentTarget).get('adults')) || 1;
    setLoadingFlights(true); setFlightError('');
    try {
      setFlights(await api.flightPrices({ origin: origin.code, destination: destination.code, departDate, returnDate: returnDate || undefined, adults }));
    } catch (reason) {
      setFlights(null); setFlightError(apiError(reason, 'Flight search is unavailable right now.'));
    } finally { setLoadingFlights(false); }
    // Show the destination's eSIMs straight away, unless the traveller already looked one up.
    if (destination.countryCode && !esims) loadEsims(destination.countryCode);
  };

  const searchEsims = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const country = String(new FormData(event.currentTarget).get('country')).trim(); if (country) loadEsims(country); };
  const swap = () => { setOrigin(destination); setDestination(origin); };

  return <section className="booking-page travel-booking-page">
    <div className="booking-page-heading">
      <p className="eyebrow">TRAVEL BOOKINGS</p>
      <h1>Find your way there.</h1>
      <p className="muted">Compare flights from our partners and find an eSIM for your destination. No trip needed.</p>
    </div>

    <section className="booking-panel">
      <h2><Plane size={20}/> Flights</h2>
      <form className="flight-form standalone-flight-form" onSubmit={searchFlights}>
        <AirportPicker label="From" icon={<PlaneTakeoff size={15}/>} value={origin} onChange={setOrigin} placeholder="City or airport, e.g. Tunis"/>
        <AirportPicker label="To" icon={<PlaneLanding size={15}/>} value={destination} onChange={setDestination} placeholder="City or airport, e.g. Paris"/>
        <label>Departure<input type="date" required min={today()} value={departDate} onChange={(e) => { setDepartDate(e.target.value); if (returnDate && returnDate < e.target.value) setReturnDate(''); }}/></label>
        <label>Return <small>optional</small><input type="date" min={departDate || today()} value={returnDate} onChange={(e) => setReturnDate(e.target.value)}/></label>
        <label className="adults">Travellers<input name="adults" type="number" min="1" max="9" defaultValue="1"/></label>
        <button className="primary compact" disabled={loadingFlights}>{loadingFlights ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Search</button>
      </form>
      {(origin || destination) && <button type="button" className="text-link swap-route" onClick={swap}><ArrowLeftRight size={14}/> Swap from and to</button>}
      {flightError && <p className="error">{flightError}</p>}
      {loadingFlights && <p className="muted"><Loader2 size={14} className="spin"/> Comparing flights…</p>}
      {flights && !loadingFlights && <>
        {flights.destinationPhotos.length > 0 && <PhotoCarousel photos={flights.destinationPhotos} title={flights.route.destination?.cityName || flights.route.destinationCode}/>}
        <FlightResults result={flights}/>
        {!flights.offers.length && !flights.message && <p className="muted">No cached prices for this route. Use “All flights” to see live availability.</p>}
      </>}
    </section>

    <section className="booking-panel">
      <h2><Smartphone size={20}/> eSIM plans</h2>
      <form className="esim-search" onSubmit={searchEsims}>
        <label>Destination country<input name="country" required key={esims?.country?.code ?? 'empty'} defaultValue={esims?.country?.name ?? ''} placeholder="Portugal or PT"/></label>
        <button className="primary compact" disabled={loadingEsims}>{loadingEsims ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Find plans</button>
      </form>
      {esimError && <p className="error">{esimError}</p>}
      {loadingEsims && <p className="muted"><Loader2 size={14} className="spin"/> Looking for plans…</p>}
      {esims && !loadingEsims && <Esims esims={esims}/>}
    </section>
    <small className="booking-note">Prices and bookings are handled by our travel partners. GoCity may earn a commission.</small>
  </section>;
}
