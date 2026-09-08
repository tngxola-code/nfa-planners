import { NextResponse } from 'next/server';
import { clearSession } from '@/server/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('nfa_console_session');
  return response;
}
