const SQLPLUS_COMMAND = /^(SET|PROMPT|REM|SPOOL|WHENEVER)\b/i;
const PLSQL_START = /^(BEGIN|DECLARE|CREATE\s+(OR\s+REPLACE\s+)?(PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE))\b/i;

/**
 * Splits a SQL*Plus-style script into executable statements: plain SQL ends with `;`
 * at end of line, PL/SQL blocks end with a `/` line. SQL*Plus commands are skipped.
 */
export function splitSqlScript(text: string): string[] {
  const statements: string[] = [];
  let buf: string[] = [];
  let plsql = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!buf.length) {
      if (!t || t.startsWith('--') || SQLPLUS_COMMAND.test(t)) continue;
      plsql = PLSQL_START.test(t);
    }
    if (plsql) {
      if (t === '/') {
        statements.push(buf.join('\n'));
        buf = [];
        plsql = false;
      } else buf.push(line);
      continue;
    }
    buf.push(line);
    if (t.endsWith(';')) {
      statements.push(buf.join('\n').trim().slice(0, -1));
      buf = [];
    }
  }
  if (buf.join('').trim()) throw new Error('Unterminated SQL statement: ' + buf.join('\n').slice(0, 200));
  return statements;
}
