import { jwtVerify } from 'jose';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256']
    });

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      console.error('JWT payload missing required claims:', payload);
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role
    };
  } catch (error) {
    console.error('JWT VERIFICATION FAILED:', error);
    return null;
  }
}
