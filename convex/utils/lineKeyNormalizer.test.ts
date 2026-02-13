import { describe, expect, it } from 'vitest';
import { normalizeLineKey } from './lineKeyNormalizer';

describe('normalizeLineKey', () => {
  it('orders coordinates so smaller comes first (row-major)', () => {
    expect(normalizeLineKey(1, 2, 1, 3)).toBe('1,2-1,3');
    expect(normalizeLineKey(1, 3, 1, 2)).toBe('1,2-1,3');
    expect(normalizeLineKey(2, 0, 1, 0)).toBe('1,0-2,0');
    expect(normalizeLineKey(0, 0, 0, 1)).toBe('0,0-0,1');
  });
});
