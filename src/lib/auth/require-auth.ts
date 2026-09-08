import { NextRequest } from 'next/server';
import { 
  verifySessionToken, 
  SessionPayload,
  SessionTokenMissingError,
  SessionTokenExpiredError,
  SessionTokenInvalidError
} from '@/server/auth';

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function requireAuth(
  request: NextRequest,
  options?: { permission?: string }
): Promise<SessionPayload> {
  let token: string | undefined;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = request.cookies.get('nfa_console_session')?.value;
  }

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    const session = await verifySessionToken(token);

    if (options?.permission) {
      if (session.role !== 'admin') {
        throw new ForbiddenError('Insufficient permissions for this action');
      }
    }

    return session;
  } catch (err: any) {
    if (err instanceof SessionTokenExpiredError) {
      throw new UnauthorizedError('Authentication token expired');
    }
    if (err instanceof SessionTokenInvalidError) {
      throw new UnauthorizedError('Invalid authentication token');
    }
    if (err instanceof SessionTokenMissingError) {
      throw new UnauthorizedError('Missing authentication token');
    }
    throw new UnauthorizedError('Unauthorized');
  }
}
