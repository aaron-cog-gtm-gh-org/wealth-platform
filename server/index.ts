import { createApp } from './app';
import { closePool } from './db/pool';

const port = Number(process.env.API_PORT ?? 3001);
const server = createApp().listen(port, () => console.log(`Wealth Platform API listening on http://localhost:${port}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => closePool().finally(() => process.exit(0))));
}
