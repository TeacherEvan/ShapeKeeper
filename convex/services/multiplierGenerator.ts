export type Multiplier =
  | { type: 'multiplier'; value: number }
  | { type: 'truthOrDare' };

export function generateMultiplier(): Multiplier | undefined {
  const rand = Math.random() * 100;

  if (rand < 60) return { type: 'multiplier', value: 2 };
  if (rand < 80) return { type: 'multiplier', value: 3 };
  if (rand < 90) return { type: 'multiplier', value: 4 };
  if (rand < 95) return { type: 'multiplier', value: 5 };
  if (rand < 96) return { type: 'multiplier', value: 10 };
  if (rand < 100) return { type: 'truthOrDare' };

  return undefined;
}
