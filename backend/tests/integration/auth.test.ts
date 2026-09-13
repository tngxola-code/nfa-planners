import { describe, expect, it, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../../src/services/authService.js';
import { UsersService } from '../../src/services/usersService.js';
import { authRouter, authErrorHandler } from '../../src/routes/auth.js';
import { usersRouter, invitesRouter } from '../../src/routes/users.js';
import { createMemoryStore, type Store } from '../../src/store.js';

describe('POST /v1/auth/login', () => {
  let app: Express;

  beforeAll(async () => {
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
    app = express();
    app.use(express.json());
    app.use('/v1/auth', authRouter(auth));
    app.use('/v1/users', usersRouter(users));
    app.use('/v1/invites', invitesRouter(users));
    app.use(authErrorHandler);
  });

  it('rejects missing credentials', async () => {
    const response = await request(app).post('/v1/auth/login').send({}).expect(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'invalid@example.com', password: 'wrongpassword' })
      .expect(401);
    expect(response.body.error).toBe('Invalid credentials');
  });
});
