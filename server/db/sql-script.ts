export function splitSqlScript(text: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    buffer += `${line}\n`;
    if (trimmed.endsWith(';')) {
      statements.push(buffer.trim().slice(0, -1));
      buffer = '';
    }
  }
  if (buffer.trim()) throw new Error(`Unterminated SQL statement: ${buffer.slice(0, 200)}`);
  return statements;
}
