/**
 * imageLoadQueue — LOT PHOTOS-OPTIM, O1 (Greg, 2026-10-17). Constat de
 * Greg (onglet Reseau) : les vignettes Spotify (i.scdn.co), meme en 320px,
 * partent TOUTES en meme temps des qu'elles sont presentes dans le DOM --
 * jusqu'a 96 requetes simultanees sur la page 2 des Artistes -- et
 * expirent en masse (`net::ERR_TIMED_OUT`) avant reponse. i.scdn.co sert
 * en HTTP/2 (multiplexage sur une seule connexion), donc la limite
 * historique "6 connexions par hote" de HTTP/1.1 ne protege plus rien ici.
 *
 * Ce module reintroduit cette limite nous-memes, cote application :
 * `MAX_CONCURRENT_IMAGE_LOADS` chargements EN COURS au maximum, TOUS
 * CONSOMMATEURS CONFONDUS (etat de PROCESSUS, pas par composant/page --
 * une page Artistes ET un drawer Offre ouverts en meme temps partagent la
 * meme file).
 *
 * Protocole pour l'appelant :
 *  1. `const { promise, cancel } = requestImageLoadSlot(priority)` ;
 *  2. attendre que `promise` se resolve (le slot est accorde) AVANT de
 *     poser `img.src` -- poser `src` plus tot reintroduit exactement le
 *     bug (le navigateur demarre la requete des que `src` est pose, file
 *     ou pas) ;
 *  3. appeler la fonction recue (resolution de `promise`) des que l'image a
 *     fini de charger, succes OU echec (`onLoad`/`onError`), pour liberer
 *     le slot et laisser le suivant demarrer ;
 *  4. si le composant est demonte / n'a plus besoin de l'image AVANT que
 *     `promise` se resolve, appeler `cancel()` pour la retirer de la file
 *     (sans effet si deja accordee).
 *
 * PRIORITE : une demande 'high' est inseree devant toutes les 'low' deja en
 * file (mais apres les 'high' deja presentes -- FIFO a priorite egale) ;
 * elle n'interrompt jamais un chargement DEJA en cours.
 */

export const MAX_CONCURRENT_IMAGE_LOADS = 6;

export type ImageLoadPriority = 'high' | 'low';

interface QueueEntry {
  priority: ImageLoadPriority;
  grant: () => void;
}

export interface ImageLoadRequest {
  /**
   * Resout des qu'un slot est accorde. La valeur resolue est la fonction a
   * appeler EXACTEMENT UNE FOIS (succes ou erreur de l'image) pour liberer
   * le slot et laisser la file avancer.
   */
  promise: Promise<() => void>;
  /**
   * Retire la demande de la file si elle n'a pas encore ete honoree (ex.
   * demontage du composant avant que son tour arrive). Sans effet si le
   * slot a deja ete accorde ou si `cancel` est appele une 2e fois.
   */
  cancel: () => void;
}

let activeCount = 0;
const queue: QueueEntry[] = [];

/** Nombre de chargements actuellement EN COURS (slot accorde, pas encore libere). Jamais > `MAX_CONCURRENT_IMAGE_LOADS`. Expose pour les tests. */
export function getActiveImageLoadCount(): number {
  return activeCount;
}

/** Nombre de demandes EN ATTENTE d'un slot. Expose pour les tests. */
export function getQueuedImageLoadCount(): number {
  return queue.length;
}

function insertByPriority(entry: QueueEntry): void {
  if (entry.priority === 'low') {
    queue.push(entry);
    return;
  }
  // 'high' : apres les 'high' deja en file, avant la premiere 'low'.
  const firstLowIndex = queue.findIndex((e) => e.priority === 'low');
  if (firstLowIndex === -1) queue.push(entry);
  else queue.splice(firstLowIndex, 0, entry);
}

function dequeueNext(): void {
  if (activeCount >= MAX_CONCURRENT_IMAGE_LOADS) return;
  const next = queue.shift();
  if (!next) return;
  next.grant();
}

export function requestImageLoadSlot(priority: ImageLoadPriority = 'low'): ImageLoadRequest {
  let settled = false;
  let resolvePromise!: (release: () => void) => void;
  const promise = new Promise<() => void>((resolve) => {
    resolvePromise = resolve;
  });

  let released = false;
  const release = (): void => {
    if (!settled || released) return;
    released = true;
    activeCount = Math.max(0, activeCount - 1);
    dequeueNext();
  };

  const grant = (): void => {
    settled = true;
    activeCount += 1;
    resolvePromise(release);
  };

  let entry: QueueEntry | null = null;
  if (activeCount < MAX_CONCURRENT_IMAGE_LOADS) {
    grant();
  } else {
    entry = { priority, grant };
    insertByPriority(entry);
  }

  const cancel = (): void => {
    if (settled || !entry) return;
    const idx = queue.indexOf(entry);
    if (idx !== -1) queue.splice(idx, 1);
  };

  return { promise, cancel };
}

/**
 * Reservee aux tests : remet la file a plat entre deux scenarios isoles
 * (l'etat du module est un singleton de PROCESSUS, partage entre tous les
 * tests du meme fichier sinon).
 */
export function __resetImageLoadQueueForTests(): void {
  activeCount = 0;
  queue.length = 0;
}
