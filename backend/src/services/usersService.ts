import bcrypt from 'bcryptjs';
import type { Invite, Role, User, UserStatus } from '../types/auth.js';
import type { Store } from '../store.js';
import { randomId } from '../lib/tokens.js';
import { generateInviteCode } from '../lib/inviteCodes.js';
import { AuthError } from './authService.js';

const INVITE_TTL_DAYS = 7;

export class UsersService {
  constructor(private store: Store) {}

  async list(): Promise<Omit<User, 'passwordHash' | 'mfaSecret'>[]> {
    const users = await this.store.users.list();
    return users.map(({ passwordHash, mfaSecret, ...safe }) => safe);
  }

  private async requireOwner(actorId: string): Promise<User> {
    const actor = await this.store.users.findById(actorId);
    if (!actor || actor.role !== 'owner') {
      throw new AuthError(403, 'Owner privileges required');
    }
    return actor;
  }

  async invite(actorId: string, role: Role): Promise<Invite> {
    await this.requireOwner(actorId);
    const now = new Date();
    const invite: Invite = {
      code: generateInviteCode(),
      role,
      createdBy: actorId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
      usedAt: null,
    };
    await this.store.invites.insert(invite);
    return invite;
  }

  async redeemInvite(code: string, name: string, email: string, password: string): Promise<User> {
    const invite = await this.store.invites.findByCode(code);
    if (!invite) throw new AuthError(404, 'Invite not found');
    if (invite.usedAt) throw new AuthError(409, 'Invite already used');
    if (new Date(invite.expiresAt) < new Date()) throw new AuthError(410, 'Invite expired');
    if (await this.store.users.findByEmail(email)) throw new AuthError(409, 'Email already registered');

    const user: User = {
      id: randomId(),
      email: email.toLowerCase(),
      name,
      role: invite.role,
      status: 'active',
      passwordHash: await bcrypt.hash(password, 10),
      mfaEnabled: false,
      mfaSecret: null,
      createdAt: new Date().toISOString(),
    };
    await this.store.users.insert(user);
    await this.store.invites.update(invite.code, { usedAt: new Date().toISOString() });
    return user;
  }

  async updateRole(actorId: string, targetId: string, role: Role): Promise<void> {
    await this.requireOwner(actorId);
    const target = await this.store.users.findById(targetId);
    if (!target) throw new AuthError(404, 'User not found');
    if (target.role === 'owner') throw new AuthError(403, 'Cannot change the owner role');
    await this.store.users.update(targetId, { role });
  }

  async setStatus(actorId: string, targetId: string, status: UserStatus): Promise<void> {
    await this.requireOwner(actorId);
    const target = await this.store.users.findById(targetId);
    if (!target) throw new AuthError(404, 'User not found');
    if (target.role === 'owner') throw new AuthError(403, 'Cannot disable the owner');
    await this.store.users.update(targetId, { status });
  }

  async remove(actorId: string, targetId: string): Promise<void> {
    await this.requireOwner(actorId);
    const target = await this.store.users.findById(targetId);
    if (!target) throw new AuthError(404, 'User not found');
    if (target.role === 'owner') throw new AuthError(403, 'Cannot remove the owner');
    await this.store.users.remove(targetId);
  }
}
