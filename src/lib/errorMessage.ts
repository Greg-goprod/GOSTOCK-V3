// Texte d'une erreur attrapée (catch) : le message si elle en a un, sinon vide (pour écrire `messageOf(error) || 'Erreur lors de…'`).
// Une erreur attrapée n'a pas de type connu : on ne suppose rien d'elle.
export const messageOf = (error: unknown): string => {
  const m = (error as { message?: unknown } | null | undefined)?.message;
  return typeof m === 'string' ? m : '';
};

// Nom d'une erreur attrapée (« TimeoutError », « AbortError »…), vide si elle n'en a pas
export const nameOf = (error: unknown): string => {
  const n = (error as { name?: unknown } | null | undefined)?.name;
  return typeof n === 'string' ? n : '';
};
