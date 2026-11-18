import { Loader2 } from 'lucide-react';
import './loading.css';

/** Shared loading states: skeletons that mirror the content they replace, and a branded page loader. */

/** Full-area loader for a page that has nothing to show yet (a trip, an experience, a document). */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return <div className="page-loader" role="status" aria-live="polite"><span className="page-loader-mark" aria-hidden="true"><span>G</span></span><p>{label}</p><span className="page-loader-bar" aria-hidden="true"><i/></span></div>;
}

/** Small spinner + text for a panel or a section that is loading inside a page. */
export function InlineLoader({ label = 'Loading…' }: { label?: string }) {
  return <p className="inline-loader" role="status" aria-live="polite"><Loader2 className="loader-spin" size={15}/>{label}</p>;
}

/** Placeholder cards (image, title, two lines) for grids of trips, programs or favorites. */
export function CardSkeletons({ count = 6, label = 'Loading…' }: { count?: number; label?: string }) {
  return <div className="skeleton-grid" role="status" aria-label={label}>{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><div className="sk sk-image"/><div className="skeleton-card-body"><div className="sk sk-line w60"/><div className="sk sk-title"/><div className="sk sk-line w80"/><div className="sk sk-line w40"/></div></div>)}</div>;
}

/** Placeholder rows (avatar, two lines, a pill) for lists and tables. */
export function ListSkeleton({ rows = 5, label = 'Loading…', avatar = true }: { rows?: number; label?: string; avatar?: boolean }) {
  return <div className="skeleton-list" role="status" aria-label={label}>{Array.from({ length: rows }, (_, i) => <div className="skeleton-row" key={i}>{avatar && <div className="sk sk-avatar"/>}<div className="skeleton-row-text"><div className="sk sk-line" style={{ width: `${55 + ((i * 17) % 35)}%` }}/><div className="sk sk-line w40"/></div><div className="sk sk-pill"/></div>)}</div>;
}

/** Paragraph placeholder for long text (terms, stories). */
export function TextSkeleton({ lines = 8, label = 'Loading…' }: { lines?: number; label?: string }) {
  return <div className="skeleton-text" role="status" aria-label={label}><div className="sk sk-title w40"/>{Array.from({ length: lines }, (_, i) => <div className="sk sk-line" key={i} style={{ width: `${70 + ((i * 13) % 30)}%` }}/>)}</div>;
}

/** Stat tiles placeholder for dashboards. */
export function StatSkeletons({ count = 4 }: { count?: number }) {
  return <div className="skeleton-stats" role="status" aria-label="Loading figures">{Array.from({ length: count }, (_, i) => <div className="skeleton-stat" key={i}><div className="sk sk-avatar square"/><div className="sk sk-line w40"/><div className="sk sk-title w60"/></div>)}</div>;
}

/** Large block placeholder (maps, galleries, hero images). */
export function BlockSkeleton({ height = 320, label = 'Loading…' }: { height?: number; label?: string }) {
  return <div className="sk sk-block" style={{ height }} role="status" aria-label={label}><span>{label}</span></div>;
}
