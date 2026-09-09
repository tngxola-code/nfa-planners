import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS
} from '@/lib/auth/config';

describe('auth config', () => {
  it('uses the expected session cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('nfa_session');
  });

  it('uses an eight-hour remembered session', () => {
    expect(SESSION_DURATION_SECONDS).toBe(60 * 60 * 8);
  });
});
