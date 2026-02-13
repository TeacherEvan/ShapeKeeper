// Utilities used by room mutations/queries

export const DEFAULT_COLORS = [
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FF8C00', // Orange
  '#8B00FF', // Purple
  '#00FFFF', // Cyan
];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
