import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/tokens.js';
import type { Role } from '../types/auth.js';
import { AuthError } from '../services/authService.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AuthError(401, 'Missing bearer token'));
    return;
  }
  try {
    const claims = verifyToken<{ sub: string; role: Role; typ: string }>(header.slice(7), 'access');
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch {
    next(new AuthError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AuthError(403, 'Insufficient role'));
      return;
    }
    next();
  };
}
