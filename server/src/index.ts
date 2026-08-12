import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { pool, runMigrations } from './db';
import { config } from './config';
import { sessionMiddleware, setupAuth } from './auth';
import { setupRoutes } from './routes';
import { LobbyManager } from './lobbies';
import { setupSockets } from './socket';

async function main() {
  await runMigrations();
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { path: '/socket.io' });
  io.engine.use(sessionMiddleware);
  const manager = new LobbyManager(io, pool);
  setupAuth(app);
  setupRoutes(app);
  setupSockets(io, manager);
  http.listen(config.port, () => {
    console.log(`footi server listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});