import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  requestImageLoadSlot,
  type ImageLoadPriority,
} from '../../../lib/imageLoadQueue';

/**
 * useQueuedAvatarImage — LOT PHOTOS-OPTIM, O1/O2 (Greg, 2026-10-17). Chargeur
 * commun utilise par `MxAvatar` quand son prop `queued` est actif (page
 * Artistes : cartes et table, la ou le constat de Greg a ete fait -- voir
 * `imageLoadQueue.ts` pour le detail du probleme reseau).
 *
 * Reponsabilites :
 *  1. PROXIMITE (`IntersectionObserver`, `rootMargin: 200px`) -- ne demande
 *     un slot de chargement (`imageLoadQueue`) qu'une fois l'avatar proche
 *     de l'ecran, jamais au montage de 96 cartes d'un coup ;
 *  2. PRIORITE -- si l'avatar est DEJA visible au tout premier callback de
 *     l'observateur (donc au chargement de la page, avant tout defilement),
 *     'high' ; sinon 'low'. Approxime "la premiere rangee visible" (O1) sans
 *     coupler ce hook, generique, a la mise en page de son appelant (nombre
 *     de colonnes, hauteur de carte...) -- un avatar hors ecran au montage
 *     n'a jamais pu faire partie du premier rendu visible, quel que soit le
 *     nombre de rangees qu'il contient.
 *  3. NOUVELLE TENTATIVE (O2) -- en cas d'erreur (ou d'expiration, qui
 *     declenche le meme `onError` sur une balise `<img>`), jusqu'a 2
 *     nouvelles tentatives espacees (3s puis 10s, `RETRY_DELAYS_MS`) ; le
 *     slot est LIBERE immediatement a l'erreur (`release()` avant le
 *     `setTimeout`), la tentative suivante en redemande un NEUF a
 *     l'expiration du delai -- aucun chargement en echec ne bloque la file
 *     pendant son attente. Au-dela de 2 tentatives, abandon DEFINITIF
 *     (`handleError` renvoie `true`) -- pas de boucle infinie.
 *  4. Reutilise la MEME URL (`src`) a chaque tentative -- AUCUN parametre
 *     de cache-busting ajoute (O5 : stabilite du cache i.scdn.co). Un
 *     navigateur relance bien la requete pour une balise `<img>` FRAICHEMENT
 *     MONTEE meme a `src` identique (MxAvatar demonte/remonte l'`<img>`
 *     entre `ready=false` et `ready=true`, voir son commentaire) ; aucun
 *     besoin de modifier l'URL pour forcer une nouvelle tentative.
 */

const RETRY_DELAYS_MS = [3000, 10000] as const;

export interface QueuedAvatarImageResult {
  /** `true` des qu'un slot de chargement est accorde pour la tentative EN COURS -- l'appelant peut alors rendre `<img src=...>`. */
  ready: boolean;
  /** 'high' si l'avatar faisait partie du rendu visible initial, 'low' sinon -- a reporter sur `fetchPriority`. */
  priority: ImageLoadPriority;
  /** A appeler depuis `onLoad` de l'`<img>` -- libere le slot. */
  handleLoad: () => void;
  /**
   * A appeler depuis `onError` de l'`<img>` -- libere le slot et programme
   * une nouvelle tentative si possible. Renvoie `true` si les tentatives
   * sont EPUISEES (l'appelant doit alors basculer en repli initiales
   * definitif), `false` si une nouvelle tentative est programmee.
   */
  handleError: () => boolean;
}

export function useQueuedAvatarImage(
  src: string | null | undefined,
  containerRef: RefObject<HTMLElement | null>,
): QueuedAvatarImageResult {
  const [isNear, setIsNear] = useState(false);
  const [priority, setPriority] = useState<ImageLoadPriority>('low');
  const [ready, setReady] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const releaseRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  // `src` change (nouvel avatar/URL, noeud recycle par une liste) -- toute
  // demande/retry/slot de l'URL PRECEDENTE est abandonnee, l'etat reparts a
  // zero pour la nouvelle (meme principe que `MxAvatar` pour
  // `imageError`/`imageLoaded`, voir son commentaire de tete).
  useEffect(() => {
    retryCountRef.current = 0;
    setReady(false);
    setIsNear(false);
    setPriority('low');
    setRetryTick(0);
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      cancelRef.current?.();
      releaseRef.current?.();
      cancelRef.current = null;
      releaseRef.current = null;
    };
  }, [src]);

  // Proximite + priorite initiale.
  useEffect(() => {
    if (!src) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // Pas d'IntersectionObserver disponible (environnement de test sans
      // mock, navigateur tres ancien) -- degradation gracieuse : chargement
      // immediat, priorite basse (aucune notion fiable de "visible au
      // premier rendu" sans observateur).
      setPriority('low');
      setIsNear(true);
      return;
    }
    let firstCallback = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (firstCallback) {
          setPriority(entry.isIntersecting ? 'high' : 'low');
          firstCallback = false;
        }
        if (entry.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, containerRef]);

  // File de chargement -- une demande par tentative (`retryTick`).
  useEffect(() => {
    if (!src || !isNear) return;
    const request = requestImageLoadSlot(priority);
    cancelRef.current = request.cancel;
    let cancelled = false;
    request.promise.then((release) => {
      if (cancelled) {
        release();
        return;
      }
      releaseRef.current = release;
      setReady(true);
    });
    return () => {
      cancelled = true;
      request.cancel();
    };
  }, [src, isNear, priority, retryTick]);

  function releaseSlot(): void {
    releaseRef.current?.();
    releaseRef.current = null;
  }

  function handleLoad(): void {
    releaseSlot();
  }

  function handleError(): boolean {
    releaseSlot();
    setReady(false);
    if (retryCountRef.current >= RETRY_DELAYS_MS.length) {
      return true; // Tentatives epuisees -- abandon definitif (pas de boucle infinie).
    }
    const delay = RETRY_DELAYS_MS[retryCountRef.current];
    retryCountRef.current += 1;
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(() => {
      setRetryTick((tick) => tick + 1);
    }, delay);
    return false;
  }

  return { ready, priority, handleLoad, handleError };
}
