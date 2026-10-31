import { createApp } from './app';
import { closePool } from './db/pool';

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '127.0.0.1';
const server = createApp().listen(port, host, () => console.log(`Wealth Platform API listening on http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => closePool().finally(() => process.exit(0))));
}
