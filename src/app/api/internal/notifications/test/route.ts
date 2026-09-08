import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, UnauthorizedError, ForbiddenError } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const session = await requireAuth(request, { permission: 'notifications:read' });
    return NextResponse.json({
      message: 'Test endpoint (development only)',
      session: { email: session.email, role: session.role }
    });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: err.message },
        { status: 401 }
      );
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403 }
      );
    }
    console.error('Internal error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
