import { describe, expect, it, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { notificationsRouter } from '../../src/routes/notifications';
import { NotificationsService } from '../../src/services/notificationsService';
import type { EmailSender } from '../../src/lib/digestEmail';

// Sign with whatever the app verifies with. The value is provided by
// backend/vitest.setup.ts, which runs before this module is imported.
const token = (role: 'owner' | 'contributor' = 'owner') =>
  jwt.sign(
    { sub: 'user-1', role, typ: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' },
  );

const auth = (role: 'owner' | 'contributor' = 'owner') => ({
  Authorization: `Bearer ${token(role)}`,
});

function createFakePrisma() {
  const notifications: any[] = [];
  const users = [
    { id: 'user-1', email: 'ops@nfaplanners.co.za', name: 'Ops', status: 'active' },
    { id: 'user-2', email: 'other@nfa.co.za', name: 'Other', status: 'active' },
  ];
  let seq = 0;
  return {
    notification: {
      create: async ({ data }: any) => {
        const n = { id: `n-${++seq}`, readAt: null, createdAt: new Date(), ...data };
        notifications.push(n);
        return n;
      },
      findMany: async ({ where, take }: any) => {
        let rows = notifications.filter((n) => n.userId === where.userId);
        if (where.readAt === null) rows = rows.filter((n) => n.readAt === null);
        if (where.createdAt?.gte) rows = rows.filter((n) => n.createdAt >= where.createdAt.gte);
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows.slice(0, take ?? 100);
      },
      count: async ({ where }: any) => {
        let rows = notifications.filter((n) => n.userId === where.userId);
        if (where.readAt === null) rows = rows.filter((n) => n.readAt === null);
        if (where.id?.lt) rows = rows.filter((n) => n.id < where.id.lt);
        return rows.length;
      },
      updateMany: async ({ where, data }: any) => {
        let updated = 0;
        for (const n of notifications) {
          if (n.userId !== where.userId || n.readAt !== null) continue;
          if (where.id?.in && !where.id.in.includes(n.id)) continue;
          n.readAt = data.readAt;
          updated++;
        }
        return { count: updated };
      },
    },
    user: { findMany: async () => users },
  } as any;
}

describe('Notifications API', () => {
  let app: express.Express;
  let prisma: ReturnType<typeof createFakePrisma>;
  let sentEmails: { to: string; subject: string }[];

  beforeEach(() => {
    prisma = createFakePrisma();
    sentEmails = [];
    const sender: EmailSender = {
      async send(to, subject) {
        sentEmails.push({ to, subject });
      },
    };
    const service = new NotificationsService(prisma, sender);
    app = express();
    app.use(express.json());
    app.use('/v1/notifications', notificationsRouter(service));
  });

  it('records, lists with unreadCount, marks specific ids read', async () => {
    const s = new NotificationsService(prisma);
    await s.record('user-1', 'match', 'Tender A', '92%');
    await s.record('user-1', 'ingest', 'Ingest done', '14 releases');
    await s.record('user-2', 'system', 'Not yours', '—');

    const list = await request(app).get('/v1/notifications').set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.data[0].read).toBe(false);

    const firstId = list.body.data[0].id;
    const read = await request(app)
      .post('/v1/notifications/read')
      .set(auth())
      .send({ ids: [firstId] });
    expect(read.body.updated).toBe(1);

    const after = await request(app).get('/v1/notifications').set(auth());
    expect(after.body.unreadCount).toBe(1);
  });

  it('mark-all-read without ids clears everything', async () => {
    const s = new NotificationsService(prisma);
    await s.record('user-1', 'match', 'A', '');
    await s.record('user-1', 'match', 'B', '');
    const res = await request(app).post('/v1/notifications/read').set(auth()).send({});
    expect(res.body.updated).toBe(2);
  });

  it('digest sends one email per active user with recent notifications', async () => {
    const s = new NotificationsService(prisma);
    await s.record('user-1', 'match', 'For ops', '');
    const res = await request(app)
      .post('/v1/notifications/digest/send')
      .set(auth())
      .send({ hours: 24 });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('ops@nfaplanners.co.za');
  });

  it('digest requires owner role', async () => {
    await request(app)
      .post('/v1/notifications/digest/send')
      .set(auth('contributor'))
      .send({ hours: 24 })
      .expect(403);
  });

  it('rejects unauthenticated access', async () => {
    await request(app).get('/v1/notifications').expect(401);
  });
});
