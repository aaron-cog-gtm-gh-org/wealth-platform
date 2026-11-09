import type { ClientBase } from 'pg';
import { parseConfirmation, parseStatement, safeKey } from './swift/parse';
import type { Confirmation, Statement } from './swift/types';

export interface ArchiveParseResult {
  parsed: number;
  parseErrors: number;
  load: ArchiveLoadRow;
}

export interface ArchiveLoadRow {
  loadedAt: string;
  loadMs: number;
  mt535Count: number;
  mt54xCount: number;
  statements: number;
  confirmations: number;
  parseErrors: number;
}

interface PendingMessage {
  message_id: number;
  file_name: string;
  msg_family: 'MT535' | 'MT54x';
  file_seq: number;
  day_folder: string | null;
  raw_text: string;
}

const BATCH = 500;
const MAX_ERROR = 300;

const INSERT_STATEMENTS = `
INSERT INTO custody_statements (message_id, safe_code, stmt_date, function, file_seq)
SELECT * FROM unnest($1::int[], $2::varchar[], $3::date[], $4::varchar[], $5::int[])
RETURNING statement_id, message_id`;

const INSERT_LINES = `
INSERT INTO custody_statement_lines (statement_id, line_no, isin, description, qty, qty_type, price, ccy, mkt_val, mkt_val_gbp)
SELECT * FROM unnest($1::int[], $2::smallint[], $3::bpchar[], $4::varchar[], $5::numeric[], $6::varchar[], $7::numeric[],
                     $8::bpchar[], $9::numeric[], $10::numeric[])`;

const INSERT_CONFIRMATIONS = `
INSERT INTO custody_confirmations (message_id, mt_type, seme, prev, function, trade_date, settle_date, isin, qty,
  safe_code_raw, safe_code, amount, amount_raw, ccy, direction, day_folder)
SELECT * FROM unnest($1::int[], $2::smallint[], $3::varchar[], $4::varchar[], $5::varchar[], $6::date[], $7::date[],
                     $8::bpchar[], $9::numeric[], $10::varchar[], $11::varchar[], $12::numeric[], $13::varchar[],
                     $14::bpchar[], $15::bpchar[], $16::bpchar[])`;

const UPDATE_STATUS = `
UPDATE custody_messages AS m SET parse_status = u.status, parse_error = u.error
FROM unnest($1::int[], $2::varchar[], $3::varchar[]) AS u(id, status, error)
WHERE m.message_id = u.id`;

async function insertStatements(client: ClientBase, items: { message: PendingMessage; statement: Statement }[]) {
  if (!items.length) return;
  const { rows } = await client.query<{ statement_id: number; message_id: number }>(INSERT_STATEMENTS, [
    items.map(i => i.message.message_id),
    items.map(i => safeKey(i.statement.safekeepingAcct)),
    items.map(i => i.statement.statementDate),
    items.map(i => i.statement.function),
    items.map(i => i.message.file_seq),
  ]);
  const idByMessage = new Map(rows.map(row => [row.message_id, row.statement_id]));
  const lines = items.flatMap(i => i.statement.lines.map((line, index) => ({ id: idByMessage.get(i.message.message_id)!, lineNo: index + 1, line })));
  for (let start = 0; start < lines.length; start += BATCH * 10) {
    const batch = lines.slice(start, start + BATCH * 10);
    await client.query(INSERT_LINES, [
      batch.map(l => l.id), batch.map(l => l.lineNo), batch.map(l => l.line.isin), batch.map(l => l.line.description),
      batch.map(l => l.line.qty), batch.map(l => l.line.qtyType), batch.map(l => l.line.price), batch.map(l => l.line.ccy),
      batch.map(l => l.line.mktVal), batch.map(l => l.line.mktValGbp),
    ]);
  }
}

async function insertConfirmations(client: ClientBase, items: { message: PendingMessage; confirmation: Confirmation }[]) {
  if (!items.length) return;
  const col = <T>(fn: (c: Confirmation, m: PendingMessage) => T) => items.map(i => fn(i.confirmation, i.message));
  await client.query(INSERT_CONFIRMATIONS, [
    col((_, m) => m.message_id), col(c => c.mtType), col(c => c.seme), col(c => c.prev), col(c => c.function),
    col(c => c.tradeDate), col(c => c.settleDate), col(c => c.isin), col(c => c.qty), col(c => c.safekeepingAcct),
    col(c => safeKey(c.safekeepingAcct)), col(c => c.amount), col(c => c.amountRaw), col(c => c.ccy), col(c => c.direction),
    col((_, m) => m.day_folder),
  ]);
}

/** Counts the parsed archive and appends a `custody_archive_loads` row. */
export async function recordArchiveLoad(client: ClientBase, loadMs: number): Promise<ArchiveLoadRow> {
  const { rows } = await client.query<ArchiveLoadRow>(`
    INSERT INTO custody_archive_loads (loaded_at, load_ms, mt535_count, mt54x_count, statements, confirmations, parse_errors)
    SELECT clock_timestamp(), $1,
      (SELECT count(*) FROM custody_messages WHERE msg_family = 'MT535'),
      (SELECT count(*) FROM custody_messages WHERE msg_family = 'MT54x'),
      (SELECT count(*) FROM custody_statements),
      (SELECT count(*) FROM custody_confirmations),
      (SELECT count(*) FROM custody_messages WHERE parse_status = 'error')
    RETURNING loaded_at AS "loadedAt", load_ms AS "loadMs", mt535_count AS "mt535Count", mt54x_count AS "mt54xCount",
      statements, confirmations, parse_errors AS "parseErrors"`, [loadMs]);
  return { ...rows[0], loadedAt: new Date(rows[0].loadedAt).toISOString() };
}

/**
 * Parses every `pending` custody message (MT535 → statements + lines, MT54x → confirmations),
 * marks each `ok` or `error` with the parser message, then records a `custody_archive_loads` row.
 * A file that fails to parse never aborts the load. `startedAt` is when the archive load began,
 * so `load_ms` covers load + parse. Re-running with nothing pending only records a new load row.
 */
export async function parseArchive(client: ClientBase, startedAt = Date.now()): Promise<ArchiveParseResult> {
  const { rows: pending } = await client.query<PendingMessage>(
    `SELECT message_id, file_name, msg_family, file_seq, day_folder, raw_text FROM custody_messages
     WHERE parse_status = 'pending' ORDER BY message_id`);
  const ids = pending.map(m => m.message_id);
  await client.query('DELETE FROM custody_statements WHERE message_id = ANY($1::int[])', [ids]);
  await client.query('DELETE FROM custody_confirmations WHERE message_id = ANY($1::int[])', [ids]);

  let parseErrors = 0;
  for (let start = 0; start < pending.length; start += BATCH) {
    const batch = pending.slice(start, start + BATCH);
    const statements: { message: PendingMessage; statement: Statement }[] = [];
    const confirmations: { message: PendingMessage; confirmation: Confirmation }[] = [];
    const errors = new Map<number, string>();
    for (const message of batch) {
      try {
        if (message.msg_family === 'MT535') statements.push({ message, statement: parseStatement(message.raw_text) });
        else confirmations.push({ message, confirmation: parseConfirmation(message.raw_text) });
      } catch (error) {
        errors.set(message.message_id, (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR));
      }
    }
    await insertStatements(client, statements);
    await insertConfirmations(client, confirmations);
    await client.query(UPDATE_STATUS, [
      batch.map(m => m.message_id),
      batch.map(m => (errors.has(m.message_id) ? 'error' : 'ok')),
      batch.map(m => errors.get(m.message_id) ?? null),
    ]);
    parseErrors += errors.size;
  }
  const load = await recordArchiveLoad(client, Date.now() - startedAt);
  return { parsed: pending.length - parseErrors, parseErrors, load };
}
