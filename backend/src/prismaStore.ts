import type {
  Invite as PrismaInvite,
  Session as PrismaSession,
  User as PrismaUser,
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import type { Store } from './store.js';
import type {
  Invite,
  Role,
  Session,
  User,
  UserStatus,
} from './types/auth.js';

function mapUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    status: row.status as UserStatus,
    passwordHash: row.passwordHash,
    mfaEnabled: row.mfaEnabled,
    mfaSecret: row.mfaSecret,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSession(row: PrismaSession): Session {
  return {
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function mapInvite(row: PrismaInvite): Invite {
  return {
    code: row.code,
    role: row.role as Role,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
  };
}

export function createPrismaStore(prisma: PrismaClient): Store {
  return {
    users: {
      async findByEmail(email) {
        const row = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });

        return row ? mapUser(row) : null;
      },

      async findById(id) {
        const row = await prisma.user.findUnique({ where: { id } });
        return row ? mapUser(row) : null;
      },

      async insert(user) {
        await prisma.user.create({
          data: {
            id: user.id,
            email: user.email.trim().toLowerCase(),
            name: user.name,
            role: user.role,
            status: user.status,
            passwordHash: user.passwordHash,
            mfaEnabled: user.mfaEnabled,
            mfaSecret: user.mfaSecret,
            createdAt: new Date(user.createdAt),
          },
        });
      },

      async update(id, patch) {
        await prisma.user.updateMany({
          where: { id },
          data: {
            ...(patch.email !== undefined && {
              email: patch.email.trim().toLowerCase(),
            }),
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.role !== undefined && { role: patch.role }),
            ...(patch.status !== undefined && { status: patch.status }),
            ...(patch.passwordHash !== undefined && {
              passwordHash: patch.passwordHash,
            }),
            ...(patch.mfaEnabled !== undefined && {
              mfaEnabled: patch.mfaEnabled,
            }),
            ...(patch.mfaSecret !== undefined && {
              mfaSecret: patch.mfaSecret,
            }),
            ...(patch.createdAt !== undefined && {
              createdAt: new Date(patch.createdAt),
            }),
          },
        });
      },

      async list() {
        const rows = await prisma.user.findMany({
          orderBy: { createdAt: 'asc' },
        });

        return rows.map(mapUser);
      },

      async remove(id) {
        await prisma.user.deleteMany({ where: { id } });
      },
    },

    sessions: {
      async findById(id) {
        const row = await prisma.session.findUnique({ where: { id } });
        return row ? mapSession(row) : null;
      },

      async insert(session) {
        await prisma.session.create({
          data: {
            id: session.id,
            userId: session.userId,
            refreshTokenHash: session.refreshTokenHash,
            ip: session.ip,
            userAgent: session.userAgent,
            createdAt: new Date(session.createdAt),
            lastSeenAt: new Date(session.lastSeenAt),
            revokedAt: session.revokedAt
                ? new Date(session.revokedAt)
                : null,
          },
        });
      },

      async update(id, patch) {
        await prisma.session.updateMany({
          where: { id },
          data: {
            ...(patch.userId !== undefined && { userId: patch.userId }),
            ...(patch.refreshTokenHash !== undefined && {
              refreshTokenHash: patch.refreshTokenHash,
            }),
            ...(patch.ip !== undefined && { ip: patch.ip }),
            ...(patch.userAgent !== undefined && {
              userAgent: patch.userAgent,
            }),
            ...(patch.createdAt !== undefined && {
              createdAt: new Date(patch.createdAt),
            }),
            ...(patch.lastSeenAt !== undefined && {
              lastSeenAt: new Date(patch.lastSeenAt),
            }),
            ...(patch.revokedAt !== undefined && {
              revokedAt: patch.revokedAt
                  ? new Date(patch.revokedAt)
                  : null,
            }),
          },
        });
      },

      async listByUser(userId) {
        const rows = await prisma.session.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        return rows.map(mapSession);
      },
    },

    invites: {
      async findByCode(code) {
        const row = await prisma.invite.findUnique({
          where: { code: code.trim().toUpperCase() },
        });

        return row ? mapInvite(row) : null;
      },

      async insert(invite) {
        await prisma.invite.create({
          data: {
            code: invite.code.trim().toUpperCase(),
            role: invite.role,
            createdBy: invite.createdBy,
            createdAt: new Date(invite.createdAt),
            expiresAt: new Date(invite.expiresAt),
            usedAt: invite.usedAt ? new Date(invite.usedAt) : null,
          },
        });
      },

      async update(code, patch) {
        await prisma.invite.updateMany({
          where: { code: code.trim().toUpperCase() },
          data: {
            ...(patch.role !== undefined && { role: patch.role }),
            ...(patch.createdBy !== undefined && {
              createdBy: patch.createdBy,
            }),
            ...(patch.createdAt !== undefined && {
              createdAt: new Date(patch.createdAt),
            }),
            ...(patch.expiresAt !== undefined && {
              expiresAt: new Date(patch.expiresAt),
            }),
            ...(patch.usedAt !== undefined && {
              usedAt: patch.usedAt ? new Date(patch.usedAt) : null,
            }),
          },
        });
      },
    },
  };
}