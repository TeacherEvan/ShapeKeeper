import { describe, expect, it, vi } from 'vitest';
import { generateMultiplier } from './multiplierGenerator';

describe('generateMultiplier', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns x2 for rand < 60', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // 10% -> < 60
    expect(generateMultiplier()).toEqual({ type: 'multiplier', value: 2 });
  });

  it('returns x3 for 60 <= rand < 80', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.65); // 65% -> < 80
    expect(generateMultiplier()).toEqual({ type: 'multiplier', value: 3 });
  });

  it('returns truthOrDare when rand approaches 1.0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.995); // 99.5% -> truthOrDare
    expect(generateMultiplier()).toEqual({ type: 'truthOrDare' });
  });
});
