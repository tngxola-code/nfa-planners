/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
    listOpportunities,
    getOpportunityByReference,
    upsertOpportunities,
    markNotified,
    countOpportunities,
    HIGH_MATCH_FIT_SCORE,
} from './opportunities';
import type { Opportunity } from '@/lib/ocds/types';

function makeOpp(overrides: Partial<Opportunity> = {}): Opportunity {
    return {
        id: randomUUID(),
        reference: `REF-${Math.random().toString(36).slice(2, 8)}`,
        title: 'Test Opportunity',
        client: 'Test Client',
        closingDate: '2026-12-31T23:59:59Z',
        source: 'OCDS',
        fitScore: 75,
        hash: randomUUID().replace(/-/g, '').repeat(2).slice(0, 64),
        ingestedAt: '2026-09-01T00:00:00Z',
        status: 'active',
        documentUrls: [],
        ...overrides,
    };
}

const TEST_DATA_DIR = path.join(process.cwd(), 'tmp-test-opportunities', randomUUID());

describe('opportunities repository', () => {
    beforeEach(async () => {
        await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    });

    describe('listOpportunities', () => {
        it('returns empty array when no data', async () => {
            expect(await listOpportunities({}, { dataDir: TEST_DATA_DIR })).toEqual([]);
        });

        it('filters by status', async () => {
            const active = makeOpp({ status: 'active' });
            const closed = makeOpp({ status: 'closed' });
            await upsertOpportunities([active, closed], { dataDir: TEST_DATA_DIR });

            const result = await listOpportunities({ status: 'active' }, { dataDir: TEST_DATA_DIR });
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('active');
        });

        it('filters by category', async () => {
            const townPlanning = makeOpp({ category: 'Town Planning' });
            const gis = makeOpp({ category: 'GIS' });
            await upsertOpportunities([townPlanning, gis], { dataDir: TEST_DATA_DIR });

            const result = await listOpportunities({ category: 'Town Planning' }, { dataDir: TEST_DATA_DIR });
            expect(result).toHaveLength(1);
            expect(result[0].category).toBe('Town Planning');
        });

        it('filters by minFitScore', async () => {
            const high = makeOpp({ fitScore: 90 });
            const low = makeOpp({ fitScore: 50 });
            await upsertOpportunities([high, low], { dataDir: TEST_DATA_DIR });

            const result = await listOpportunities({ minFitScore: 80 }, { dataDir: TEST_DATA_DIR });
            expect(result).toHaveLength(1);
            expect(result[0].fitScore).toBe(90);
        });

        it('filters by search (case-insensitive)', async () => {
            const opp1 = makeOpp({ title: 'Town Planning in Gqeberha' });
            const opp2 = makeOpp({ title: 'GIS Mapping Services' });
            await upsertOpportunities([opp1, opp2], { dataDir: TEST_DATA_DIR });

            const result = await listOpportunities({ search: 'gqeberha' }, { dataDir: TEST_DATA_DIR });
            expect(result).toHaveLength(1);
            expect(result[0].title).toContain('Gqeberha');
        });

        it('sorts by closing date ascending', async () => {
            const opp1 = makeOpp({ closingDate: '2026-12-31T23:59:59Z', reference: 'LATE' });
            const opp2 = makeOpp({ closingDate: '2026-09-01T00:00:00Z', reference: 'EARLY' });
            await upsertOpportunities([opp1, opp2], { dataDir: TEST_DATA_DIR });

            const result = await listOpportunities({}, { dataDir: TEST_DATA_DIR });
            expect(result[0].reference).toBe('EARLY');
            expect(result[1].reference).toBe('LATE');
        });
    });

    describe('getOpportunityByReference', () => {
        it('returns null when not found', async () => {
            expect(await getOpportunityByReference('NONEXISTENT', { dataDir: TEST_DATA_DIR })).toBeNull();
        });

        it('finds opportunity by reference', async () => {
            const opp = makeOpp({ reference: 'FIND-ME' });
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });
            const result = await getOpportunityByReference('FIND-ME', { dataDir: TEST_DATA_DIR });
            expect(result).not.toBeNull();
            expect(result!.reference).toBe('FIND-ME');
        });
    });

    describe('upsertOpportunities', () => {
        it('inserts new opportunities', async () => {
            const result = await upsertOpportunities([makeOpp()], { dataDir: TEST_DATA_DIR });
            expect(result.inserted).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.skippedDuplicates).toBe(0);
        });

        it('skips identical duplicates', async () => {
            const opp = makeOpp();
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });
            const result = await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });
            expect(result.inserted).toBe(0);
            expect(result.skippedDuplicates).toBe(1);
        });

        it('updates when content changes but hash is same', async () => {
            const opp = makeOpp({ fitScore: 70 });
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });

            const updated = { ...opp, fitScore: 85, title: 'Updated Title' };
            const result = await upsertOpportunities([updated], { dataDir: TEST_DATA_DIR });
            expect(result.updated).toBe(1);

            const stored = await getOpportunityByReference(opp.reference, { dataDir: TEST_DATA_DIR });
            expect(stored!.fitScore).toBe(85);
            expect(stored!.id).toBe(opp.id);
        });

        it('preserves id and ingestedAt on update', async () => {
            const opp = makeOpp({ ingestedAt: '2026-01-01T00:00:00Z' });
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });

            const updated = { ...opp, title: 'New Title' };
            await upsertOpportunities([updated], { dataDir: TEST_DATA_DIR });

            const stored = await getOpportunityByReference(opp.reference, { dataDir: TEST_DATA_DIR });
            expect(stored!.id).toBe(opp.id);
            expect(stored!.ingestedAt).toBe(opp.ingestedAt);
        });

        it('preserves notifiedAt on update', async () => {
            const opp = makeOpp({ notifiedAt: '2026-08-01T00:00:00Z' });
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });

            const updated = { ...opp, title: 'Changed', notifiedAt: undefined };
            await upsertOpportunities([updated], { dataDir: TEST_DATA_DIR });

            const stored = await getOpportunityByReference(opp.reference, { dataDir: TEST_DATA_DIR });
            expect(stored!.notifiedAt).toBe('2026-08-01T00:00:00Z');
        });

        it('handles empty batch', async () => {
            const result = await upsertOpportunities([], { dataDir: TEST_DATA_DIR });
            expect(result.inserted).toBe(0);
            expect(result.updated).toBe(0);
            expect(result.skippedDuplicates).toBe(0);
        });

        it('handles duplicates within the same batch', async () => {
            const opp = makeOpp();
            const result = await upsertOpportunities([opp, opp], { dataDir: TEST_DATA_DIR });
            expect(result.inserted).toBe(1);
            expect(result.skippedDuplicates).toBe(1);
        });
    });

    describe('markNotified', () => {
        it('returns 0 when no hashes provided', async () => {
            expect(await markNotified([], '2026-09-01T00:00:00Z', { dataDir: TEST_DATA_DIR })).toBe(0);
        });

        it('marks matching opportunities as notified', async () => {
            const opp = makeOpp();
            await upsertOpportunities([opp], { dataDir: TEST_DATA_DIR });

            const marked = await markNotified([opp.hash], '2026-09-15T00:00:00Z', { dataDir: TEST_DATA_DIR });
            expect(marked).toBe(1);

            const stored = await getOpportunityByReference(opp.reference, { dataDir: TEST_DATA_DIR });
            expect(stored!.notifiedAt).toBe('2026-09-15T00:00:00Z');
        });
    });

    describe('countOpportunities', () => {
        it('returns zero counts when empty', async () => {
            const counts = await countOpportunities({ dataDir: TEST_DATA_DIR, now: new Date('2026-09-01T00:00:00Z') });
            expect(counts).toEqual({ active: 0, newToday: 0, closingSoon: 0, highMatch: 0 });
        });

        it('counts active opportunities', async () => {
            const active = makeOpp({ status: 'active' });
            const closed = makeOpp({ status: 'closed' });
            await upsertOpportunities([active, closed], { dataDir: TEST_DATA_DIR });

            const counts = await countOpportunities({ dataDir: TEST_DATA_DIR, now: new Date('2026-09-01T00:00:00Z') });
            expect(counts.active).toBe(1);
        });

        it('counts new today by ingestedAt', async () => {
            const today = makeOpp({ ingestedAt: '2026-09-01T10:00:00Z' });
            const yesterday = makeOpp({ ingestedAt: '2026-08-31T10:00:00Z' });
            await upsertOpportunities([today, yesterday], { dataDir: TEST_DATA_DIR });

            const counts = await countOpportunities({ dataDir: TEST_DATA_DIR, now: new Date('2026-09-01T00:00:00Z') });
            expect(counts.newToday).toBe(1);
        });

        it('counts closing soon (within 7 days)', async () => {
            const soon = makeOpp({ closingDate: '2026-09-05T00:00:00Z', status: 'active' });
            const later = makeOpp({ closingDate: '2026-12-31T00:00:00Z', status: 'active' });
            const closedSoon = makeOpp({ closingDate: '2026-09-05T00:00:00Z', status: 'closed' });
            await upsertOpportunities([soon, later, closedSoon], { dataDir: TEST_DATA_DIR });

            const counts = await countOpportunities({ dataDir: TEST_DATA_DIR, now: new Date('2026-09-01T00:00:00Z') });
            expect(counts.closingSoon).toBe(1);
        });

        it('counts high match (fitScore >= 80)', async () => {
            const high = makeOpp({ fitScore: HIGH_MATCH_FIT_SCORE });
            const low = makeOpp({ fitScore: HIGH_MATCH_FIT_SCORE - 1 });
            await upsertOpportunities([high, low], { dataDir: TEST_DATA_DIR });

            const counts = await countOpportunities({ dataDir: TEST_DATA_DIR, now: new Date('2026-09-01T00:00:00Z') });
            expect(counts.highMatch).toBe(1);
        });
    });
});