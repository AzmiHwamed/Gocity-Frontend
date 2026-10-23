import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import type { GalleryItem, OrganizationProgram, OrganizationProgramType, ProgramStop } from './types';
import './program-editor.css';

const CATEGORIES = ['Food & drink', 'Culture & history', 'Nature & outdoors', 'Adventure', 'Art & crafts', 'Nightlife', 'Wellness', 'Family', 'Day trip', 'Multi-day tour'];
const CURRENCIES = ['EUR', 'USD', 'TND', 'GBP', 'MAD', 'TRY'];
const MAX_IMAGES = 10;
const lines = (text: string) => text.split('\n').map((x) => x.trim()).filter(Boolean);
const joinLines = (items?: string[] | null) => (items ?? []).join('\n');
const emptyStop = (dayNumber = 1): ProgramStop => ({ name: '', dayNumber, startTime: '10:00', endTime: '12:00', placeName: '', description: '', expense: 0 });
const stopsOf = (program?: OrganizationProgram | null): ProgramStop[] => { if (!program) return [emptyStop()]; const raw = (Array.isArray(program.content) ? program.content : [program.content]) as ProgramStop[]; return raw.length ? raw.map((s) => ({ ...emptyStop(s.dayNumber ?? 1), ...s, startTime: s.startTime?.slice(0, 5), endTime: s.endTime?.slice(0, 5) })) : [emptyStop()]; };

/** Create or edit an organization program, including its photos. Saves the program first, then uploads new photos to it. */
export function ProgramEditor({ program, onSaved, onCancel }: { program?: OrganizationProgram | null; onSaved: (program: OrganizationProgram) => void; onCancel?: () => void }) {
  const editing = Boolean(program);
  const [type, setType] = useState<OrganizationProgramType>(program?.programType ?? 'activity');
  const [stops, setStops] = useState<ProgramStop[]>(() => stopsOf(program));
  const [images, setImages] = useState<GalleryItem[]>(program?.images ?? []);
  const [coverId, setCoverId] = useState<number | null>(program?.coverImageId ?? program?.images?.[0]?.id ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [imageBusy, setImageBusy] = useState<number | null>(null), [error, setError] = useState('');
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { setType(program?.programType ?? 'activity'); setStops(stopsOf(program)); setImages(program?.images ?? []); setCoverId(program?.coverImageId ?? program?.images?.[0]?.id ?? null); setFiles([]); setError(''); }, [program?.id]);

  const setStop = (index: number, patch: Partial<ProgramStop>) => setStops((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const addFiles = (list: FileList | null) => { if (!list) return; const room = MAX_IMAGES - images.length - files.length; const picked = Array.from(list).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room)); if (list.length > picked.length) setError(`A program can have up to ${MAX_IMAGES} photos.`); setFiles((current) => [...current, ...picked]); };
  const removeExisting = async (image: GalleryItem) => { if (!program || !confirm('Remove this photo from the program?')) return; setImageBusy(image.id); try { await api.removeProgramImage(program.id, image.id); setImages((list) => list.filter((x) => x.id !== image.id)); if (coverId === image.id) setCoverId(null); } catch (e) { setError(apiError(e)); } finally { setImageBusy(null); } };
  const makeCover = async (image: GalleryItem) => { if (!program) return; setImageBusy(image.id); try { await api.setProgramCover(program.id, image.id); setCoverId(image.id); } catch (e) { setError(apiError(e)); } finally { setImageBusy(null); } };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formEl = event.currentTarget; const form = new FormData(formEl); const text = (name: string) => String(form.get(name) ?? '').trim(); const num = (name: string) => (text(name) === '' ? null : Number(text(name)));
    const cleanStops = stops.map((s, i) => ({ name: (s.name ?? '').trim(), description: s.description?.trim() || null, dayNumber: type === 'trip' ? Number(s.dayNumber) || 1 : 1, startTime: s.startTime || '10:00', endTime: s.endTime || '12:00', placeName: s.placeName?.trim() || null, expense: Number(s.expense) || 0, _i: i }));
    const invalid = cleanStops.find((s) => !s.name || s.endTime <= s.startTime);
    if (invalid) return setError(!invalid.name ? `Give stop ${invalid._i + 1} a name.` : `Stop ${invalid._i + 1} must end after it starts.`);
    const durationDays = Math.max(Number(form.get('durationDays')) || 1, ...cleanStops.map((s) => s.dayNumber));
    const content = cleanStops.map(({ _i, ...s }) => s);
    const input = {
      programType: type, title: text('title'), description: text('description') || null, destination: text('destination') || null, durationDays,
      category: text('category') || null, price: num('price'), currency: text('currency') || null, difficulty: text('difficulty') || null, maxGroupSize: num('maxGroupSize'),
      languages: text('languages') ? text('languages').split(',').map((x) => x.trim()).filter(Boolean) : null,
      highlights: lines(text('highlights')), included: lines(text('included')), excluded: lines(text('excluded')), whatToBring: lines(text('whatToBring')),
      meetingPoint: text('meetingPoint') || null, cancellationPolicy: text('cancellationPolicy') || null, bookingUrl: text('bookingUrl') || null,
      isPublished: form.get('isPublished') === 'on',
      ...(type === 'activity' ? { activity: content[0] } : { itinerary: content }),
    };
    setBusy(true); setError('');
    try {
      const saved = editing && program ? await api.updateOrganizationProgram(program.id, input) : await api.createOrganizationProgram(input);
      let uploaded: GalleryItem[] = [];
      if (files.length) uploaded = await api.addProgramImages(saved.id, files);
      const allImages = [...images, ...uploaded];
      // The first photo becomes the cover when none has been chosen yet.
      if (!coverId && allImages[0]) await api.setProgramCover(saved.id, allImages[0].id).catch(() => undefined);
      setFiles([]); if (!editing) formEl.reset();
      onSaved({ ...saved, images: allImages, coverImageId: coverId ?? allImages[0]?.id ?? null });
      if (!editing) { setStops([emptyStop()]); setImages([]); setCoverId(null); }
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  const p = program;
  return <form className="org-form program-editor" onSubmit={submit} key={p?.id ?? 'new'}>
    <div className="editor-head"><div><p className="eyebrow">{editing ? 'EDIT PROGRAM' : 'NEW PROGRAM'}</p><h2>{editing ? p?.title : 'Create a program'}</h2></div>{onCancel && <button type="button" className="icon-button" onClick={onCancel} aria-label="Close editor"><X size={18}/></button>}</div>
    <div className="segmented" role="radiogroup" aria-label="Program type"><button type="button" className={type === 'activity' ? 'active' : ''} onClick={() => { setType('activity'); setStops((s) => s.slice(0, 1)); }}>Single activity</button><button type="button" className={type === 'trip' ? 'active' : ''} onClick={() => setType('trip')}>Multi-stop itinerary</button></div>

    <fieldset><legend>Basics</legend>
      <label>Title<input name="title" required maxLength={200} defaultValue={p?.title} placeholder="Sunset food walk in the Medina"/></label>
      <label>Description<textarea name="description" rows={4} maxLength={5000} defaultValue={p?.description ?? ''} placeholder="What makes this experience special?"/></label>
      <div className="two"><label>Destination<input name="destination" maxLength={150} defaultValue={p?.destination ?? ''} placeholder="Tunis"/></label><label>Category<input name="category" list="program-categories" maxLength={80} defaultValue={p?.category ?? ''} placeholder="Food & drink"/><datalist id="program-categories">{CATEGORIES.map((c) => <option key={c} value={c}/>)}</datalist></label></div>
      <div className="three"><label>Duration (days)<input name="durationDays" type="number" min={1} defaultValue={p?.durationDays ?? 1}/></label><label>Price per person<input name="price" type="number" min={0} step="0.01" defaultValue={p?.price ?? ''} placeholder="45"/></label><label>Currency<select name="currency" defaultValue={p?.currency ?? 'EUR'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div className="three"><label>Difficulty<select name="difficulty" defaultValue={p?.difficulty ?? ''}><option value="">Not specified</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option></select></label><label>Max group size<input name="maxGroupSize" type="number" min={1} defaultValue={p?.maxGroupSize ?? ''} placeholder="12"/></label><label>Languages<input name="languages" defaultValue={(p?.languages ?? []).join(', ')} placeholder="English, French"/></label></div>
    </fieldset>

    <fieldset><legend>Photos <small>{images.length + files.length}/{MAX_IMAGES}</small></legend>
      <div className="photo-grid">
        {images.map((image) => <figure key={image.id} className={coverId === image.id ? 'is-cover' : ''}><img src={assetUrl(image.url)} alt=""/>{coverId === image.id && <span className="cover-badge">Cover</span>}<figcaption>{coverId !== image.id && <button type="button" onClick={() => makeCover(image)} disabled={imageBusy === image.id} title="Use as cover"><Star size={14}/></button>}<button type="button" onClick={() => removeExisting(image)} disabled={imageBusy === image.id} title="Remove photo">{imageBusy === image.id ? <Loader2 className="spin" size={14}/> : <Trash2 size={14}/>}</button></figcaption></figure>)}
        {previews.map((url, i) => <figure key={url} className="pending"><img src={url} alt=""/><span className="cover-badge muted-badge">New</span><figcaption><button type="button" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} title="Don't upload"><X size={14}/></button></figcaption></figure>)}
        {images.length + files.length < MAX_IMAGES && <label className="photo-add"><ImagePlus size={22}/><span>Add photos</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}/></label>}
      </div>
      <small className="muted">The cover photo is shown first on cards and the program page. New photos upload when you save.</small>
    </fieldset>

    <fieldset><legend>{type === 'activity' ? 'The activity' : 'Itinerary stops'}</legend>
      {stops.map((stop, i) => <div className="stop-card" key={i}>
        {type === 'trip' && <div className="stop-head"><b>Stop {i + 1}</b>{stops.length > 1 && <button type="button" className="icon-button" onClick={() => setStops((list) => list.filter((_, j) => j !== i))} aria-label={`Remove stop ${i + 1}`}><Trash2 size={15}/></button>}</div>}
        <label>Name<input required maxLength={200} value={stop.name ?? ''} onChange={(e) => setStop(i, { name: e.target.value })} placeholder="Walk through the Medina"/></label>
        <div className={type === 'trip' ? 'four' : 'three'}>{type === 'trip' && <label>Day<input type="number" min={1} value={stop.dayNumber ?? 1} onChange={(e) => setStop(i, { dayNumber: Number(e.target.value) })}/></label>}<label>Start<input type="time" required value={stop.startTime ?? ''} onChange={(e) => setStop(i, { startTime: e.target.value })}/></label><label>End<input type="time" required value={stop.endTime ?? ''} onChange={(e) => setStop(i, { endTime: e.target.value })}/></label><label>Cost<input type="number" min={0} step="0.01" value={stop.expense ?? 0} onChange={(e) => setStop(i, { expense: Number(e.target.value) })}/></label></div>
        <label>Place<input maxLength={200} value={stop.placeName ?? ''} onChange={(e) => setStop(i, { placeName: e.target.value })} placeholder="Meeting place or venue"/></label>
        <label>What happens here<textarea rows={2} maxLength={2000} value={stop.description ?? ''} onChange={(e) => setStop(i, { description: e.target.value })}/></label>
      </div>)}
      {type === 'trip' && <button type="button" className="secondary compact add-stop" onClick={() => setStops((list) => [...list, emptyStop(list[list.length - 1]?.dayNumber ?? 1)])}><Plus size={15}/> Add a stop</button>}
    </fieldset>

    <fieldset><legend>Details travellers see</legend>
      <label>Highlights <small>one per line</small><textarea name="highlights" rows={3} defaultValue={joinLines(p?.highlights)} placeholder={'Taste 8 local dishes\nHidden rooftop at sunset'}/></label>
      <div className="two"><label>Included <small>one per line</small><textarea name="included" rows={3} defaultValue={joinLines(p?.included)} placeholder={'Local guide\nAll tastings'}/></label><label>Not included <small>one per line</small><textarea name="excluded" rows={3} defaultValue={joinLines(p?.excluded)} placeholder="Hotel pickup"/></label></div>
      <label>What to bring <small>one per line</small><textarea name="whatToBring" rows={2} defaultValue={joinLines(p?.whatToBring)} placeholder="Comfortable shoes"/></label>
      <label>Meeting point<input name="meetingPoint" maxLength={255} defaultValue={p?.meetingPoint ?? ''} placeholder="Bab El Bhar gate, Tunis"/></label>
      <label>Cancellation policy<textarea name="cancellationPolicy" rows={2} maxLength={2000} defaultValue={p?.cancellationPolicy ?? ''} placeholder="Free cancellation up to 24 hours before."/></label>
      <label>Booking or contact link<input name="bookingUrl" type="url" maxLength={500} defaultValue={p?.bookingUrl ?? ''} placeholder="https://"/></label>
    </fieldset>

    <label className="org-check"><input name="isPublished" type="checkbox" defaultChecked={p?.isPublished ?? false}/> Publish so travellers can discover it</label>
    {error && <p className="error">{error}</p>}
    <div className="editor-actions"><button className="primary" disabled={busy}>{busy ? <Loader2 className="spin" size={17}/> : <Plus size={17}/>}{busy ? 'Saving…' : editing ? 'Save changes' : 'Create program'}</button>{onCancel && <button type="button" className="secondary compact" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
