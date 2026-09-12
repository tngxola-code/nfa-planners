import { describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../src/services/authService.js';
import { UsersService } from '../src/services/usersService.js';
import { authRouter, authErrorHandler } from '../src/routes/auth.js';
import { usersRouter, invitesRouter } from '../src/routes/users.js';
import { createMemoryStore, type Store } from '../src/store.js';

async function buildApp() {
  const store: Store = createMemoryStore();
  await store.users.insert({
    id: 'owner1',
    email: 'owner@nfa.co.za',
    name: 'Owner',
    role: 'owner',
    status: 'active',
    passwordHash: await bcrypt.hash('OwnerPass123', 10),
    mfaEnabled: false,
    mfaSecret: null,
    createdAt: new Date().toISOString(),
  });
  const auth = new AuthService(store);
  const users = new UsersService(store);
  const app = express();
  app.use(express.json());
  app.use('/v1/auth', authRouter(auth));
  app.use('/v1/users', usersRouter(users));
  app.use('/v1/invites', invitesRouter(users));
  app.use(authErrorHandler);
  return app;
}

describe('Auth rate limiting', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('rate-limits after 10 failed login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/v1/auth/login')
        .send({ email: 'owner@nfa.co.za', password: 'bad' });
    }
    const res = await request(app).post('/v1/auth/login')
      .send({ email: 'owner@nfa.co.za', password: 'OwnerPass123' });
    expect(res.status).toBe(429);
  }, 20000);
});
