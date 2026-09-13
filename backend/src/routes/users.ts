import { Router } from 'express';
import { z } from 'zod';
import { UsersService } from '../services/usersService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const roleSchema = z.enum(['owner', 'bid_manager', 'contributor', 'reviewer']);

export function usersRouter(service: UsersService): Router {
  const r = Router();
  r.use(requireAuth);

  r.get('/', async (_req, res, next) => {
    try { res.json({ data: await service.list() }); } catch (e) { next(e); }
  });

  r.patch('/:id', requireRole('owner'), async (req, res, next) => {
    try {
      const body = z.object({
        role: roleSchema.optional(),
        status: z.enum(['active', 'disabled']).optional(),
      }).parse(req.body);
      if (body.role) await service.updateRole(req.user!.id, req.params.id, body.role);
      if (body.status) await service.setStatus(req.user!.id, req.params.id, body.status);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  r.delete('/:id', requireRole('owner'), async (req, res, next) => {
    try {
      await service.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return r;
}

export function invitesRouter(service: UsersService): Router {
  const r = Router();
  r.use(requireAuth, requireRole('owner'));

  r.post('/', async (req, res, next) => {
    try {
      const { role } = z.object({ role: roleSchema }).parse(req.body);
      res.status(201).json(await service.invite(req.user!.id, role));
    } catch (e) { next(e); }
  });

  return r;
}
