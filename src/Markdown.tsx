import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Small Markdown renderer for admin-written documents (legal pages): # headings, paragraphs,
 * - / 1. lists, > quotes, **bold**, *italic*, `code` and [links](url). Builds React elements,
 * never HTML strings, so content can't inject markup.
 */
export interface Heading { id: string; text: string; level: number }

export const slug = (text: string) => text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const plain = (text: string) => text.replace(/\*\*|\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

/** ## and ### headings, for a table of contents. */
export const headingsOf = (md: string): Heading[] => md.split('\n').flatMap((line) => {
  const m = /^(#{2,3})\s+(.+)$/.exec(line.trim());
  return m ? [{ level: m[1].length, text: plain(m[2]), id: slug(plain(m[2])) }] : [];
});

function inline(text: string, key = ''): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{inline(m[2], k)}</strong>);
    else if (m[4]) out.push(<em key={k}>{inline(m[4], k)}</em>);
    else if (m[6]) out.push(<code key={k}>{m[6]}</code>);
    else if (m[8]) {
      const href = m[9];
      if (href.startsWith('/')) out.push(<Link key={k} to={href}>{m[8]}</Link>);
      else if (/^(https?:|mailto:)/i.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noreferrer noopener">{m[8]}</a>);
      else out.push(m[8]); // anything else (javascript:, data:…) is shown as text
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const key = `b${i}`;
    if (!line) { i++; continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length; const text = heading[2];
      const Tag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4'; // the page already has the h1
      blocks.push(<Tag key={key} id={slug(plain(text))}>{inline(text, key)}</Tag>);
      i++; continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>);
      continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line); const items: string[] = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''));
      const lis = items.map((item, n) => <li key={n}>{inline(item, `${key}-${n}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|[-*]\s|\d+\.\s)/.test(lines[i].trim())) para.push(lines[i++].trim());
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
