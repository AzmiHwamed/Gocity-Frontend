import { useState, type FormEvent } from 'react';
import { ExternalLink, Loader2, Plane, Search, Smartphone } from 'lucide-react';
import { api, apiError } from './api';
import type { EsimList, FlightOffer, FlightPrices } from './types';
import './booking.css';

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);

/** Standalone travel marketplace: no trip needs to be created first. */
export function BookingPage() {
  const [flights, setFlights] = useState<FlightPrices | null>(null);
  const [esims, setEsims] = useState<EsimList | null>(null);
  const [flightError, setFlightError] = useState('');
  const [esimError, setEsimError] = useState('');
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingEsims, setLoadingEsims] = useState(false);

  const searchFlights = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoadingFlights(true);
    setFlightError('');
    try {
      setFlights(await api.flightPrices({
        origin: String(form.get('origin')).trim().toUpperCase(),
        destination: String(form.get('destination')).trim().toUpperCase(),
        departDate: String(form.get('departDate')),
        returnDate: String(form.get('returnDate')) || undefined,
        adults: Number(form.get('adults')) || 1,
      }));
    } catch (reason) {
      setFlightError(apiError(reason, 'Flight search is unavailable right now.'));
    } finally {
      setLoadingFlights(false);
    }
  };

  const searchEsims = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const country = String(new FormData(event.currentTarget).get('country')).trim();
    if (!country) return;
    setLoadingEsims(true);
    setEsimError('');
    try {
      setEsims(await api.esims(country));
    } catch (reason) {
      setEsimError(apiError(reason, 'eSIM plans are unavailable right now.'));
    } finally {
      setLoadingEsims(false);
    }
  };

  return <section className="booking-page travel-booking-page">
    <div className="booking-page-heading">
      <p className="eyebrow">TRAVEL BOOKINGS</p>
      <h1>Find your way there.</h1>
      <p className="muted">Compare flights from Travelpayouts and browse destination eSIM plans.</p>
    </div>

    <section className="booking-panel">
      <h2><Plane size={20}/> Flights</h2>
      <form className="flight-form standalone-flight-form" onSubmit={searchFlights}>
        <label>From airport code<input name="origin" required minLength={3} maxLength={3} placeholder="TUN" /></label>
        <label>To airport code<input name="destination" required minLength={3} maxLength={3} placeholder="CDG" /></label>
        <label>Departure<input name="departDate" type="date" required /></label>
        <label>Return<input name="returnDate" type="date" /></label>
        <label>Travellers<input name="adults" type="number" min="1" max="9" defaultValue="1" /></label>
        <button className="primary compact" disabled={loadingFlights}>{loadingFlights ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Search</button>
      </form>
      {flightError && <p className="error">{flightError}</p>}
      {flights && <FlightResults result={flights} />}
    </section>

    <section className="booking-panel">
      <h2><Smartphone size={20}/> eSIM plans</h2>
      <form className="esim-search" onSubmit={searchEsims}>
        <label>Destination country<input name="country" required placeholder="Portugal or PT" /></label>
        <button className="primary compact" disabled={loadingEsims}>{loadingEsims ? <Loader2 className="spin" size={16}/> : <Search size={16}/>} Find plans</button>
      </form>
      {esimError && <p className="error">{esimError}</p>}
      {esims && <EsimPlans esims={esims} />}
    </section>
  </section>;
}

function FlightResults({ result }: { result: FlightPrices }) {
  return <div className="flight-results">
    <div className="flight-results-head"><strong>{result.route.origin?.cityName || result.route.originCode} → {result.route.destination?.cityName || result.route.destinationCode}</strong><a className="text-link" href={result.searchUrl} target="_blank" rel="noreferrer sponsored">All flights <ExternalLink size={13}/></a></div>
    {result.message && <p className="flight-message">{result.message}</p>}
    {result.offers.length > 0 && <div className="offer-list">{result.offers.map((offer, index) => <FlightOfferCard key={`${offer.departureAt}-${index}`} offer={offer} />)}</div>}
  </div>;
}

function FlightOfferCard({ offer }: { offer: FlightOffer }) {
  return <article className="offer-card">
    <div className="offer-airline"><strong>{offer.airline?.name || 'Flight option'}</strong><small>{offer.flightNumber || 'Details on partner site'}</small></div>
    <div className="offer-legs"><b>{offer.departureAt.slice(11, 16)} · {offer.originAirport || 'Origin'} → {offer.destinationAirport || 'Destination'}</b><small>{offer.stops === 0 ? 'Direct' : `${offer.stops} stop${offer.stops === 1 ? '' : 's'}`}</small></div>
    <div className="offer-price"><b>{money(offer.price, offer.currency)}</b><a className="primary compact" href={offer.bookingUrl} target="_blank" rel="noreferrer sponsored">Book <ExternalLink size={13}/></a></div>
  </article>;
}

function EsimPlans({ esims }: { esims: EsimList }) {
  return <div className="esim-block">
    {esims.message && <p className="flight-message info">{esims.message}</p>}
    {esims.plans.length ? <div className="esim-plans">{esims.plans.map((plan, index) => <div className="esim-plan" key={`${plan.provider}-${plan.title}-${index}`}><span><b>{plan.provider}</b><small>{plan.title}</small></span><span>{plan.isUnlimited ? 'Unlimited' : plan.dataLabel || '—'}</span><span>{plan.validityDays} days</span><span><b>{money(plan.price, plan.currency)}</b></span><a className="text-link" href={plan.url} target="_blank" rel="noreferrer sponsored">View <ExternalLink size={12}/></a></div>)}</div> : <p className="muted">No listed plans for this destination yet.</p>}
  </div>;
}
