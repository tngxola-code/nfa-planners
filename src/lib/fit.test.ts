/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { scoreFit, FIT_THRESHOLD, NFA_CAPABILITIES } from './fit';

describe('scoreFit', () => {
    it('returns 0 when no keywords match', () => {
        const result = scoreFit({ title: 'Supply of office furniture' });
        expect(result.score).toBe(0);
        expect(result.matchedCapabilities).toHaveLength(0);
        expect(result.reason).toContain('No capability keywords');
    });

    it('scores town planning keywords in title', () => {
        const result = scoreFit({ title: 'Town Planning Services for Municipality' });
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.matchedCapabilities).toContain('Town and Regional Planning');
        expect(result.reason).toContain('Town and Regional Planning');
    });

    it('scores land surveying keywords in title', () => {
        const result = scoreFit({ title: 'Cadastral Land Surveyor Required' });
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.matchedCapabilities).toContain('Land Surveying');
    });

    it('scores GIS keywords in title', () => {
        const result = scoreFit({ title: 'Geographic Information System Mapping' });
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.matchedCapabilities).toContain('GIS / Geospatial Intelligence');
    });

    it('scores infrastructure keywords in title', () => {
        const result = scoreFit({ title: 'Bulk Infrastructure and Roads Planning' });
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.matchedCapabilities).toContain('Infrastructure Planning');
    });

    it('gives higher score for title hits than description hits', () => {
        const titleOnly = scoreFit({ title: 'Town Planning Consultant' });
        const descOnly = scoreFit({
            title: 'General Consultant',
            description: 'Town Planning Consultant',
        });
        expect(titleOnly.score).toBeGreaterThan(descOnly.score);
    });

    it('caps single capability contribution at 40 points', () => {
        const result = scoreFit({
            title: 'Town planning town planner regional planning township establishment land use rezoning subdivision precinct plan layout plan development application urban design urban planning',
        });
        expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it('awards government client bonus when client field matches', () => {
        const result = scoreFit({
            title: 'Town Planning and Land Surveying Services', // 20 + 20 = 40 base
            client: 'Department of Public Works',
        });
        expect(result.reason).toContain('government/institutional client');
        expect(result.score).toBeGreaterThanOrEqual(40 + 15);
    });

    it('awards government client bonus when title contains government indicator', () => {
        const result = scoreFit({
            title: 'Town Planning for Buffalo City Municipality',
        });
        expect(result.reason).toContain('government/institutional client');
    });

    it('awards Eastern Cape bonus for Eastern Cape locations', () => {
        const result = scoreFit({
            title: 'Town Planning and Land Surveying Services', // 40 base
            location: 'Gqeberha, Eastern Cape',
        });
        expect(result.reason).toContain('Eastern Cape location');
        expect(result.score).toBeGreaterThanOrEqual(40 + 10);
    });

    it('awards national bonus for South Africa references', () => {
        const result = scoreFit({
            title: 'National Town Planning',
            location: 'South Africa',
        });
        expect(result.reason).toContain('national location');
    });

    it('Eastern Cape bonus outweighs national bonus', () => {
        const result = scoreFit({
            title: 'Town Planning',
            location: 'East London, South Africa',
        });
        expect(result.reason).toContain('Eastern Cape location');
        expect(result.reason).not.toContain('national location');
    });

    it('is case insensitive', () => {
        const lower = scoreFit({ title: 'town planning' });
        const upper = scoreFit({ title: 'TOWN PLANNING' });
        const mixed = scoreFit({ title: 'ToWn PlAnNiNg' });
        expect(lower.score).toBe(upper.score);
        expect(upper.score).toBe(mixed.score);
    });

    it('does not match partial words', () => {
        const result = scoreFit({ title: 'Surveillance Camera Installation' });
        expect(result.matchedCapabilities).not.toContain('Land Surveying');
    });

    it('handles multiple capabilities', () => {
        const result = scoreFit({
            title: 'Town Planning and Land Surveying Services',
        });
        expect(result.matchedCapabilities).toContain('Town and Regional Planning');
        expect(result.matchedCapabilities).toContain('Land Surveying');
        expect(result.score).toBeGreaterThan(40);
    });

    it('clamps score to maximum 100', () => {
        const result = scoreFit({
            title: 'Town Planning Land Surveying GIS Infrastructure',
            client: 'Department of Municipal Government',
            location: 'Gqeberha, Eastern Cape',
        });
        expect(result.score).toBe(100);
    });

    it('handles empty/undefined inputs gracefully', () => {
        const result = scoreFit({title: ""});
        expect(result.score).toBe(0);
        expect(result.matchedCapabilities).toHaveLength(0);
    });

    it('matches description-only keywords', () => {
        const result = scoreFit({
            title: 'Consultant Services',
            description: 'The successful bidder will provide town planning services including rezoning and subdivision applications.',
        });
        expect(result.score).toBeGreaterThan(0);
        expect(result.matchedCapabilities).toContain('Town and Regional Planning');
    });
});

describe('FIT_THRESHOLD', () => {
    it('is set to 40', () => {
        expect(FIT_THRESHOLD).toBe(40);
    });
});

describe('NFA_CAPABILITIES', () => {
    it('contains the four core capabilities', () => {
        expect(NFA_CAPABILITIES).toContain('Town and Regional Planning');
        expect(NFA_CAPABILITIES).toContain('Land Surveying');
        expect(NFA_CAPABILITIES).toContain('GIS / Geospatial Intelligence');
        expect(NFA_CAPABILITIES).toContain('Infrastructure Planning');
    });
});