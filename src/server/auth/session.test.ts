/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';
import { getSessionSecret } from './config';

const TEST_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

describe('session tokens', () => {
    let originalSecret: string | undefined;

    beforeAll(() => {
        originalSecret = process.env.CONSOLE_SESSION_SECRET;
        process.env.CONSOLE_SESSION_SECRET = TEST_SECRET;
    });

    afterAll(() => {
        process.env.CONSOLE_SESSION_SECRET = originalSecret;
    });

    it('creates a token that verifies successfully', async () => {
        const token = await createSessionToken('admin@nfaplanners.com');
        const session = await verifySessionToken(token);
        expect(session).not.toBeNull();
        expect(session!.email).toBe('admin@nfaplanners.com');
    });

    it('returns null for a tampered token', async () => {
        const token = await createSessionToken('admin@nfaplanners.com');
        const tampered = token.slice(0, -5) + 'XXXXX';
        expect(await verifySessionToken(tampered)).toBeNull();
    });

    it('returns null for a completely invalid token', async () => {
        expect(await verifySessionToken('not.a.valid.token')).toBeNull();
    });

    it('returns null for an empty string token', async () => {
        expect(await verifySessionToken('')).toBeNull();
    });

    it('returns null when the token payload lacks an email', async () => {
        const { SignJWT } = await import('jose');
        const secret = getSessionSecret();
        const token = await new SignJWT({})
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('nfa-planners')
            .setAudience('nfa-console')
            .setIssuedAt()
            .setExpirationTime('8h')
            .sign(secret);
        expect(await verifySessionToken(token)).toBeNull();
    });

    it('returns null when the issuer is wrong', async () => {
        const { SignJWT } = await import('jose');
        const secret = getSessionSecret();
        const token = await new SignJWT({ email: 'test@example.com' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('wrong-issuer')
            .setAudience('nfa-console')
            .setIssuedAt()
            .setExpirationTime('8h')
            .sign(secret);
        expect(await verifySessionToken(token)).toBeNull();
    });

    it('returns null when the audience is wrong', async () => {
        const { SignJWT } = await import('jose');
        const secret = getSessionSecret();
        const token = await new SignJWT({ email: 'test@example.com' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('nfa-planners')
            .setAudience('wrong-audience')
            .setIssuedAt()
            .setExpirationTime('8h')
            .sign(secret);
        expect(await verifySessionToken(token)).toBeNull();
    });

    it('returns null for an expired token', async () => {
        const { SignJWT } = await import('jose');
        const secret = getSessionSecret();
        const nowSeconds = Math.floor(Date.now() / 1000);
        const token = await new SignJWT({ email: 'test@example.com' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('nfa-planners')
            .setAudience('nfa-console')
            .setIssuedAt(nowSeconds - 60 * 60 * 24)
            .setExpirationTime(nowSeconds - 60 * 60)
            .sign(secret);
        expect(await verifySessionToken(token)).toBeNull();
    });

    it('throws when CONSOLE_SESSION_SECRET is not set', async () => {
        delete process.env.CONSOLE_SESSION_SECRET;
        expect(() => getSessionSecret()).toThrow('CONSOLE_SESSION_SECRET is not set');
        process.env.CONSOLE_SESSION_SECRET = TEST_SECRET;
    });

    it('throws when secret is too short', async () => {
        process.env.CONSOLE_SESSION_SECRET = Buffer.from('short').toString('base64');
        expect(() => getSessionSecret()).toThrow('at least 32 bytes');
        process.env.CONSOLE_SESSION_SECRET = TEST_SECRET;
    });

    it('each token is unique even for the same email', async () => {
        const token1 = await createSessionToken('admin@nfaplanners.com');
        // Tokens use second-precision timestamps; wait 1.1s to ensure different iat
        await new Promise((r) => setTimeout(r, 1100));
        const token2 = await createSessionToken('admin@nfaplanners.com');
        expect(token1).not.toBe(token2);
        expect((await verifySessionToken(token1))!.email).toBe('admin@nfaplanners.com');
        expect((await verifySessionToken(token2))!.email).toBe('admin@nfaplanners.com');
    });
});