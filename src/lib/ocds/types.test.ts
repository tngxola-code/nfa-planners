/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { isOcdsRelease, isOpportunity, isOpportunityCategory } from './types';
import type { OcdsRelease, Opportunity } from './types';

const validRelease: OcdsRelease = {
    id: 'rel-001',
    tenderID: 'T-001',
    title: 'Test Tender',
    description: 'A test tender.',
    date: '2026-08-01T00:00:00Z',
    procuringEntity: { name: 'Test Buyer' },
};

const validOpportunity: Opportunity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    reference: 'T-001',
    title: 'Test Tender',
    client: 'Test Buyer',
    closingDate: '2026-12-31T23:59:59Z',
    source: 'OCDS',
    fitScore: 80,
    hash: 'a'.repeat(64),
    ingestedAt: '2026-09-01T00:00:00Z',
    status: 'active',
    documentUrls: [],
};

describe('isOcdsRelease', () => {
    it('returns true for a valid minimal release', () => {
        expect(isOcdsRelease(validRelease)).toBe(true);
    });

    it('returns false for null', () => {
        expect(isOcdsRelease(null)).toBe(false);
    });

    it('returns false for a string', () => {
        expect(isOcdsRelease('not an object')).toBe(false);
    });

    it('returns false when id is missing', () => {
        const { id, ...rest } = validRelease;
        expect(isOcdsRelease(rest)).toBe(false);
    });

    it('returns false when procuringEntity is not an object', () => {
        expect(isOcdsRelease({ ...validRelease, procuringEntity: 'not an object' })).toBe(false);
    });

    it('returns false for invalid contactPoint', () => {
        expect(isOcdsRelease({
            ...validRelease,
            procuringEntity: { name: 'Test', contactPoint: 'not an object' },
        })).toBe(false);
    });

    it('returns false for invalid documents (not array)', () => {
        expect(isOcdsRelease({ ...validRelease, documents: 'not an array' })).toBe(false);
    });

    it('returns false for invalid document entry', () => {
        expect(isOcdsRelease({ ...validRelease, documents: [{ url: 123 }] })).toBe(false);
    });
});

describe('isOpportunity', () => {
    it('returns true for a valid minimal opportunity', () => {
        expect(isOpportunity(validOpportunity)).toBe(true);
    });

    it('returns false for null', () => {
        expect(isOpportunity(null)).toBe(false);
    });

    it('returns false when required fields are missing', () => {
        const { id, ...rest } = validOpportunity;
        expect(isOpportunity(rest)).toBe(false);
    });

    it('returns false when status is invalid', () => {
        expect(isOpportunity({ ...validOpportunity, status: 'invalid' })).toBe(false);
    });

    it('returns false when documentUrls is not an array', () => {
        expect(isOpportunity({ ...validOpportunity, documentUrls: 'not an array' })).toBe(false);
    });

    it('returns false when category is invalid', () => {
        expect(isOpportunity({ ...validOpportunity, category: 'Invalid Category' })).toBe(false);
    });
});

describe('isOpportunityCategory', () => {
    it('returns true for valid categories', () => {
        expect(isOpportunityCategory('Town Planning')).toBe(true);
        expect(isOpportunityCategory('GIS')).toBe(true);
        expect(isOpportunityCategory('Other')).toBe(true);
    });

    it('returns false for invalid categories', () => {
        expect(isOpportunityCategory('Invalid')).toBe(false);
        expect(isOpportunityCategory(123)).toBe(false);
    });
});