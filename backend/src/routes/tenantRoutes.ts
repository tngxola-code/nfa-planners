import { Router } from 'express';
import { prisma } from '../config/database';
import { authGuard } from '../middleware/authGuard';
import { generateInviteCode } from '../utils/inviteGenerator';

const router = Router();
router.use(authGuard);

router.get('/:id/members', async (req, res) => {
  const members = await prisma.member.findMany({ where: { tenantId: req.params.id }, include: { user: true } });
  return res.json(members);
});

router.post('/:id/members', async (req, res) => {
  const { email, role } = req.body;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: { email: email.toLowerCase(), passwordHash: 'DUMMY_HASH' }
  });
  const member = await prisma.member.create({
    data: { userId: user.id, tenantId: req.params.id, role }
  });
  return res.status(201).json(member);
});

router.patch('/:id/members/:memberId', async (req, res) => {
  const { role } = req.body;
  const member = await prisma.member.update({
    where: { id: req.params.memberId },
    data: { role }
  });
  return res.json(member);
});

router.delete('/:id/members/:memberId', async (req, res) => {
  await prisma.member.delete({ where: { id: req.params.memberId } });
  return res.status(204).end();
});

router.post('/:id/invites', async (req, res) => {
  const code = generateInviteCode();
  const invite = await prisma.invite.create({
    data: { code, tenantId: req.params.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) }
  });
  return res.status(201).json(invite);
});

export default router;
