/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { sanitiseReturnTo, DEFAULT_RETURN_TO } from './returnTo';

describe('sanitiseReturnTo', () => {
    it('returns the path for valid console subpaths', () => {
        expect(sanitiseReturnTo('/console/dashboard')).toBe('/console/dashboard');
        expect(sanitiseReturnTo('/console/opportunities')).toBe('/console/opportunities');
        expect(sanitiseReturnTo('/console/opportunities/some-slug')).toBe('/console/opportunities/some-slug');
    });

    it('returns default for null', () => {
        expect(sanitiseReturnTo(null)).toBe(DEFAULT_RETURN_TO);
    });

    it('returns default for empty string', () => {
        expect(sanitiseReturnTo('')).toBe(DEFAULT_RETURN_TO);
    });

    it('returns default for protocol-relative URLs', () => {
        expect(sanitiseReturnTo('//evil.example.com/console/dashboard')).toBe(DEFAULT_RETURN_TO);
    });

    it('returns default for absolute URLs', () => {
        expect(sanitiseReturnTo('https://evil.example.com/console/dashboard')).toBe(DEFAULT_RETURN_TO);
    });

    it('returns default for paths outside /console', () => {
        expect(sanitiseReturnTo('/')).toBe(DEFAULT_RETURN_TO);
        expect(sanitiseReturnTo('/about')).toBe(DEFAULT_RETURN_TO);
    });

    it('returns default for the login page itself', () => {
        expect(sanitiseReturnTo('/console/login')).toBe(DEFAULT_RETURN_TO);
        expect(sanitiseReturnTo('/console/login?returnTo=/console/dashboard')).toBe(DEFAULT_RETURN_TO);
    });

    it('preserves query strings on valid paths', () => {
        expect(sanitiseReturnTo('/console/opportunities?filter=high')).toBe('/console/opportunities?filter=high');
    });

    it('is case-sensitive for path matching', () => {
        expect(sanitiseReturnTo('/Console/dashboard')).toBe(DEFAULT_RETURN_TO);
    });
});