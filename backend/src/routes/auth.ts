import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthService, AuthError } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const loginLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — try again in 5 minutes' },
});

export function authRouter(service: AuthService): Router {
  const r = Router();

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    mfaToken: z.string().optional(),
    totp: z.string().length(6).optional(),
  });

  r.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const mfa = body.mfaToken && body.totp ? { mfaToken: body.mfaToken, totp: body.totp } : undefined;
      const result = await service.login(
        body.email, body.password,
        { ip: req.ip, userAgent: req.headers['user-agent'] },
        mfa,
      );
      res.status(result.mfaRequired ? 401 : 200).json(result);
    } catch (e) { next(e); }
  });

  r.post('/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
      res.json(await service.refresh(refreshToken));
    } catch (e) { next(e); }
  });

  r.put('/password', requireAuth, async (req, res, next) => {
    try {
      const body = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }).parse(req.body);
      await service.changePassword(req.user!.id, body.currentPassword, body.newPassword);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  r.get('/sessions', requireAuth, async (req, res, next) => {
    try {
      res.json({ data: await service.listSessions(req.user!.id) });
    } catch (e) { next(e); }
  });

  r.delete('/sessions/:id', requireAuth, async (req, res, next) => {
    try {
      await service.revokeSession(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return r;
}

export function authErrorHandler(
  err: Error,
  _req: unknown,
  res: { status(code: number): { json(body: unknown): void } },
  _next: unknown,
): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.issues });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
}
