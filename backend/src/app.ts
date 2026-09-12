import express, { type Express } from 'express';
import { createMemoryStore, type Store } from './store.js';
import { AuthService } from './services/authService.js';
import { UsersService } from './services/usersService.js';
import { authRouter, authErrorHandler } from './routes/auth.js';
import { usersRouter, invitesRouter } from './routes/users.js';

export interface AppOptions {
  store?: Store;
}

export async function createApp(options: AppOptions = {}): Promise<Express> {
  const app = express();
  app.use(express.json());

  const store = options.store ?? createMemoryStore();
  await AuthService.seedOwner(store);
  const authService = new AuthService(store);
  const usersService = new UsersService(store);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/v1/auth', authRouter(authService));
  app.use('/v1/users', usersRouter(usersService));
  app.use('/v1/invites', invitesRouter(usersService));
  app.use(authErrorHandler);

  return app;
}
