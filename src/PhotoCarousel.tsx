import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { assetUrl } from './api';
import type { PlacePhoto } from './types';
import './booking.css';

/** Google photos (through the backend proxy) with the credits Google requires. */
export function PhotoCarousel({ photos, title, className = '' }: { photos: PlacePhoto[]; title: string; className?: string }) {
  const [index, setIndex] = useState(0); const current = photos[Math.min(index, photos.length - 1)];
  useEffect(() => setIndex(0), [photos]);
  if (!current) return null;
  const go = (step: number) => setIndex((i) => (i + step + photos.length) % photos.length);
  return <div className={`booking-carousel ${className}`} aria-roledescription="carousel" aria-label={`Photos of ${title}`}>
    <img src={assetUrl(current.url)} alt={`${title}, photo ${index + 1} of ${photos.length}`}/>
    {photos.length > 1 && <><button type="button" className="carousel-nav prev" onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft size={20}/></button><button type="button" className="carousel-nav next" onClick={() => go(1)} aria-label="Next photo"><ChevronRight size={20}/></button><div className="carousel-dots">{photos.map((p, i) => <button type="button" key={p.url} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}`}/>)}</div></>}
    {current.attribution && <small className="photo-credit">Photo: {current.attributionUrl ? <a href={current.attributionUrl} target="_blank" rel="noreferrer">{current.attribution}</a> : current.attribution} · Google</small>}
  </div>;
}
