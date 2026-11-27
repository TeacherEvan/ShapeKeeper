// Utilities used by room mutations/queries

export const DEFAULT_COLORS = [
  '#FF5C5C', // Coral Red
  '#3B82F6', // Royal Blue
  '#10B981', // Emerald Green
  '#F59E0B', // Amber Gold
  '#A855F7', // Violet
  '#EC4899', // Magenta Pink
];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getHostTokenHash(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
