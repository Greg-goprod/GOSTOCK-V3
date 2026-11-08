export const DEFAULT_DIGEST_HOUR = 7;

// Valeur du réglage « pilote_digest_hour » telle que la base la lit : un entier de 0 à 23 (heure de Zurich), sinon 7
export function parseDigestHour(value: string | null | undefined): number {
  const t = (value ?? '').trim();
  if (!/^\d{1,2}$/.test(t)) return DEFAULT_DIGEST_HOUR;
  const n = Number(t);
  return n >= 0 && n <= 23 ? n : DEFAULT_DIGEST_HOUR;
}
