// /api/pv/* - Portfolio Viewer data API (spec 004). Replaces PV.Data/SqlHelper; all SQL parameterized.
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { findArchiveFile } from '../../src/domain/archive/archive-index';
import { getSettlements, toAmount } from '../../src/domain/archive/settlements';
import { addDays, isIsoDate, type IsoDate } from '../../src/domain/date';
import { getStatement, getStatementDates, holdingLines, instrumentName } from '../../src/domain/positions/position-builder';
import { checkAll, runPositionCheck, type PositionCheckDeps } from '../../src/domain/positions/position-check';
import { query } from '../db/pool';
import { badRequest, HttpError, notFound } from '../workflows/errors';
import { login, requireRole, requireSession, session } from './auth';
import { readArchiveBytes } from './archive-fs';
import { archiveRoot, getIndex, getInstruments, pgReconNotes, reloadIndex, saveNote } from './context';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const json = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).then(body => (body == null ? res.status(404).json({ error: 'Not found' }) : res.json(body)), next);

const ACCOUNT_SQL = `SELECT a.acct_id AS "acctId", a.acct_no AS "acctNo", a.client_id AS "clientId", c.client_name AS "clientName",
  a.acct_type AS "acctType", a.base_ccy AS "baseCcy", a.safe_code AS "safeCode", to_char(a.open_dt, 'YYYY-MM-DD') AS "openDt",
  to_char(a.close_dt, 'YYYY-MM-DD') AS "closeDt", a.status_cd AS "statusCd"
  FROM pv.account a JOIN pv.client c ON c.client_id = a.client_id`;
interface AccountDto { acctId: number; acctNo: string; clientId: number; clientName: string; safeCode: string | null }

const today = (): IsoDate => new Date().toISOString().slice(0, 10);
const intParam = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : badRequest('Invalid id.'));
const dateParam = (v: unknown, name: string): IsoDate | undefined => {
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string' || !isIsoDate(v)) badRequest(`${name} must be yyyy-mm-dd.`);
  return v as IsoDate;
};
const safeOf = (a: AccountDto) => a.safeCode ?? '';
async function account(id: string) {
  const [a] = await query<AccountDto>(`${ACCOUNT_SQL} WHERE a.acct_id = $1`, [intParam(id)]);
  return a ?? notFound('Account not found.');
}
const deps = async (): Promise<PositionCheckDeps> => ({ index: getIndex(), instruments: await getInstruments(), notes: pgReconNotes });

export const pvRouter = Router();
pvRouter.use(express.json({ limit: '16kb' }));

pvRouter.post('/login', json(async req => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') badRequest('username and password are required.');
  return login(username, password);
}));

pvRouter.use(requireSession);
pvRouter.get('/session', json(async (_req, res) => session(res)));

pvRouter.get('/accounts', json(async () => ({ accounts: await query(`${ACCOUNT_SQL} ORDER BY a.acct_no COLLATE "C"`) })));
pvRouter.get('/accounts/:acctId', json(async req => account(req.params.acctId)));

/** legacy: usp_ClientSearch - name contains or ref starts with (case-insensitive), all accounts counted */
pvRouter.get('/clients/search', json(async req => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  return { clients: await query(`SELECT c.client_id AS "clientId", c.client_ref AS "clientRef", c.client_name AS "clientName",
      c.status_cd AS "statusCd", u.username AS "adviserUsername", u.full_name AS "adviserName",
      (SELECT count(*) FROM pv.account a WHERE a.client_id = c.client_id)::int AS "acctCount"
    FROM pv.client c LEFT JOIN pv.app_user u ON u.user_id = c.adviser_user_id
    WHERE c.client_name ILIKE '%' || $1 || '%' OR c.client_ref ILIKE $1 || '%'
    ORDER BY lower(c.client_name), c.client_name`, [q]) };
}));
pvRouter.get('/clients/:clientId', json(async req => {
  const id = intParam(req.params.clientId);
  const [client] = await query(`SELECT c.client_id AS "clientId", c.client_ref AS "clientRef", c.client_name AS "clientName",
      c.status_cd AS "statusCd", to_char(c.created_dt, 'YYYY-MM-DD') AS "createdDt", u.username AS "adviserUsername", u.full_name AS "adviserName"
    FROM pv.client c LEFT JOIN pv.app_user u ON u.user_id = c.adviser_user_id WHERE c.client_id = $1`, [id]);
  if (!client) return null;
  return { ...client, accounts: await query(`${ACCOUNT_SQL} WHERE a.client_id = $1 ORDER BY a.acct_no COLLATE "C"`, [id]) };
}));

pvRouter.get('/accounts/:acctId/statement-dates', json(async req => {
  const a = await account(req.params.acctId);
  return { acctId: a.acctId, dates: getStatementDates(getIndex(), safeOf(a)) };
}));

pvRouter.get('/accounts/:acctId/holdings', json(async req => {
  const a = await account(req.params.acctId);
  const idx = getIndex();
  const date = dateParam(req.query.date, 'date') ?? getStatementDates(idx, safeOf(a))[0];
  const st = date ? getStatement(idx, safeOf(a), date) : null;
  if (!st) return { acctId: a.acctId, stmtDate: date ?? null, statement: null, lines: [] };
  const { lines, ...head } = st;
  return { acctId: a.acctId, stmtDate: date, statement: { ...head, lineCount: lines.length }, lines: holdingLines(await getInstruments(), st) };
}));

/** Settlements.aspx: default window is 90 days ending at the latest statement date, else today (Q15) */
pvRouter.get('/accounts/:acctId/settlements', json(async req => {
  const a = await account(req.params.acctId);
  const idx = getIndex();
  const latest = getStatementDates(idx, safeOf(a))[0] ?? today();
  const to = dateParam(req.query.to, 'to') ?? latest;
  const from = dateParam(req.query.from, 'from') ?? addDays(latest, -90);
  const custAcct = safeOf(a).padStart(7, '0');
  const names = await getInstruments();
  const items = getSettlements(idx, custAcct, from, to).map(c => {
    let amount = '0';
    let amountError: string | null = null;
    try { if (c.amountRaw !== null) amount = toAmount(c.amountRaw).toString(); } catch (e) { amountError = (e as Error).message; }
    return { ...c, fileName: c.filePath?.split('/').pop() ?? null, instrumentName: instrumentName(names, c.isin), amount, amountError };
  });
  return { acctId: a.acctId, custAcct, from, to, items };
}));

const ops = requireRole('OPS', 'ADMIN');
pvRouter.get('/accounts/:acctId/position-check', ops, json(async req => {
  const a = await account(req.params.acctId);
  const date = dateParam(req.query.date, 'date') ?? badRequest('date is required.');
  const r = await runPositionCheck(await deps(), { acctId: a.acctId, safeCode: safeOf(a) }, date);
  return { acctId: a.acctId, stmtDate: date, prevStmtDate: r.prevStmtDate, noPrevMessage: r.noPrevMessage, statementFile: r.statement?.fileName ?? null, rows: r.rows };
}));
pvRouter.put('/accounts/:acctId/position-check/notes', ops, json(async (req, res) => {
  const a = await account(req.params.acctId);
  const { isin, stmtDate, status, note } = req.body ?? {};
  if (typeof isin !== 'string' || !/^[A-Za-z0-9]{1,12}$/.test(isin)) badRequest('isin is required.');
  const date = dateParam(stmtDate, 'stmtDate') ?? badRequest('stmtDate is required.');
  if (typeof status !== 'string' || !/^.{1,10}$/.test(status)) badRequest('status must be 1-10 characters.');
  if (note != null && (typeof note !== 'string' || note.length > 500)) badRequest('note must be at most 500 characters.');
  return saveNote(a.acctId, isin, date, status, note ?? null, session(res).username);
}));
pvRouter.get('/position-check/all', ops, json(async req => {
  const date = dateParam(req.query.date, 'date') ?? badRequest('date is required.');
  const accts = await query<AccountDto>(`${ACCOUNT_SQL} ORDER BY a.acct_no COLLATE "C"`);
  return { stmtDate: date, rows: await checkAll(await deps(), accts.map(x => ({ ...x, safeCode: safeOf(x) })), date) };
}));

/** MessageBrowser.aspx: list by type/safe (leading zeros trimmed, Q16)/date; raw only via index lookup */
pvRouter.get('/archive/files', ops, json(async req => {
  const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined;
  const safe = typeof req.query.safe === 'string' && req.query.safe ? req.query.safe.replace(/^0+/, '') : undefined;
  const date = dateParam(req.query.date, 'date');
  const files = getIndex().files.filter(f => (!type || f.msgType === type) && (!safe || (f.safeCode ?? '').replace(/^0+/, '') === safe) && (!date || f.date === date));
  return { count: files.length, files };
}));
pvRouter.get('/archive/files/raw', ops, async (req, res, next) => {
  try {
    const entry = typeof req.query.path === 'string' ? findArchiveFile(getIndex(), req.query.path) : null;
    if (!entry) throw new HttpError(404, 'File not in archive index.');
    res.type('text/plain').set('Content-Disposition', `inline; filename="${entry.fileName}"`).send(readArchiveBytes(archiveRoot(), entry.path));
  } catch (e) { next(e); }
});

const admin = requireRole('ADMIN');
const stats = async () => {
  const idx = getIndex();
  let statements = 0;
  for (const byDate of idx.statements.values()) for (const day of byDate.values()) statements += day.length;
  let confirms = 0;
  for (const c of idx.confirmFolders.values()) confirms += c.length;
  const users = await query(`SELECT user_id AS "userId", username, full_name AS "fullName", role_cd AS "role", active_flg AS "activeFlg",
    to_char(last_login_dt, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "lastLoginDt" FROM pv.app_user ORDER BY username`);
  return { archive: { mt535Count: idx.mt535Count, mt54xCount: idx.mt54xCount, statements, confirms, parseErrors: idx.parseErrors,
    parseErrorLog: idx.parseErrorLog, loadedAt: idx.loadedAt, loadMs: idx.loadMs, statementAccounts: idx.statements.size,
    confirmFolders: idx.confirmFolders.size }, users };
};
pvRouter.get('/admin/stats', admin, json(stats));
pvRouter.post('/admin/archive/reload', admin, json(async () => { reloadIndex(); return stats(); }));
