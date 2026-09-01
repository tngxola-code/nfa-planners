/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJsonFile, updateJsonFile, writeJsonFile } from './fileStore';

const TEST_DIR = path.join(process.cwd(), 'tmp-test-filestore', randomUUID());

describe('fileStore', () => {
    beforeEach(async () => {
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe('readJsonFile', () => {
        it('returns fallback when file does not exist', async () => {
            const result = await readJsonFile(path.join(TEST_DIR, 'missing.json'), []);
            expect(result).toEqual([]);
        });

        it('reads and parses existing JSON file', async () => {
            const filePath = path.join(TEST_DIR, 'data.json');
            await fs.writeFile(filePath, JSON.stringify({ foo: 'bar' }), 'utf8');
            expect(await readJsonFile(filePath, {})).toEqual({ foo: 'bar' });
        });

        it('throws on malformed JSON', async () => {
            const filePath = path.join(TEST_DIR, 'bad.json');
            await fs.writeFile(filePath, 'not json', 'utf8');
            await expect(readJsonFile(filePath, [])).rejects.toThrow('fileStore: failed to read');
        });
    });

    describe('writeJsonFile', () => {
        it('writes JSON to a new file', async () => {
            const filePath = path.join(TEST_DIR, 'write.json');
            await writeJsonFile(filePath, { hello: 'world' });
            const content = await fs.readFile(filePath, 'utf8');
            expect(JSON.parse(content)).toEqual({ hello: 'world' });
        });

        it('overwrites existing file', async () => {
            const filePath = path.join(TEST_DIR, 'overwrite.json');
            await writeJsonFile(filePath, { v: 1 });
            await writeJsonFile(filePath, { v: 2 });
            const content = await fs.readFile(filePath, 'utf8');
            expect(JSON.parse(content)).toEqual({ v: 2 });
        });

        it('creates parent directories on demand', async () => {
            const filePath = path.join(TEST_DIR, 'deep', 'nested', 'file.json');
            await writeJsonFile(filePath, { deep: true });
            expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual({ deep: true });
        });
    });

    describe('updateJsonFile', () => {
        it('creates file with fallback when missing', async () => {
            const filePath = path.join(TEST_DIR, 'update-new.json');
            const result = await updateJsonFile<string[]>(filePath, [], (current) => [...current, 'item']);
            expect(result).toEqual(['item']);
        });

        it('updates existing file', async () => {
            const filePath = path.join(TEST_DIR, 'update-existing.json');
            await fs.writeFile(filePath, JSON.stringify([1, 2]), 'utf8');
            const result = await updateJsonFile<number[]>(filePath, [], (current) => [...current, 3]);
            expect(result).toEqual([1, 2, 3]);
        });

        it('uses result selector when provided', async () => {
            const filePath = path.join(TEST_DIR, 'selector.json');
            const result = await updateJsonFile(
                filePath,
                { count: 0 },
                (current) => ({ count: current.count + 1 }),
                (next) => next.count,
            );
            expect(result).toBe(1);
        });

        it('serialises concurrent updates for the same file', async () => {
            const filePath = path.join(TEST_DIR, 'concurrent.json');
            await fs.writeFile(filePath, JSON.stringify({ counter: 0 }), 'utf8');

            const updates = Array.from({ length: 10 }, (_, i) =>
                updateJsonFile(filePath, { counter: 0 }, (current) => ({
                    counter: current.counter + 1,
                    last: i,
                })),
            );

            await Promise.all(updates);
            const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
            expect(data.counter).toBe(10);
        });

        it('does not wedge queue after a failure', async () => {
            const filePath = path.join(TEST_DIR, 'recover.json');
            await fs.writeFile(filePath, JSON.stringify({ ok: true }), 'utf8');

            const failing = updateJsonFile(filePath, {}, () => {
                throw new Error('intentional failure');
            });
            await expect(failing).rejects.toThrow('intentional failure');

            const succeeding = await updateJsonFile(filePath, {}, (current) => ({
                ...current,
                recovered: true,
            }));
            expect(succeeding).toEqual({ ok: true, recovered: true });
        });
    });
});