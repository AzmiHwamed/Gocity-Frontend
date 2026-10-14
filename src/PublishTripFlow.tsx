import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Globe2, Images, Link2, Lock, MapPin, Send, Wallet } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import { TripMediaManager, effectiveCover } from './TripMediaManager';
import { roleOf, type GalleryItem, type Trip } from './types';
import './publish-trip.css';
import './media-gallery.css';

type Visibility = 'private' | 'link' | 'public';
const STEPS = ['Story', 'Photos & cover', 'Visibility', 'Review'];
const money = (n?: number | null) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const me = () => { try { return JSON.parse(localStorage.getItem('gocity_user') || 'null')?.id as number | undefined; } catch { return undefined; } };

export function PublishTripFlow({ trip, onPublished }: { trip: Trip; onPublished?: () => void }) {
  const role = roleOf(trip); const isOwner = role === 'owner'; const tripId = String(trip.id);
  const [step, setStep] = useState(1);
  const [visibility, setVisibility] = useState<Visibility>(trip.visibility || 'private');
  const [story, setStory] = useState(trip.story || '');
  const [spent, setSpent] = useState(trip.actualSpentPerPerson ? String(trip.actualSpentPerPerson) : '');
  const [tips, setTips] = useState(trip.tips?.join('\n') || '');
  const [gallery, setGallery] = useState<GalleryItem[]>(trip.gallery || []); const [coverId, setCoverId] = useState<number | null>(trip.coverMediaId ?? null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [published, setPublished] = useState(false);
  const tipList = tips.split('\n').map((tip) => tip.trim()).filter(Boolean);
  const cover = effectiveCover(gallery, coverId);

  // Editors can add photos but only the owner publishes; viewers just see the gallery.
  if (!isOwner) return <div className="publish-flow"><div className="publish-panel"><p className="eyebrow">TRIP MEDIA</p><h3>{role === 'editor' ? 'Add photos & videos for the trip.' : 'Trip photos & videos'}</h3><p className="muted">{role === 'editor' ? 'Only the trip owner can publish the trip, but editors can add media and choose the cover.' : 'Only the trip owner can publish this trip.'}</p><TripMediaManager tripId={tripId} editable={role === 'editor'} canDeleteAny={false} myUserId={me()}/></div></div>;

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.shareDetails(tripId, { story: story.trim() || null, actualSpentPerPerson: spent ? Number(spent) : null, tips: tipList });
      await api.updateVisibility(tripId, visibility);
      setPublished(true); onPublished?.();
    } catch (cause) { setError(apiError(cause, 'We could not update this trip’s publishing settings.')); } finally { setBusy(false); }
  };
  if (published) return <div className="publish-success"><span><Check size={22}/></span><p className="eyebrow">PUBLISHED</p><h3>{visibility === 'public' ? 'Your trip is now discoverable.' : visibility === 'link' ? 'Your private link is ready.' : 'Your trip remains private.'}</h3><p>{visibility === 'public' ? 'Other travellers can now find it in Discover and make it their own.' : 'You can return at any time to change who can see it.'}</p><button className="primary compact" onClick={() => { setPublished(false); setStep(1); }}>Edit publishing settings</button></div>;

  const nav = (back: number | null, next: number | null, nextLabel = 'Continue') => <div className="publish-actions">{back ? <button type="button" className="back" onClick={() => setStep(back)}><ArrowLeft size={16}/> Back</button> : <span/>}{next && <button type="button" className="primary compact" onClick={() => setStep(next)}>{nextLabel} <ArrowRight size={16}/></button>}</div>;

  return <form className="publish-flow" onSubmit={save}>
    <div className="publish-steps">{STEPS.map((label, i) => <span key={label} className={`${step >= i + 1 ? 'done' : ''}${step === i + 1 ? ' current' : ''}`}>{i > 0 && <i/>}<button type="button" onClick={() => setStep(i + 1)}><em>{step > i + 1 ? <Check size={11}/> : i + 1}</em><b>{label}</b></button></span>)}</div>

    {step === 1 && <div className="publish-panel"><p className="eyebrow">STEP 1 · MAKE IT USEFUL</p><h3>Give travellers the context.</h3><p className="muted">Your itinerary stays intact. Add the details that make it easier for someone else to use.</p><label>Your trip story<textarea value={story} maxLength={5000} onChange={(e) => setStory(e.target.value)} placeholder="What made this trip memorable?" /><small className="counter">{story.length}/5000</small></label><div className="two"><label>Actual cost per person (€)<input type="number" min="0" step="0.01" value={spent} onChange={(e) => setSpent(e.target.value)} placeholder={trip.budgetPerPerson ? `Planned: ${money(trip.budgetPerPerson)}` : 'Optional'} /></label><label>Tips, one per line<textarea value={tips} onChange={(e) => setTips(e.target.value)} placeholder={'Book tickets online\nStart early'} /><small className="counter">{tipList.length}/20 tips</small></label></div>{nav(null, 2)}</div>}

    {step === 2 && <div className="publish-panel"><p className="eyebrow">STEP 2 · SHOW, DON’T TELL</p><h3>Add photos & choose the cover.</h3><p className="muted">Drop several photos or short videos at once. The cover is the first thing travellers see in Discover.</p><TripMediaManager tripId={tripId} myUserId={me()} onChange={(items, id) => { setGallery(items); setCoverId(id); }}/>{nav(1, 3)}</div>}

    {step === 3 && <div className="publish-panel"><p className="eyebrow">STEP 3 · CHOOSE WHO CAN SEE IT</p><h3>Set the visibility.</h3><div className="visibility-options">{([{ value: 'private', icon: Lock, title: 'Private', detail: 'Only people already in your trip can see it.' }, { value: 'link', icon: Link2, title: 'Anyone with the link', detail: 'Not listed in Discover; share it directly.' }, { value: 'public', icon: Globe2, title: 'Public on Discover', detail: 'Other travellers can find, save, and copy it.' }] as const).map(({ value, icon: Icon, title, detail }) => <button type="button" key={value} className={visibility === value ? 'selected' : ''} onClick={() => setVisibility(value)}><Icon size={19}/><span><b>{title}</b><small>{detail}</small></span><i>{visibility === value && <Check size={14}/>}</i></button>)}</div>{nav(2, 4, 'Review trip')}</div>}

    {step === 4 && <div className="publish-panel"><p className="eyebrow">STEP 4 · READY TO SHARE</p><h3>This is how travellers will see it.</h3>
      <article className="share-preview">
        <div className="preview-cover" style={{ backgroundImage: cover ? `linear-gradient(180deg, transparent 35%, rgba(10,40,60,.7)), url(${assetUrl(cover.url)})` : undefined }}>{!cover && <span className="preview-empty"><Images size={22}/> No cover yet</span>}<div><small>{trip.durationDays} days{trip.city ? ` · ${trip.city}` : ''}</small><b>{trip.name}</b></div></div>
        <div className="preview-body">
          <p className="preview-meta"><span><MapPin size={13}/> {[trip.city, trip.country].filter(Boolean).join(', ') || 'Destination to be added'}</span><span><CalendarDays size={13}/> {trip.startDate}</span><span><Wallet size={13}/> {spent ? `${money(Number(spent))} spent / person` : `${money(trip.budgetPerPerson)} budget / person`}</span></p>
          <p className="preview-story">{story.trim() ? (story.length > 220 ? `${story.slice(0, 220)}…` : story) : <em>No story yet — add one in step 1 so travellers know what made it special.</em>}</p>
          {tipList.length > 0 && <ul className="preview-tips">{tipList.slice(0, 3).map((t) => <li key={t}>{t}</li>)}{tipList.length > 3 && <li className="more">+{tipList.length - 3} more tips</li>}</ul>}
          {gallery.length > 0 && <div className="preview-strip">{gallery.slice(0, 6).map((m) => m.mimeType?.startsWith('video/') ? <video key={m.id} src={assetUrl(m.url)} muted/> : <img key={m.id} src={assetUrl(m.url)} alt=""/>)}{gallery.length > 6 && <span>+{gallery.length - 6}</span>}</div>}
        </div>
      </article>
      <div className="publish-summary"><span><Globe2 size={15}/> {visibility === 'public' ? 'Public on Discover' : visibility === 'link' ? 'Anyone with the link' : 'Private'} · {gallery.length} media · {tipList.length} tips</span></div>
      <p className="publish-note"><Send size={15}/> Publishing shares your trip name, destination, dates, itinerary, story, tips and all gallery media. It never shares trip-member email addresses or expenses.</p>
      {error && <p className="error">{error}</p>}
      <div className="publish-actions"><button type="button" className="back" onClick={() => setStep(3)}><ArrowLeft size={16}/> Back</button><button className="primary compact" disabled={busy}><Send size={16}/>{busy ? 'Publishing…' : visibility === 'public' ? 'Publish to Discover' : 'Save & share settings'}</button></div>
    </div>}
  </form>;
}
