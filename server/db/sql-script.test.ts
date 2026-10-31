import assert from 'node:assert/strict';
import test from 'node:test';
import { splitSqlScript } from './sql-script';

test('PostgreSQL SQL splitter skips comment lines and ends statements at semicolons', () => {
  assert.deepEqual(splitSqlScript('-- heading\nCREATE TABLE a (id INTEGER);\n-- next\nINSERT INTO a VALUES (1);'), [
    'CREATE TABLE a (id INTEGER)',
    'INSERT INTO a VALUES (1)',
  ]);
});

test('PostgreSQL SQL splitter rejects unfinished statements', () => {
  assert.throws(() => splitSqlScript('SELECT 1'), /Unterminated SQL statement/);
});
