/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { normaliseRelease } from './normalise';
import type { OcdsRelease } from './types';

const baseRelease: OcdsRelease = {
    id: 'rel-001',
    tenderID: 'TENDER-001',
    title: 'Town Planning Services',
    description: 'Professional town planning consultant services.',
    date: '2026-08-01T00:00:00Z',
    procuringEntity: { name: 'Test Municipality' },
    tenderPeriod: { endDate: '2026-12-31T23:59:59Z' },
    tender: { value: { amount: 500000, currency: 'ZAR' } },
    documents: [{ url: 'https://example.com/doc.pdf', title: 'Tender Document' }],
    classification: { scheme: 'Town Planning' },
    mainProcurementLocation: { name: 'Gqeberha' },
    address: { region: 'Eastern Cape' },
};

const now = new Date('2026-09-01T00:00:00Z');

describe('normaliseRelease', () => {
    it('returns a valid Opportunity for a well-formed release', () => {
        const opp = normaliseRelease(baseRelease, now);
        expect(opp).not.toBeNull();
        if (!opp) return;
        expect(opp.reference).toBe('TENDER-001');
        expect(opp.title).toBe('Town Planning Services');
        expect(opp.client).toBe('Test Municipality');
        expect(opp.source).toBe('OCDS');
        expect(opp.status).toBe('active');
        expect(opp.fitScore).toBeGreaterThanOrEqual(40);
        expect(opp.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(opp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('returns null when tenderID is missing', () => {
        const release = { ...baseRelease, tenderID: '' };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('returns null when title is missing', () => {
        const release = { ...baseRelease, title: '' };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('returns null when tenderPeriod.endDate is missing', () => {
        const release = { ...baseRelease, tenderPeriod: undefined };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('returns null when closing date is in the past', () => {
        const release = { ...baseRelease, tenderPeriod: { endDate: '2026-08-01T00:00:00Z' } };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('returns null when fit score is below threshold', () => {
        const release = { ...baseRelease, title: 'Supply of Stationery', description: 'Office supplies.' };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('uses "Unknown client" when procuringEntity.name is missing', () => {
        const release = {
            ...baseRelease,
            title: 'Town Planning and Land Surveying Services',
            procuringEntity: { name: '' },
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.client).toBe('Unknown client');
    });

    it('formats estimatedValue correctly', () => {
        const opp = normaliseRelease(baseRelease, now);
        expect(opp).not.toBeNull();
        expect(opp!.estimatedValue).toBe('500000 ZAR');
    });

    it('detects Town Planning category', () => {
        const opp = normaliseRelease(baseRelease, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Town Planning');
    });

    it('detects Spatial Planning category', () => {
        const release = {
            ...baseRelease,
            title: 'Spatial Planning and Land Use Framework',
            description: 'Spatial planning services.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Spatial Planning');
    });

    it('detects GIS category', () => {
        const release = {
            ...baseRelease,
            title: 'GIS Mapping and Geospatial Services',
            description: 'Geographic information systems.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('GIS');
    });

    it('detects Surveying category', () => {
        const release = {
            ...baseRelease,
            title: 'Cadastral Surveying and Boundary Survey',
            description: 'Land surveying services.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Surveying');
    });

    it('detects Infrastructure category', () => {
        const release = {
            ...baseRelease,
            title: 'Roads and Stormwater Infrastructure Planning',
            description: 'Infrastructure development.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Infrastructure');
    });

    it('detects Human Settlements category', () => {
        const release = {
            ...baseRelease,
            title: 'Human Settlements Housing Development Project',
            description: 'Housing project.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Human Settlements');
    });

    it('defaults to Other category when no keywords match', () => {
        // "bulk services" and "electrification" score 40 via fit.ts Infrastructure Planning
        // but match NO normalise.ts category keywords → category = "Other"
        const release = {
            ...baseRelease,
            title: 'Bulk Services Electrification Project',
            description: 'Bulk services and electrification works.',
            classification: undefined,
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.category).toBe('Other');
    });

    it('produces deterministic hash for same content', () => {
        const opp1 = normaliseRelease(baseRelease, now);
        const opp2 = normaliseRelease(baseRelease, now);
        expect(opp1).not.toBeNull();
        expect(opp2).not.toBeNull();
        expect(opp1!.hash).toBe(opp2!.hash);
    });

    it('produces different hashes for different content', () => {
        const opp1 = normaliseRelease(baseRelease, now);
        const release2 = {
            ...baseRelease,
            title: 'Land Surveying and GIS Mapping Services',
            description: 'Comprehensive surveying and GIS.',
            tenderID: 'TENDER-002',
        };
        const opp2 = normaliseRelease(release2, now);
        expect(opp1).not.toBeNull();
        expect(opp2).not.toBeNull();
        expect(opp1!.hash).not.toBe(opp2!.hash);
    });

    it('extracts contact email and phone', () => {
        const release = {
            ...baseRelease,
            procuringEntity: {
                name: 'Test Municipality',
                contactPoint: { email: 'procurement@test.gov.za', telephone: '+27 41 123 4567' },
            },
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.contactEmail).toBe('procurement@test.gov.za');
        expect(opp!.contactPhone).toBe('+27 41 123 4567');
    });

    it('handles invalid closing date gracefully', () => {
        const release = { ...baseRelease, tenderPeriod: { endDate: 'not-a-date' } };
        expect(normaliseRelease(release, now)).toBeNull();
    });

    it('trims whitespace from text fields', () => {
        const release = {
            ...baseRelease,
            tenderID: '  TENDER-001  ',
            title: '  Town Planning Services  ',
            procuringEntity: { name: '  Test Municipality  ' },
        };
        const opp = normaliseRelease(release, now);
        expect(opp).not.toBeNull();
        expect(opp!.reference).toBe('TENDER-001');
        expect(opp!.title).toBe('Town Planning Services');
        expect(opp!.client).toBe('Test Municipality');
    });
});