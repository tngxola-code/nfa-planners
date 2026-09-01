/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { verifyConsoleCredentials, normaliseConsoleEmail } from './credentials';
import bcrypt from 'bcryptjs';

const TEST_EMAIL = 'admin@nfaplanners.com';
const TEST_PASSWORD = 'SecurePass123!';
let TEST_HASH: string;

describe('credentials', () => {
    beforeAll(async () => {
        TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 10);
        process.env.CONSOLE_AUTH_EMAIL = TEST_EMAIL;
        process.env.CONSOLE_AUTH_PASSWORD_HASH = TEST_HASH;
    });

    afterAll(() => {
        delete process.env.CONSOLE_AUTH_EMAIL;
        delete process.env.CONSOLE_AUTH_PASSWORD_HASH;
    });

    describe('verifyConsoleCredentials', () => {
        it('returns true for valid credentials', async () => {
            expect(await verifyConsoleCredentials(TEST_EMAIL, TEST_PASSWORD)).toBe(true);
        });

        it('returns false for wrong password', async () => {
            expect(await verifyConsoleCredentials(TEST_EMAIL, 'wrongpassword')).toBe(false);
        });

        it('returns false for wrong email', async () => {
            expect(await verifyConsoleCredentials('wrong@example.com', TEST_PASSWORD)).toBe(false);
        });

        it('is case-insensitive for email', async () => {
            expect(await verifyConsoleCredentials('ADMIN@NFAPLANNERS.COM', TEST_PASSWORD)).toBe(true);
        });

        it('trims whitespace from email', async () => {
            expect(await verifyConsoleCredentials('  admin@nfaplanners.com  ', TEST_PASSWORD)).toBe(true);
        });

        it('throws when environment is not configured', async () => {
            delete process.env.CONSOLE_AUTH_EMAIL;
            await expect(verifyConsoleCredentials(TEST_EMAIL, TEST_PASSWORD)).rejects.toThrow('not configured');
            process.env.CONSOLE_AUTH_EMAIL = TEST_EMAIL;
        });

        it('runs bcrypt even on email mismatch (timing safety)', async () => {
            const start = Date.now();
            await verifyConsoleCredentials('wrong@example.com', TEST_PASSWORD);
            expect(Date.now() - start).toBeGreaterThan(10);
        });
    });

    describe('normaliseConsoleEmail', () => {
        it('lowercases email', () => {
            expect(normaliseConsoleEmail('Admin@NFAPlanners.COM')).toBe('admin@nfaplanners.com');
        });

        it('trims whitespace', () => {
            expect(normaliseConsoleEmail('  admin@nfaplanners.com  ')).toBe('admin@nfaplanners.com');
        });
    });
});