import { describe, expect, it } from 'vitest';
import * as inviteGenerator from '../../src/utils/inviteGenerator';

describe('invite generator', () => {
  it('exports an invite-generation function', () => {
    expect(Object.keys(inviteGenerator).length).toBeGreaterThan(0);
  });
});
