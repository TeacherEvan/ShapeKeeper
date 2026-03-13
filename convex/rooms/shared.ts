export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export const DEFAULT_COLORS = ['#FF0000', '#0000FF', '#00FF00', '#FF8C00', '#8B00FF', '#00FFFF'];
