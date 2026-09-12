import type { Invite, Session, User } from './types/auth.js';

export interface Store {
  users: {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    insert(user: User): Promise<void>;
    update(id: string, patch: Partial<User>): Promise<void>;
    list(): Promise<User[]>;
    remove(id: string): Promise<void>;
  };
  sessions: {
    findById(id: string): Promise<Session | null>;
    insert(session: Session): Promise<void>;
    update(id: string, patch: Partial<Session>): Promise<void>;
    listByUser(userId: string): Promise<Session[]>;
  };
  invites: {
    findByCode(code: string): Promise<Invite | null>;
    insert(invite: Invite): Promise<void>;
    update(code: string, patch: Partial<Invite>): Promise<void>;
  };
}

export function createMemoryStore(seedUser?: User): Store {
  const users = new Map<string, User>();
  const sessions = new Map<string, Session>();
  const invites = new Map<string, Invite>();
  if (seedUser) users.set(seedUser.id, seedUser);

  return {
    users: {
      async findByEmail(email) {
        return [...users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
      },
      async findById(id) { return users.get(id) ?? null; },
      async insert(user) { users.set(user.id, user); },
      async update(id, patch) {
        const u = users.get(id);
        if (u) users.set(id, { ...u, ...patch });
      },
      async list() { return [...users.values()]; },
      async remove(id) { users.delete(id); },
    },
    sessions: {
      async findById(id) { return sessions.get(id) ?? null; },
      async insert(s) { sessions.set(s.id, s); },
      async update(id, patch) {
        const s = sessions.get(id);
        if (s) sessions.set(id, { ...s, ...patch });
      },
      async listByUser(userId) {
        return [...sessions.values()].filter((s) => s.userId === userId);
      },
    },
    invites: {
      async findByCode(code) { return invites.get(code.toUpperCase()) ?? null; },
      async insert(i) { invites.set(i.code, i); },
      async update(code, patch) {
        const i = invites.get(code);
        if (i) invites.set(code, { ...i, ...patch });
      },
    },
  };
}
