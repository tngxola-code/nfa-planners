import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const app = createApp();

describe('POST /v1/auth/login', () => {
  it('rejects missing credentials', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send({})
      .expect(400);

    expect(response.body).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'invalid@example.com',
        password: 'wrong-password'
      });

    expect([400, 401]).toContain(response.status);
  });
});
