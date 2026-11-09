import { PvApiError } from '../../api/pv';
import type { PvArchiveFile } from '../../api/pv-types';
import type { MessageQuery } from './message-query';
import { PREVIEW_MESSAGES } from './messages-preview';
import type { PvSliceDef } from './slice';

/** Raw viewer: `path`/`raw` null = "File not found." (not an indexed file name). */
export interface MessageFile { name: string; path: string | null; raw: string | null }

export interface MessageBrowserData {
  query: MessageQuery | null;
  /** Null when no list was requested or the date is invalid (no request is made). */
  files: PvArchiveFile[] | null;
  file: MessageFile | null;
}

async function loadFile(api: Parameters<PvSliceDef<MessageBrowserData>['load']>[0], name: string): Promise<MessageFile> {
  try {
    const r = await api.archiveFileByName(name);
    return { name: r.fileName, path: r.path, raw: r.raw };
  } catch (e) {
    if (e instanceof PvApiError && e.status === 404) return { name, path: null, raw: null };
    throw e;
  }
}

/** MessageBrowser.aspx (spec 009): file list via /archive/files, raw text via /archive/files/raw?file=. */
export const messagesSlice: PvSliceDef<MessageBrowserData> = {
  needs: 'none',
  load: async (api, ctx) => {
    const q = ctx.messages ?? null;
    const [files, file] = await Promise.all([
      q?.list && !q.dateError
        ? api.archiveFiles({ type: q.type ?? undefined, date: q.date ?? undefined, safe: q.safe || undefined }).then(r => r.files)
        : null,
      q?.file ? loadFile(api, q.file) : null,
    ]);
    return { query: q, files, file };
  },
  isEmpty: d => d.files !== null && d.files.length === 0 && !d.file,
  preview: () => PREVIEW_MESSAGES,
};
