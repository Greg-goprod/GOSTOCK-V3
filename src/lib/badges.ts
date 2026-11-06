// Contenu du QR d'un badge personnel : « GOMAT-USER:<code> » (code aléatoire de user_badges)
export const BADGE_PREFIX = 'GOMAT-USER:';

export const badgeValue = (code: string) => `${BADGE_PREFIX}${code}`;

export const isBadgeCode = (text: string) => text.trim().toUpperCase().startsWith(BADGE_PREFIX);
