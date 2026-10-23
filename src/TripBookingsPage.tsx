import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api, apiError } from './api';
import { TripBooking } from './TripBooking';
import type { Trip } from './types';

/** A dedicated booking workspace, linked from an individual trip. */
export function TripBookingsPage() {
  const { id = '' } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setTrip(null);
    setError('');
    api.trip(id).then(setTrip).catch((reason) => setError(apiError(reason, 'This trip could not be found.')));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!trip) return <p className="muted">Loading booking workspace…</p>;
  return <section className="booking-page">
    <Link className="text-link" to={`/trips/${trip.id}`}><ChevronLeft size={16}/> Back to {trip.name}</Link>
    <TripBooking trip={trip} />
  </section>;
}
