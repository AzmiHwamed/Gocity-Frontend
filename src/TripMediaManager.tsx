import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Film, GripVertical, ImagePlus, Loader2, RotateCcw, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { api, apiError, assetUrl } from './api';
import type { GalleryItem } from './types';
import './media-gallery.css';

/** Same limits as the backend (MAX_FILE_SIZE_MB, MAX_TRIP_IMAGES, allowed types). */
export const MEDIA_LIMITS = { maxFileMb: 5, maxItems: 30, concurrency: 3 };
const ACCEPT: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'video/mp4': 'MP4', 'video/webm': 'WebM' };
const isVideo = (type?: string) => !!type?.startsWith('video/');
/** Looks at the first bytes, like the backend does, so a renamed file is caught before uploading. */
async function sniff(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer()); const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (file.type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.type === 'image/png') return b[0] === 0x89 && ascii(1, 4) === 'PNG';
  if (file.type === 'image/gif') return ascii(0, 4) === 'GIF8';
  if (file.type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (file.type === 'video/mp4') return ascii(4, 8) === 'ftyp';
  if (file.type === 'video/webm') return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  return false;
}

type QueueItem = { key: string; file: File; preview: string; status: 'ready' | 'uploading' | 'error'; progress: number; error?: string };

/** The cover the trip shows: the chosen one, else the first photo. */
export const effectiveCover = (items: GalleryItem[], coverId?: number | null) => items.find((m) => m.id === coverId && !isVideo(m.mimeType)) ?? items.find((m) => !isVideo(m.mimeType));

/**
 * Trip photos & videos: drop or pick several files, preview them, upload with per-file
 * progress, then choose the cover, reorder (drag or arrow buttons) and delete.
 */
export function TripMediaManager({ tripId, editable = true, canDeleteAny = true, myUserId, onChange }: { tripId: string; editable?: boolean; canDeleteAny?: boolean; myUserId?: number; onChange?: (items: GalleryItem[], coverId: number | null) => void }) {
  const [items, setItems] = useState<GalleryItem[]>([]); const [coverId, setCoverId] = useState<number | null>(null); const [queue, setQueue] = useState<QueueItem[]>([]); const [rejected, setRejected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [dragOver, setDragOver] = useState(false); const [dragId, setDragId] = useState<number | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null); const queueRef = useRef(queue); queueRef.current = queue; const itemsRef = useRef(items); itemsRef.current = items;

  useEffect(() => { Promise.all([api.tripGallery(tripId), api.trip(tripId)]).then(([gallery, trip]) => { setItems(gallery); setCoverId(trip.coverMediaId ?? null); }).catch((e) => setError(apiError(e, 'Unable to load the trip media.'))).finally(() => setLoading(false)); }, [tripId]);
  useEffect(() => () => queueRef.current.forEach((q) => URL.revokeObjectURL(q.preview)), []);
  useEffect(() => { if (!loading) onChange?.(items, coverId); }, [items, coverId, loading]);

  const cover = effectiveCover(items, coverId);
  const slotsLeft = MEDIA_LIMITS.maxItems - items.length - queue.length;
  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 2500); };

  // ── choosing files ─────────────────────────────────────────
  const addFiles = async (files: File[]) => {
    const problems: string[] = []; const accepted: QueueItem[] = []; let room = slotsLeft;
    for (const file of files) {
      if (!(file.type in ACCEPT)) { problems.push(`${file.name}: ${file.type || 'this file type'} isn't supported (use ${Object.values(ACCEPT).join(', ')})`); continue; }
      if (file.size > MEDIA_LIMITS.maxFileMb * 1024 * 1024) { problems.push(`${file.name}: ${(file.size / 1048576).toFixed(1)} MB is over the ${MEDIA_LIMITS.maxFileMb} MB limit`); continue; }
      if (queue.some((q) => q.file.name === file.name && q.file.size === file.size)) continue; // already queued
      if (!(await sniff(file))) { problems.push(`${file.name}: this doesn't look like a real ${ACCEPT[file.type]} file`); continue; }
      if (room <= 0) { problems.push(`${file.name}: the gallery is full (${MEDIA_LIMITS.maxItems} max)`); continue; }
      room--; accepted.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, preview: URL.createObjectURL(file), status: 'ready', progress: 0 });
    }
    setRejected(problems); setQueue((q) => [...q, ...accepted]);
  };
  const removeQueued = (key: string) => setQueue((q) => { const item = q.find((x) => x.key === key); if (item) URL.revokeObjectURL(item.preview); return q.filter((x) => x.key !== key); });
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); if (dragId === null) addFiles(Array.from(e.dataTransfer.files)); };

  // ── uploading (3 at a time, one file per request) ──────────
  const patch = (key: string, change: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...change } : x)));
  const uploadOne = async (item: QueueItem) => {
    patch(item.key, { status: 'uploading', progress: 0, error: undefined });
    try { const saved = await api.uploadTripMedia(tripId, item.file, (p) => patch(item.key, { progress: p })); setItems((list) => [...list, saved]); URL.revokeObjectURL(item.preview); setQueue((q) => q.filter((x) => x.key !== item.key)); return saved; }
    catch (e) { patch(item.key, { status: 'error', error: apiError(e, 'Upload failed') }); return null; }
  };
  const uploadAll = async () => {
    const todo = queue.filter((q) => q.status !== 'uploading'); const results: (GalleryItem | null)[] = []; let next = 0;
    const worker = async () => { while (next < todo.length) { const i = next++; results[i] = await uploadOne(todo[i]); } };
    await Promise.all(Array.from({ length: Math.min(MEDIA_LIMITS.concurrency, todo.length) }, worker));
    // Parallel uploads finish in any order; put the new files back in the order they were picked.
    const added = results.filter((x): x is GalleryItem => !!x); const ok = added.length;
    const current = itemsRef.current; const wanted = [...current.filter((m) => !added.some((a) => a.id === m.id)), ...added];
    if (ok > 1 && wanted.some((m, i) => m.id !== current[i]?.id)) await saveOrder(wanted);
    if (ok) flash(`${ok} file${ok > 1 ? 's' : ''} added to the gallery.`);
  };
  const uploading = queue.some((q) => q.status === 'uploading');

  // ── gallery actions ────────────────────────────────────────
  const chooseCover = async (item: GalleryItem) => { const previous = coverId; setCoverId(item.id); try { await api.setTripCover(tripId, item.id); flash('Cover updated.'); } catch (e) { setCoverId(previous); setError(apiError(e, 'Unable to set the cover.')); } };
  const saveOrder = async (next: GalleryItem[]) => { const previous = items; setItems(next); try { await api.reorderGallery(tripId, next.map((m) => m.id)); } catch (e) { setItems(previous); setError(apiError(e, 'Unable to save the new order.')); } };
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; saveOrder(next); };
  const dropOn = (targetId: number) => { if (dragId === null || dragId === targetId) return; const next = items.filter((m) => m.id !== dragId); next.splice(next.findIndex((m) => m.id === targetId), 0, items.find((m) => m.id === dragId)!); setDragId(null); saveOrder(next); };
  const remove = async (item: GalleryItem) => { if (!window.confirm(`Delete this ${isVideo(item.mimeType) ? 'video' : 'photo'} from the trip?`)) return; try { await api.deleteGalleryItem(tripId, item.id); setItems((list) => list.filter((m) => m.id !== item.id)); if (coverId === item.id) setCoverId(null); flash('Deleted.'); } catch (e) { setError(apiError(e, 'Unable to delete it.')); } };
  const mayDelete = (item: GalleryItem) => editable && (canDeleteAny || item.ownerId === myUserId);

  if (loading) return <p className="muted"><Loader2 size={15} className="spin"/> Loading media…</p>;
  return <div className="media-manager">
    {editable && <div className={`dropzone${dragOver ? ' over' : ''}${slotsLeft <= 0 ? ' full' : ''}`} onDragOver={(e) => { e.preventDefault(); if (dragId === null) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => slotsLeft > 0 && input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && slotsLeft > 0) { e.preventDefault(); input.current?.click(); } }}>
      <UploadCloud size={26}/><b>{slotsLeft > 0 ? 'Drop photos & videos here, or click to choose' : 'The gallery is full'}</b>
      <small>{Object.values(ACCEPT).join(' · ')} · up to {MEDIA_LIMITS.maxFileMb} MB each · <strong>{Math.max(slotsLeft, 0)}</strong> of {MEDIA_LIMITS.maxItems} slots left</small>
      <input ref={input} type="file" multiple accept={Object.keys(ACCEPT).join(',')} hidden onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/>
    </div>}
    {rejected.length > 0 && <div className="media-rejected"><AlertCircle size={15}/><div>{rejected.map((r) => <p key={r}>{r}</p>)}</div><button type="button" onClick={() => setRejected([])} aria-label="Dismiss"><X size={14}/></button></div>}
    {queue.length > 0 && <div className="upload-queue">
      <div className="queue-head"><b>{queue.length} ready to upload</b><div><button type="button" className="back" disabled={uploading} onClick={() => { queue.forEach((q) => URL.revokeObjectURL(q.preview)); setQueue([]); }}>Clear</button><button type="button" className="primary compact" disabled={uploading} onClick={uploadAll}>{uploading ? <><Loader2 size={15} className="spin"/> Uploading…</> : <><ImagePlus size={15}/> Upload {queue.length}</>}</button></div></div>
      <div className="queue-grid">{queue.map((q) => <div className={`queue-item ${q.status}`} key={q.key}>{isVideo(q.file.type) ? <video src={q.preview} muted/> : <img src={q.preview} alt=""/>}<span className="file-name">{q.file.name}</span>{q.status === 'uploading' && <div className="progress"><i style={{ width: `${q.progress}%` }}/></div>}{q.status === 'error' && <div className="queue-error"><small>{q.error}</small><button type="button" onClick={() => uploadOne(q)}><RotateCcw size={12}/> Retry</button></div>}{q.status !== 'uploading' && <button type="button" className="queue-remove" onClick={() => removeQueued(q.key)} aria-label={`Remove ${q.file.name}`}><X size={13}/></button>}</div>)}</div>
    </div>}
    {notice && <p className="workspace-notice">{notice}</p>}{error && <p className="error">{error}</p>}
    {items.length > 0 ? <>
      <div className="gallery-head"><b>Gallery · {items.length}</b>{editable && items.length > 1 && <small><GripVertical size={13}/> Drag to reorder · the cover leads the shared trip</small>}</div>
      <div className="gallery-grid">{items.map((m, index) => { const isCover = cover?.id === m.id; return <figure key={m.id} className={`gallery-tile${isCover ? ' cover' : ''}${dragId === m.id ? ' dragging' : ''}`} draggable={editable} onDragStart={(e) => { setDragId(m.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragId(null)} onDragOver={(e) => { if (dragId !== null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOn(m.id); }}>
        {isVideo(m.mimeType) ? <video src={assetUrl(m.url)} muted preload="metadata"/> : <img src={assetUrl(m.url)} alt={m.originalName || 'Trip photo'} loading="lazy"/>}
        {isCover && <span className="cover-badge"><Star size={12}/> Cover</span>}{isVideo(m.mimeType) && <span className="video-badge"><Film size={12}/> Video</span>}
        {editable && <figcaption>
          {!isVideo(m.mimeType) && !isCover && <button type="button" onClick={() => chooseCover(m)}><Star size={13}/> Set as cover</button>}
          <span className="tile-actions"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier"><ArrowLeft size={13}/></button><button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move later"><ArrowRight size={13}/></button>{mayDelete(m) && <button type="button" className="danger" onClick={() => remove(m)} aria-label="Delete"><Trash2 size={13}/></button>}</span>
        </figcaption>}
      </figure>; })}</div>
    </> : !queue.length && <p className="muted">No photos yet. The first photo you add becomes the cover until you choose another.</p>}
  </div>;
}
