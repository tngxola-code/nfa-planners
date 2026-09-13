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

describe('Auth + Users API', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('full flow: login -> invite -> list users -> revoke session', async () => {
    const login = await request(app).post('/v1/auth/login')
      .send({ email: 'owner@nfa.co.za', password: 'OwnerPass123' });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = login.body;
    expect(accessToken).toBeTruthy();

    const invite = await request(app).post('/v1/invites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'bid_manager' });
    expect(invite.status).toBe(201);
    expect(invite.body.code).toMatch(/^NFA-/);

    const list = await request(app).get('/v1/users').set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].passwordHash).toBeUndefined();
    const denied = await request(app).get('/v1/users');
    expect(denied.status).toBe(401);

    const refreshed = await request(app).post('/v1/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    const reused = await request(app).post('/v1/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);

    const sessions = await request(app).get('/v1/auth/sessions').set('Authorization', `Bearer ${accessToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.length).toBeGreaterThan(0);
    const revoke = await request(app).delete(`/v1/auth/sessions/${sessions.body.data[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(revoke.status).toBe(204);
  });

  it('change password requires auth and valid current password', async () => {
    const login = await request(app).post('/v1/auth/login')
      .send({ email: 'owner@nfa.co.za', password: 'OwnerPass123' });
    expect(login.status).toBe(200);

    const noAuth = await request(app).put('/v1/auth/password')
      .send({ currentPassword: 'OwnerPass123', newPassword: 'NewPass1234' });
    expect(noAuth.status).toBe(401);

    const wrong = await request(app).put('/v1/auth/password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'nope', newPassword: 'NewPass1234' });
    expect(wrong.status).toBe(403);
  });
});
