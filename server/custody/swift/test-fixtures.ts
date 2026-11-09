/** Test-only loader for the real PV archive files copied under `fixtures/`. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArchiveFileName, parseConfirmation, parseStatement } from './parse';
import type { ArchivedConfirmation } from '../domain/settlements';
import type { StatementFile } from '../domain/holdings';

export function fixtureText(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${relPath}`, import.meta.url)), 'latin1');
}

export function statementFixture(fileName: string): StatementFile {
  return { fileSeq: parseArchiveFileName(fileName)!.fileSeq, statement: parseStatement(fixtureText(fileName)) };
}

/** `dayFolder/fileName` under `fixtures/mt54x`. */
export function confirmationFixture(path: string): ArchivedConfirmation {
  const [dayFolder, fileName] = path.split('/');
  return { ...parseConfirmation(fixtureText(`mt54x/${path}`)), dayFolder, fileName };
}
