import { ukDate } from './admin';
import { messageQueryKey, toLegacyType } from './pv/message-query';
import type { MessageBrowserData } from './pv/messages-slice';
import type { SetUiState, UiState } from '../types';

/** Legacy GridView `PageSize="50"`. */
export const MSG_PAGE_SIZE = 50;

export const MESSAGE_TEXT = {
  /** D-009-1 (legacy: "Enter date as dd/MM/yyyy."). */
  dateError: 'Enter date as yyyy-mm-dd or dd/MM/yyyy.',
  notFound: 'File not found.',
  prompt: 'Choose a message type, date or safe code, then select List.',
} as const;

export interface MessageFilterInput { type: string; date: string; safe: string }

const TYPE_OPTIONS = [['', 'All'], ['535', 'MT535'], ['54x', 'MT54x']] as const;

/** MessageBrowser.aspx(.cs): filters, 50-row file grid, raw viewer. URL changes go through `setParams`. */
export function buildMessageBrowser(d: MessageBrowserData, st: UiState, setState: SetUiState, setParams?: (p: Record<string, string | null>) => void) {
  const q = d.query;
  const set = (p: Record<string, string | null>) => setParams?.(p);
  const files = d.files;
  const total = files?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / MSG_PAGE_SIZE));
  const page = Math.min(Math.max(0, st.msgPage), pages - 1);
  const from = page * MSG_PAGE_SIZE;
  const shown = files?.slice(from, from + MSG_PAGE_SIZE) ?? [];

  const scope = [
    q?.type ?? 'All types',
    q?.date ? ukDate(q.date) : 'any date',
    q?.safe ? `safe code ${q.safe}` : 'all safe codes',
  ].join(' · ');

  return {
    filters: {
      formKey: messageQueryKey(q),
      types: TYPE_OPTIONS.map(([value, label]) => ({ value, label })),
      type: toLegacyType(q?.type ?? null),
      date: q?.date ?? '',
      safe: q?.safe ?? '',
      onList: (f: MessageFilterInput) => {
        setState({ msgPage: 0 });
        set({ type: f.type, date: f.date, safe: f.safe.trim(), file: null });
      },
    },
    notice: q?.dateError
      ? { text: MESSAGE_TEXT.dateError, detail: `“${q.dateText}” is not a date.`, error: true }
      : !files && !d.file ? { text: MESSAGE_TEXT.prompt, detail: null, error: false } : null,
    list: files && {
      title: `${total.toLocaleString('en-CA')} ${total === 1 ? 'file' : 'files'}`,
      scope,
      rows: shown.map(f => ({
        name: f.fileName,
        type: f.msgType,
        date: ukDate(f.date),
        size: String(f.size),
        selected: f.fileName === q?.file,
        onOpen: () => set({ file: f.fileName }),
      })),
      pager: pages > 1 ? {
        range: `${from + 1}–${from + shown.length} of ${total}`,
        pages: pageWindow(page, pages).map(i => i === null ? { label: '…', active: false, onClick: null } : { label: String(i + 1), active: i === page, onClick: () => setState({ msgPage: i }) }),
        onPrev: page > 0 ? () => setState({ msgPage: page - 1 }) : null,
        onNext: page < pages - 1 ? () => setState({ msgPage: page + 1 }) : null,
      } : null,
    },
    viewer: d.file && {
      name: d.file.name,
      path: d.file.path,
      raw: d.file.raw,
      notFound: d.file.raw === null,
      notFoundText: MESSAGE_TEXT.notFound,
      onClose: () => set({ file: null }),
    },
  };
}

export type MessageBrowserModel = ReturnType<typeof buildMessageBrowser>;

/** Page buttons: first, last and current ±2, with null for each gap (MT54x alone is 60 pages). */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 2) out.push(i);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}
