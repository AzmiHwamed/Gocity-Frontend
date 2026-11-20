import { useEffect, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import './toast.css';

export type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: ToastKind };
const EVENT = 'gocity:toast';

export const showToast = (message: string, kind: ToastKind = 'info') => {
  if (message) window.dispatchEvent(new CustomEvent<Pick<Toast, 'message' | 'kind'>>(EVENT, { detail: { message, kind } }));
};

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const receive = (event: Event) => { const detail = (event as CustomEvent<Pick<Toast, 'message' | 'kind'>>).detail; if (!detail?.message) return; const toast = { id: Date.now() + Math.random(), ...detail }; setToasts((current) => [...current.slice(-3), toast]); window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4500); };
    window.addEventListener(EVENT, receive); return () => window.removeEventListener(EVENT, receive);
  }, []);
  const icon = (kind: ToastKind) => kind === 'success' ? <CheckCircle2 size={18}/> : kind === 'error' ? <TriangleAlert size={18}/> : <Info size={18}/>;
  return <div className="toast-host" aria-live="polite">{toasts.map((toast) => <div className={`toast ${toast.kind}`} key={toast.id}>{icon(toast.kind)}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={16}/></button></div>)}</div>;
}
