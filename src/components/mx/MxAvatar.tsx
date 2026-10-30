import { useRef, useState, type CSSProperties } from 'react';

import { useQueuedAvatarImage } from './internal/useQueuedAvatarImage';

/**
 * MxAvatar — LOT MENU-UTILISATEUR B (2026-09-29). Image si `src` est fourni,
 * repli sur les initiales sinon — ET AUSSI si l'image echoue a charger
 * (`onError`), point que ne couvrent pas les 2 precedents existants de
 * l'appli avant ce lot :
 *   - `src/components/staff/StaffAvatar.tsx` : BON modele, gere deja
 *     `onError` -> repli initiales (`imageError` en etat).
 *   - `src/components/ui/Avatar.tsx` et l'`Avatar` local de
 *     `topbar/UserMenu.tsx` : PAS d'`onError`, une URL cassee y affiche
 *     l'icone "image cassee" du navigateur au lieu des initiales.
 * MxAvatar suit le premier modele, en primitive du tronc --mx-*.
 *
 * INITIALES : 2 premieres lettres des 2 premiers "mots" de `name` (meme
 * algorithme que l'`Avatar` local de `topbar/UserMenu.tsx`, pour un rendu
 * identique entre les 2 branches sur le meme profil). `?` si `name` est vide.
 *
 * TAILLES PAR TOKEN (`--mx-avatar-size-sm|md|lg|xl`, tokens-mx.css) — voir
 * leur commentaire pour l'origine de chaque valeur (catalogue ou cran
 * intermediaire). `xl` : LOT ARTISTES-LISTE, C2.4 (2026-10-03), carte
 * Artiste agrandie (8 colonnes a 1920px/Compacte).
 *
 * FOND DES INITIALES : `--mx-accent-lt` + texte `--mx-accent` — meme paire
 * que l'item COCHE de MxMenu (accent en aplat delaye + texte accent), et
 * precedent direct du catalogue sur un avatar mini de menu contextuel
 * (`background:rgba(var(--accent-rgb),.12);color:var(--accent)`,
 * reference/Mannyx Components V2.html, section "Menu contextuel").
 *
 * JAMAIS DE CERCLE VIDE -- LOT VUES-CARTES-LISTE, C3.2 (Greg, 2026-10-17).
 * REGRESSION constatee (Yann Muller, Supremnova, Pierre de Maere sur les
 * Offres ; Ninho, Naza, Pink Martini... sur la page 2 des Artistes) : un
 * `src` present rendait un `<img>` IMMEDIATEMENT, avant meme que le
 * navigateur ait fini de le recuperer -- le temps du reseau, l'avatar
 * affichait un rond VIDE (ni initiales, ni photo), pas le repli attendu.
 * `showImage` exigeait seulement `!imageError`, jamais `imageLoaded`.
 *
 * Corrige par un second etat, `imageLoaded` (pose par `onLoad`) : les
 * initiales restent affichees TANT QUE l'image n'est pas chargee, ET si
 * elle echoue (`onError`), la photo ne remplace les initiales qu'UNE FOIS
 * `onLoad` effectivement declenche.
 *
 * REGRESSION C4.1 (Greg, 2026-10-17 08:07) : le premier correctif masquait
 * l'`<img>` via `display:none` pendant le chargement, COMBINE a
 * `loading="lazy"` -- or une image en `display:none` n'entre JAMAIS dans le
 * viewport (elle n'a ni position ni dimensions visibles), donc un
 * navigateur qui respecte `loading="lazy"` ne la charge JAMAIS : repli
 * initiales PERMANENT, aucune photo ne s'affichait plus nulle part (meme
 * les cartes de Contrat, qui fonctionnaient avant ce correctif). Corrige en
 * SUPERPOSANT l'image aux initiales plutot qu'en la masquant : l'`<img>`
 * est toujours rendue EN BLOC (jamais `display:none`), en position absolue
 * PAR-DESSUS les initiales, opacite 0 jusqu'a `onLoad` puis 1 -- elle entre
 * donc bien dans le flux visuel/le viewport des le montage, `loading="lazy"`
 * continue de fonctionner normalement (differe le reseau tant qu'elle est
 * hors zone visible, la charge des qu'elle y entre), et les initiales
 * restent visibles EN DESSOUS tant que l'opacite est a 0 -- y compris apres
 * une erreur (`onError` retire l'`<img>` du DOM, les initiales etant deja
 * la couche de base, rien ne change visuellement).
 *
 * `src` peut changer SANS demontage du composant (ex. noeud recycle par une
 * liste virtualisee, ou l'avatar d'un drawer qui change d'artiste) : l'etat
 * `imageError`/`imageLoaded` est donc reinitialise des que `src` change,
 * sinon un echec/chargement de l'URL precedente resterait colle a la
 * nouvelle (calcul direct pendant le rendu, meme motif que React
 * recommande pour « adjusting state when a prop changes » -- pas de
 * `useEffect` pour ca, un rendu de plus suffit).
 *
 * PROP `queued` -- LOT PHOTOS-OPTIM, O1/O2 (Greg, 2026-10-17). Constat : les
 * vignettes Spotify (i.scdn.co) partent TOUTES en meme temps des qu'elles
 * sont dans le DOM (jusqu'a 96 sur la page 2 des Artistes) et expirent en
 * masse (`net::ERR_TIMED_OUT`). Active `useQueuedAvatarImage` (file commune
 * a 6 chargements simultanes au plus, visibles d'abord, 2 nouvelles
 * tentatives espacees en cas d'echec) -- voir son commentaire de tete.
 * Par defaut `false` : comportement IDENTIQUE a avant ce lot pour tous les
 * AUTRES appelants de `MxAvatar` (staff, contacts, contrats, notifications,
 * menu utilisateur...), qui n'exposent pas ce probleme et ne doivent subir
 * AUCUN changement -- seuls `ArtistCard`/`ArtistesListMx` et
 * `MxTableIdentityCell` (page Artistes, cartes et table) l'activent.
 */
export type MxAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface MxAvatarProps {
  /** URL de l'image. `null`/`undefined`/chaine vide -> repli initiales direct. */
  src?: string | null;
  /** Nom complet — source des initiales de repli ET de l'`alt` par defaut. */
  name?: string | null;
  /** Texte alternatif explicite. A defaut, derive de `name` ("Photo de {name}"). */
  alt?: string;
  size?: MxAvatarSize;
  className?: string;
  style?: CSSProperties;
  /** LOT PHOTOS-OPTIM, O1/O2 (2026-10-17) -- file de chargement + nouvelles tentatives, voir le commentaire de tete. Defaut `false` (comportement inchange). */
  queued?: boolean;
}

const SIZE_VAR: Record<MxAvatarSize, string> = {
  sm: 'var(--mx-avatar-size-sm)',
  md: 'var(--mx-avatar-size-md)',
  lg: 'var(--mx-avatar-size-lg)',
  xl: 'var(--mx-avatar-size-xl)',
};

const FONT_SIZE_VAR: Record<MxAvatarSize, string> = {
  sm: 'var(--mx-fs-avatar-sm)',
  md: 'var(--mx-fs-avatar-md)',
  lg: 'var(--mx-fs-avatar-lg)',
  xl: 'var(--mx-fs-avatar-xl)',
};

function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function MxAvatar({ src, name, alt, size = 'md', className, style, queued = false }: MxAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // `src` change sans demontage -> l'etat de l'IMAGE PRECEDENTE ne doit pas
  // survivre a la nouvelle URL. Calcul direct pendant le rendu (pas de
  // `useEffect`) : voir le commentaire d'en-tete du fichier.
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setImageError(false);
    setImageLoaded(false);
  }

  // Appele inconditionnellement (regles des hooks) ; `src` vaut `null`
  // quand `queued` est faux -- le hook se neutralise alors lui-meme (aucun
  // IntersectionObserver/slot de file demande), `queuedImage.ready` reste a
  // `false` mais n'est JAMAIS lu dans ce cas (voir `canRenderImg`).
  const queuedImage = useQueuedAvatarImage(queued ? src : null, containerRef);

  const hasPhoto = !!src && !imageError;
  // Mode file : l'<img> n'est rendue qu'une fois un slot accorde pour la
  // tentative en cours -- c'est CE demontage/remontage (pas une modif de
  // `src`) qui declenche une nouvelle tentative reseau identique (O2/O5).
  const canRenderImg = hasPhoto && (!queued || queuedImage.ready);
  const showImage = hasPhoto && imageLoaded;
  const resolvedAlt = alt ?? (name ? `Photo de ${name}` : 'Photo de profil');

  function handleLoad(): void {
    if (queued) queuedImage.handleLoad();
    setImageLoaded(true);
  }

  function handleError(): void {
    if (queued) {
      const exhausted = queuedImage.handleError();
      if (!exhausted) return; // nouvelle tentative programmee -- pas de repli definitif.
    }
    setImageError(true);
  }

  // Les initiales sont TOUJOURS la couche de base (position statique) --
  // `position: relative` sur le conteneur permet a l'`<img>` de se superposer
  // par-dessus en position absolue. Voir le commentaire d'en-tete (C4.1).
  const rootStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    width: SIZE_VAR[size],
    height: SIZE_VAR[size],
    borderRadius: '50%',
    overflow: 'hidden',
    background: 'var(--mx-accent-lt)',
    color: 'var(--mx-accent)',
    fontFamily: 'var(--mx-font-ui)',
    fontWeight: 700,
    fontSize: FONT_SIZE_VAR[size],
    lineHeight: 1,
    userSelect: 'none',
    ...style,
  };

  return (
    <span
      ref={containerRef}
      className={className}
      // Role/aria-label portes par CE span SEULEMENT tant que la photo n'est
      // pas affichee (initiales = contenu accessible) -- une fois `showImage`
      // vrai, la vraie `<img alt=...>`, ci-dessous, porte seule le role/nom
      // accessible "img" (`aria-hidden` l'exclut de l'arbre jusque-la, pour
      // ne jamais exposer DEUX elements "img" du meme nom en meme temps).
      role={showImage ? undefined : 'img'}
      aria-label={showImage ? undefined : resolvedAlt}
      style={rootStyle}
    >
      {initialsOf(name)}
      {/*
        Toujours rendue EN BLOC (jamais `display:none`) des que `src` existe
        et n'a pas encore echoue -- superposee aux initiales (absolue,
        opacite 0 -> 1 sur `onLoad`), PAS masquee : une image `display:none`
        n'entre jamais dans le viewport et ne charge donc jamais avec
        `loading="lazy"` (regression C4.1, voir le commentaire d'en-tete).

        Mode `queued` (LOT PHOTOS-OPTIM) : `canRenderImg` ajoute la
        condition "slot de file accorde" -- l'absence d'`<img>` avant cela
        ne change rien au repli visuel (les initiales sont deja la couche de
        base), elle empeche seulement le navigateur de demarrer la requete
        reseau avant que la file l'autorise.
      */}
      {canRenderImg ? (
        <img
          src={src ?? undefined}
          alt={resolvedAlt}
          aria-hidden={showImage ? undefined : true}
          loading="lazy"
          decoding={queued ? 'async' : undefined}
          fetchPriority={queued ? queuedImage.priority : undefined}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: showImage ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}
        />
      ) : null}
    </span>
  );
}

export default MxAvatar;
