import { randomBytes } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function actorId(req: Request): string {
  if (!req.user) {
    throw new Error('Missing authenticated user');
  }
  return req.user.id;
}

function generateInviteCode(): string {
  return randomBytes(16).toString('base64url');
}

router.get(
  '/:id/members',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await prisma.member.findMany({
        where: { tenantId: req.params.id },
        include: { user: true },
      });
      res.json(members);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/members',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body as { email?: string; role?: string };
      if (!email || !role) {
        res.status(400).json({ error: 'email and role are required' });
        return;
      }

      const normalised = email.toLowerCase();

      const user = await prisma.user.upsert({
        where: { email: normalised },
        update: {},
        create: {
          email: normalised,
          name: normalised.split('@')[0],
          role: 'member',
          passwordHash: 'DUMMY_HASH',
        },
      });

      const member = await prisma.member.create({
        data: { tenantId: req.params.id, userId: user.id, role },
        include: { user: true },
      });

      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/members/:memberId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body as { role?: string };
      if (!role) {
        res.status(400).json({ error: 'role is required' });
        return;
      }

      const member = await prisma.member.update({
        where: { id: req.params.memberId },
        data: { role },
        include: { user: true },
      });

      res.json(member);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/members/:memberId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.member.delete({ where: { id: req.params.memberId } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/invites',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = req.body as { role?: string };
      const code = generateInviteCode();

      const invite = await prisma.invite.create({
        data: {
          code,
          role: role ?? 'member',
          createdBy: actorId(req),
          tenantId: req.params.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      res.status(201).json(invite);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
