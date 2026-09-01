/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { renderDigestEmail, opportunityConsoleUrl, HIGH_MATCH_BADGE_THRESHOLD } from './digest';
import type { Opportunity } from '@/lib/ocds/types';

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        reference: 'T-001',
        title: 'Test Opportunity',
        client: 'Test Client',
        closingDate: '2026-12-31T23:59:59Z',
        source: 'OCDS',
        fitScore: 75,
        hash: 'a'.repeat(64),
        ingestedAt: '2026-09-01T00:00:00Z',
        status: 'active',
        documentUrls: [],
        ...overrides,
    };
}

const now = new Date('2026-09-01T00:00:00Z');

describe('opportunityConsoleUrl', () => {
    it('encodes the reference into the URL', () => {
        const url = opportunityConsoleUrl('TENDER/001');
        expect(url).toContain('/opportunities/');
        expect(url).toContain(encodeURIComponent('TENDER/001'));
    });
});

describe('renderDigestEmail', () => {
    it('renders empty-state email when no opportunities', () => {
        const email = renderDigestEmail([], now);
        expect(email.subject).toBe('[NFA] No new opportunities');
        expect(email.html).toContain('No new opportunities');
        expect(email.text).toContain('No new opportunities');
    });

    it('renders single opportunity', () => {
        const opp = makeOpportunity({ title: 'Town Planning Services', fitScore: 85 });
        const email = renderDigestEmail([opp], now);
        expect(email.subject).toBe('[NFA] 1 new opportunity — Town Planning Services');
        expect(email.html).toContain('Town Planning Services');
        expect(email.text).toContain('Town Planning Services');
    });

    it('sorts opportunities by fitScore descending', () => {
        const opps = [
            makeOpportunity({ title: 'Low Fit', fitScore: 60, reference: 'T-001' }),
            makeOpportunity({ title: 'High Fit', fitScore: 95, reference: 'T-002' }),
            makeOpportunity({ title: 'Mid Fit', fitScore: 75, reference: 'T-003' }),
        ];
        const email = renderDigestEmail(opps, now);
        expect(email.subject).toContain('High Fit');
        const html = email.html;
        expect(html.indexOf('High Fit')).toBeLessThan(html.indexOf('Mid Fit'));
        expect(html.indexOf('Mid Fit')).toBeLessThan(html.indexOf('Low Fit'));
    });

    it('shows high match badge for scores >= 80', () => {
        const email = renderDigestEmail([makeOpportunity({ fitScore: HIGH_MATCH_BADGE_THRESHOLD })], now);
        expect(email.html).toContain('High Match');
    });

    it('does not show high match badge for scores < 80', () => {
        const email = renderDigestEmail([makeOpportunity({ fitScore: HIGH_MATCH_BADGE_THRESHOLD - 1 })], now);
        expect(email.html).not.toContain('High Match');
    });

    it('highlights urgent closings in red', () => {
        const urgentDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const email = renderDigestEmail([makeOpportunity({ closingDate: urgentDate })], now);
        expect(email.html).toContain('#B3261E');
    });

    it('does not highlight non-urgent closings in red', () => {
        const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
        const email = renderDigestEmail([makeOpportunity({ closingDate: futureDate })], now);
        expect(email.html).not.toContain('#B3261E');
    });

    it('escapes HTML in opportunity titles', () => {
        const email = renderDigestEmail([makeOpportunity({ title: '<script>alert("xss")</script>' })], now);
        expect(email.html).toContain('&lt;script&gt;');
        expect(email.html).not.toContain('<script>');
    });

    it('formats closing dates in en-ZA locale', () => {
        const email = renderDigestEmail([makeOpportunity({ closingDate: '2026-09-15T12:00:00Z' })], now);
        expect(email.html).toContain('15 Sept 2026');
    });

    it('includes plain text fallback', () => {
        const email = renderDigestEmail([makeOpportunity({ title: 'Test', fitScore: 85 })], now);
        expect(email.text).toContain('Test');
        expect(email.text).toContain('85/100');
    });

    it('marks high match in plain text', () => {
        const email = renderDigestEmail([makeOpportunity({ fitScore: 85 })], now);
        expect(email.text).toContain('[HIGH MATCH]');
    });

    it('includes console URLs in plain text', () => {
        const email = renderDigestEmail([makeOpportunity({ reference: 'T-001' })], now);
        expect(email.text).toContain(opportunityConsoleUrl('T-001'));
    });

    it('handles opportunities without location or province', () => {
        const email = renderDigestEmail([makeOpportunity({ location: undefined, province: undefined })], now);
        expect(email.html).toContain('—');
    });

    it('truncates long titles in subject line', () => {
        const email = renderDigestEmail([makeOpportunity({ title: 'A'.repeat(100) })], now);
        expect(email.subject).toContain('…');
    });

    it('uses correct pluralisation in subject', () => {
        const one = renderDigestEmail([makeOpportunity()], now);
        expect(one.subject).toContain('1 new opportunity');

        const two = renderDigestEmail([makeOpportunity(), makeOpportunity({ reference: 'T-002' })], now);
        expect(two.subject).toContain('2 new opportunities');
    });

    it('includes NFA branding in HTML', () => {
        const email = renderDigestEmail([], now);
        expect(email.html).toContain('NFA Planners');
    });
});