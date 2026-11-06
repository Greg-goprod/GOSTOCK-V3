// ============================================================================
// SOCLE INTERNE DU TRONC — tons et presets typographiques
// ----------------------------------------------------------------------------
// Aucun composant ici : uniquement les tables que les primitives indexent, pour
// qu'un ton ou un niveau de texte ait UNE seule definition dans tout le tronc.
//
// Invariants du lot :
// - zero valeur en dur : tout passe par var(--mx-*) (tokens-mx.css) ;
// - zero fichier .css : la presentation est portee par ces objets de style ;
// - LONGHANDS typographiques (fontWeight / fontSize / lineHeight / fontFamily)
//   plutot que le raccourci `font:`. Deux raisons : le raccourci REINITIALISE
//   les sous-proprietes non citees — dont font-variant-numeric, ce qui casse
//   silencieusement les colonnes de chiffres — et il rend toute la declaration
//   invalide si une seule substitution var() echoue.
// ============================================================================

import type { CSSProperties } from 'react';

/**
 * CRANS D'EMPILEMENT.
 *
 * Miroir en TSX de l'echelle --mx-z-* de tokens-mx.css. L'ORDRE, les valeurs et
 * les deux ecarts assumes au handoff (modale au-dessus du drawer, info-bulle au
 * sommet) sont documentes la-bas : c'est la seule source de verite, ne pas
 * dupliquer l'argumentaire ici.
 *
 * `alertScrim`/`alert` (LOT MODALE B, 2026-10-02) : couche TRANSITOIRE
 * reservee a MxConfirmDialog, au-dessus des modales AURA relevees a la main.
 * MxModal reste sur `modal`/`modalScrim`. Voir le commentaire de
 * --mx-z-alert(-scrim) dans tokens-mx.css pour le motif complet.
 *
 * POURQUOI UN OBJET, et pas une chaine ecrite a chaque usage. Le cast est
 * inevitable — csstype type `zIndex` en `number` alors que la valeur est une
 * chaine `var(...)` — et il est SUR : le CSSOM accepte une substitution var()
 * dans n'importe quelle propriete, y compris z-index (verifie en navigateur :
 * `el.style.zIndex = 'var(--mx-z-drawer)'` se resout bien a 301). Le regrouper
 * ici garantit que ce cast n'existe qu'a UN endroit, quel que soit le nombre de
 * primitives qui empilent — MxModal, MxPopover, MxToast et MxTooltip suivront.
 *
 * `--mx-z-base` et `--mx-z-raised` sont absents : ce sont des valeurs numeriques
 * simples, sans cast, et le chevauchement local se calcule a l'appel (une pile
 * de N avatars ne s'exprime pas en token).
 */
export type MxZLayer =
  | 'chrome'
  | 'drawerScrim'
  | 'drawer'
  | 'modalScrim'
  | 'modal'
  | 'popover'
  | 'toast'
  | 'tooltip'
  | 'alertScrim'
  | 'alert';

export const MX_Z = {
  // `sticky` SUPPRIME -- LOT PAGE-HEADER, Phase B, B4 (2026-10-17). Voir
  // docs/REGISTRE_RETRAITS.md, entree 21.
  chrome: 'var(--mx-z-chrome)',
  drawerScrim: 'var(--mx-z-drawer-scrim)',
  drawer: 'var(--mx-z-drawer)',
  modalScrim: 'var(--mx-z-modal-scrim)',
  modal: 'var(--mx-z-modal)',
  /** Tout flottant ANCRE a un champ : menu, select, autocompletion, popover, popup de picker. */
  popover: 'var(--mx-z-popover)',
  toast: 'var(--mx-z-toast)',
  tooltip: 'var(--mx-z-tooltip)',
  /** Reserve a MxConfirmDialog — voir le commentaire de MxZLayer ci-dessus. */
  alertScrim: 'var(--mx-z-alert-scrim)',
  alert: 'var(--mx-z-alert)',
} as Record<MxZLayer, CSSProperties['zIndex']>;

/** Les 6 tons du handoff. Toute primitive tonee indexe ce type, jamais une couleur. */
export type MxTone = 'warning' | 'danger' | 'success' | 'info' | 'accent' | 'neutral';

interface MxToneFill {
  /** Fond SATURE : la couleur pure du ton. */
  bg: string;
  /** Texte de contraste pose SUR `bg`. */
  fg: string;
}

/**
 * APLAT PLEIN — bandeau de statut, badge, pastille.
 * Le fond est la couleur PURE du ton, le texte un contraste. Il n'existe pas de
 * variante delavee.
 * Une divergence avec la table TONE du prototype : celle-ci pose un `#fff`
 * litteral sur danger / success / info / accent, illisible en dark. Le contraste
 * est declare PAR TON dans tokens-mx.css, et suit le theme.
 */
export const MX_TONE_FILL: Record<MxTone, MxToneFill> = {
  warning: { bg: 'var(--mx-tone-fill-warning)', fg: 'var(--mx-tone-on-warning)' },
  danger: { bg: 'var(--mx-tone-fill-danger)', fg: 'var(--mx-tone-on-danger)' },
  success: { bg: 'var(--mx-tone-fill-success)', fg: 'var(--mx-tone-on-success)' },
  info: { bg: 'var(--mx-tone-fill-info)', fg: 'var(--mx-tone-on-info)' },
  accent: { bg: 'var(--mx-tone-fill-accent)', fg: 'var(--mx-tone-on-accent)' },
  neutral: { bg: 'var(--mx-tone-fill-neutral)', fg: 'var(--mx-tone-on-neutral)' },
};

/**
 * TEXTE NU — la couleur pure du ton, portee par du texte ou une icone, sans
 * fond ni filet. C'est la forme des messages d'etat.
 */
export const MX_TONE_TEXT: Record<MxTone, string> = {
  warning: 'var(--mx-tone-text-warning)',
  danger: 'var(--mx-tone-text-danger)',
  success: 'var(--mx-tone-text-success)',
  info: 'var(--mx-tone-text-info)',
  accent: 'var(--mx-tone-text-accent)',
  neutral: 'var(--mx-tone-text-neutral)',
};

/**
 * FILET DE 3px d'une section accentuee. Identique au texte nu, sauf pour
 * neutral dont le filet est une bordure et non une couleur de statut.
 */
export const MX_TONE_LINE: Record<MxTone, string> = {
  ...MX_TONE_TEXT,
  neutral: 'var(--mx-tone-line-neutral)',
};

/**
 * PASTILLE DE TON — petit disque plein (couleur pure, pas d'aplat/fond), pose
 * devant un libelle pour signaler son ton sans dupliquer un badge entier.
 * LOT CONTRATS B2, C5.2 (2026-10-03) : premier besoin, `MxSegmented`
 * (bandeau de parcours) ; meme fonction reprise pour les pastilles de
 * `ContratsListMx` (C5.4) — un seul point de definition pour les deux.
 * 6px de diametre : plus petit que `--mx-space-8`, jamais mis a l'echelle du
 * texte qu'il accompagne (comme un filet, cf. MX_TONE_LINE), mais suit bien
 * `--mx-scale` comme toute dimension de composant (contrairement a un trait).
 */
export function mxToneDot(tone: MxTone): CSSProperties {
  return {
    display: 'inline-block',
    flexShrink: 0,
    width: 'calc(6px * var(--mx-scale, 1))',
    height: 'calc(6px * var(--mx-scale, 1))',
    borderRadius: '50%',
    background: MX_TONE_TEXT[tone],
  };
}

/** Mode de lecture/edition porte par chaque bloc (jamais deux compositions dupliquees). */
export type MxMode = 'read' | 'edit';

const UI = 'var(--mx-font-ui)';

/**
 * Niveaux de texte. Les poids et le tracking ne sont pas tokenises (decision du
 * lot fondations) : ils sont donc litteraux ici, et ici SEULEMENT.
 *
 * ============================================================================
 * ECART TYPOGRAPHIQUE ASSUME — DECISION DE GREG DU 2026-09-23, DEFINITIVE.
 * ----------------------------------------------------------------------------
 * L'echelle du tronc prime sur celle du handoff. Motif : la densite des ecrans
 * reels — un decompte final tient plusieurs dizaines de valeurs a l'ecran, et
 * le 13.5/600-700 du handoff, dessine sur des maquettes peu chargees, y devient
 * trop lourd. Les presets concernes le rappellent individuellement.
 *
 * LA DECISION A UN SENS, ELLE N'EST PAS SYMETRIQUE :
 *   handoff PLUS GROS ou PLUS GRAS que le tronc  -> le TRONC s'applique
 *   handoff PLUS PETIT ou PLUS LEGER que le tronc -> le HANDOFF s'applique
 * Elle protege le tronc vers le HAUT, pas vers le bas. Un handoff qui allege
 * n'est pas couvert : la conformite y reprend ses droits (cas reel :
 * `statLabel`, passe de 700 a 600 parce que le handoff est le plus leger des
 * deux).
 *
 * PORTEE : la TAILLE et la GRAISSE du texte, rien d'autre. Tracking,
 * majuscules, chiffres tabulaires, couleurs, interlignes et tout le
 * non-typographique suivent le handoff sans reserve.
 * ============================================================================
 */
export const MX_TEXT = {
  /** Label de section : 11px / 700 / 0.08em / majuscules. */
  sectionLabel: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-section-label)',
    lineHeight: 1,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  /** Titre de drawer : 26px / 700 / tracking serre. */
  drawerTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-section)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  /** Titre de bloc : 16px / 700. */
  blockTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-block)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  /** Valeur focale : 29px / 700 / chiffres tabulaires. */
  focal: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-focal)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  /** Label de champ et de ligne cle/valeur : 12.5px / 500. */
  fieldLabel: {
    fontFamily: UI,
    fontWeight: 500,
    fontSize: 'var(--mx-fs-field-label)',
    lineHeight: 1.4,
  },
  /** Label de champ appuye : 12.5px / 600. */
  fieldLabelStrong: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-field-label)',
    lineHeight: 1.4,
  },
  /** Valeur de ligne cle/valeur : 12.5px / 600. */
  kvValue: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-meta)',
    lineHeight: 1.4,
  },
  /**
   * Titre d'item de liste : 12.5px / 700.
   *
   * VALEUR COMPOSITE, ASSUMEE — arbitrage de Greg du 2026-09-23. Taille du
   * tronc (12.5px, decision typographique) mais GRAISSE DU HANDOFF (700, la ou
   * `.mx-dr-list-item .t` demande 13px/700). Motif : la decision porte sur la
   * taille du texte, pas sur la disparition de toute hierarchie interne. Avec
   * le titre laisse en 500, il devenait indiscernable de son propre sous-titre
   * (`help`, 11.5px/500), que seule la couleur distinguait encore.
   * Ne pas ramener a 500 « pour coherence avec meta » : c'est le contraste qui
   * est voulu.
   */
  itemTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-meta)',
    lineHeight: 1.3,
  },
  /**
   * Meta : 12.5px / 500.
   *
   * ECART TYPOGRAPHIQUE ASSUME — DECISION DE GREG DU 2026-09-23, DEFINITIVE.
   * `reference/mannyx-drawer.js` demande 13.5px/600 pour le texte d'un champ,
   * 13px/700 pour un titre d'item de liste, 12.5px/600 pour une meta. Le tronc
   * garde 12.5px/500 partout : le handoff est juge trop gros et trop gras pour
   * la densite des ecrans reels. Ni la TAILLE ni la GRAISSE ne doivent etre
   * remontees vers le handoff. Ce n'est pas un defaut a corriger.
   *
   * Ce que la decision NE couvre PAS et qui reste a corriger sur ce preset :
   * le tracking de 0.04em et les chiffres tabulaires que le handoff pose sur la
   * meta. Ce sont des reglages de lisibilite, pas des choix de taille.
   */
  meta: {
    fontFamily: UI,
    fontWeight: 500,
    fontSize: 'var(--mx-fs-meta)',
    lineHeight: 1.3,
  },
  /** Texte d'aide et sous-titre d'item : 11.5px / 500. */
  help: {
    fontFamily: UI,
    fontWeight: 500,
    fontSize: 'var(--mx-fs-help)',
    lineHeight: 1.55,
  },
  /** Corps : 13.5px / 500. */
  body: {
    fontFamily: UI,
    fontWeight: 500,
    fontSize: 'var(--mx-fs-body)',
    lineHeight: 1.5,
  },
  /** Titre de callout : 11.5px / 700. */
  noteTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-help)',
    lineHeight: 1.3,
  },
  /**
   * Badge et pastille : 10.5px / 700 / 0.04em.
   * PAS de text-transform, contrairement au label de section : le handoff passe
   * des libelles deja capitalises (« A CONFIRMER », « AGENT ») et forcer la
   * bascule empecherait un libelle volontairement en casse mixte.
   */
  badge: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-badge)',
    lineHeight: 1,
    letterSpacing: '0.04em',
  },
  /** Libelle de bandeau de statut : 11px / 700 / 0.1em / majuscules. */
  band: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-band)',
    lineHeight: 1,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  /**
   * Libelle de bascule segmentee (MxSegmented) : 12px / 700 / 0.02em /
   * majuscules. `--mx-fs-kv-key` correspond EXACTEMENT au `12px` du catalogue
   * (`.vt button{font-size:12px;font-weight:700}`, aucun arrondi necessaire) —
   * voir l'en-tete de MxSegmented.tsx pour la source complete.
   *
   * EXTRAIT ICI — LOT CONTRATS B2, C2.1 (2026-10-02) : jusque-la litteral dans
   * `BUTTON_BASE` de MxSegmented (seul consommateur), au motif qu'aucun preset
   * partage ne portait cette combinaison precise. Un 2e consommateur est
   * apparu (titres de section de `ContratsListMx`, qui doivent reprendre « le
   * MEME token de taille, graisse, majuscules, letterSpacing » que le bandeau
   * de filtres, demande explicite de Greg) : la valeur rejoint donc MX_TEXT,
   * seule definition pour les deux, au lieu d'une 2e recopie litterale.
   */
  segmentedLabel: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-kv-key)',
    lineHeight: 1,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  /**
   * Libelle de bouton : 12.5px / 600.
   *
   * ECART TYPOGRAPHIQUE ASSUME — DECISION DE GREG DU 2026-09-23, DEFINITIVE.
   * `.mx-dr-btn` demande 13.5px/700, et 14px pour l'action principale. Le tronc
   * garde 12.5px/600, et la hauteur de bouton qui va avec. Meme motif que pour
   * `meta` : densite des ecrans reels. Ne pas « corriger » vers le handoff.
   */
  button: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-meta)',
    lineHeight: 1,
  },

  /* ------------------------------------------------------------------------
     NIVEAUX RELEVES SUR `reference/mannyx-drawer.js` (audit du 2026-09-23).
     Ajoutes SANS consommateur : aucune primitive ne les utilise encore, donc
     leur ajout ne deplace aucun pixel. Ils existent pour que les corrections
     suivantes soient un simple echange de preset, et non une reecriture de
     valeurs en dur dans chaque primitive.
     Les presets qui les precedent (`meta`, `button`, `kvValue`) ne sont pas
     doubles ici : ils seront ajustes SUR PLACE dans le lot qui repointe leurs
     appelants, pour ne pas laisser deux presets concurrents.

     ///// NE PAS SUPPRIMER CE BLOC /////

     SUSPENDUS PAR DECISION, PAS ORPHELINS PAR OUBLI. Quatre des presets
     ci-dessous — `inputText`, `buttonCta`, `listTitle`, `toggleLabel` — n'ont
     aujourd'hui AUCUN consommateur, et c'est VOULU : ils ne different du tronc
     que par la taille et la graisse, que la decision du 2026-09-23 a tranchees
     en faveur du tronc. Les consommer annulerait cette decision.

     Un outil de detection de code mort les signalera. Un agent qui « nettoie »
     les signalements les supprimera. C'est precisement ce qu'il ne faut pas
     faire : ce sont des RELEVES FIDELES du handoff, mesures une fois, et ils
     existent pour que Greg puisse rouvrir la discussion de l'echelle avec sa
     directrice artistique sans avoir a tout remesurer. Les supprimer coute un
     travail de mesure ; les garder ne coute rien, ils ne sont pas compiles
     dans un bundle tant que personne ne les importe.

     Les trois autres — `kvKey`, `statLabel`, `statMeta` — seront bien
     consommes : ils portent aussi du tracking, l'absence de majuscules et les
     chiffres tabulaires, qui ne relevent pas de la taille et restent dus. Leur
     taille devra etre alignee sur celle du tronc au moment de les brancher.
     ------------------------------------------------------------------------ */

  /**
   * Texte saisi dans un champ : 13.5px / 600. `.mx-dr-field input`.
   * `normal` et non une valeur chiffree : le handoff ne pose AUCUN interlignage
   * sur un input, et la hauteur du champ en decoule. Mesure a l'appui — 1.4
   * donne 40.89px la ou le handoff rend 40.00px. La zone de texte, elle, porte
   * bien un 1.5 explicite au handoff : ce sera un preset distinct.
   */
  inputText: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-body)',
    lineHeight: 'normal',
  },
  /** Libelle de bouton d'action principale : 14px / 700. `.mx-dr-btn[primary]`. */
  buttonCta: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-cta)',
    lineHeight: 1,
  },
  /** Titre d'item de liste : 13px / 700. `.mx-dr-list-item .t`. */
  listTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-item)',
    lineHeight: 1.3,
  },
  /** Libelle d'une ligne d'interrupteur : 13.5px / 600. `.mx-dr-toggle-row .lbl`. */
  toggleLabel: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-body)',
    lineHeight: 1.4,
  },
  /**
   * Cle d'une ligne cle/valeur : 12px / 600. `.mx-dr-kv-row dt`.
   *
   * SUSPENDU LUI AUSSI, pour la meme raison que les quatre precedents. Une fois
   * la taille et la graisse ramenees aux valeurs du tronc, ce preset devient
   * identique a `fieldLabel` (12.5px / 500) : c'est donc `fieldLabel` que MxKV
   * consomme. Seule la COULEUR de la cle etait fautive (--mx-text2 au lieu de
   * --mx-text3), et elle est corrigee dans MxKV directement.
   */
  kvKey: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-kv-key)',
    lineHeight: 1.4,
  },
  /**
   * Libelle d'une statistique : 11.5px / 500, SANS majuscules ni tracking.
   * `.mx-dr-stat-label`.
   *
   * COMPOSITE, et dans les deux sens.
   *
   * GRAISSE 600 : c'est la valeur du handoff, et elle s'applique telle quelle.
   * La decision du 2026-09-23 protege le tronc d'un handoff PLUS GROS ou PLUS
   * GRAS ; ici le handoff est plus LEGER que le code existant (qui etait a 700
   * via `sectionLabel`). La decision ne joue pas, la conformite reprend.
   *
   * TAILLE 11px : celle du tronc. Le handoff demande 11.5px, soit plus gros —
   * la, la decision joue, meme pour un demi-pixel.
   *
   * Ce qui compte surtout est ce que ce preset N'A PAS : MxStat utilisait
   * `sectionLabel`, qui met le libelle en MAJUSCULES avec 0.08em de tracking.
   * C'etait le mauvais preset — un libelle de statistique n'est pas un titre de
   * section — et c'est ce qui se voit a l'oeil.
   */
  statLabel: {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: 'var(--mx-fs-section-label)',
    lineHeight: 1.3,
  },
  /**
   * Meta sous une statistique : 12.5px / 500 / 0.04em / tabulaire.
   *
   * COMPOSITE. `.mx-dr-stat-meta` demande 12.5px/600 : la taille est deja celle
   * du tronc, la GRAISSE est ramenee a 500 par la decision du 2026-09-23. Ce
   * qui reste du handoff, et qui est la raison d'etre de ce preset, c'est le
   * tracking de 0.04em et les chiffres tabulaires — deux reglages de
   * lisibilite que la decision ne couvre pas. Sans eux, les qualificatifs
   * chiffres sous une valeur focale dansent d'une ligne a l'autre.
   */
  statMeta: {
    fontFamily: UI,
    fontWeight: 500,
    fontSize: 'var(--mx-fs-meta)',
    lineHeight: 1,
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  },

  /* ------------------------------------------------------------------------
     LOT MODALE B3 (2026-10-02) — MxModal/MxConfirmDialog. Source : reference/
     Mannyx Components V2.html, section #s-modals (pas mannyx-drawer.js).
     ------------------------------------------------------------------------ */

  /** Titre d'en-tete de modale generique : 14px / 700. `.modal-header span`. */
  modalTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-modal-title)',
    lineHeight: 1.2,
  },
  /**
   * Titre centre de confirmation : 15px / 700. Distinct de `modalTitle` ci-
   * dessus — MxConfirmDialog ne rend pas l'en-tete de MxModal, voir son en-
   * tete de fichier.
   */
  confirmTitle: {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: 'var(--mx-fs-confirm-title)',
    lineHeight: 1.3,
  },
  /**
   * Message centre de confirmation : 13px / 400. SEUL preset du tronc en
   * graisse 400 — relevee telle quelle, le handoff est ici PLUS LEGER que
   * tout le reste de l'echelle (meme regle directionnelle que `statLabel` :
   * un handoff plus leger n'est jamais remonte vers le tronc).
   */
  confirmMessage: {
    fontFamily: UI,
    fontWeight: 400,
    fontSize: 'var(--mx-fs-confirm-message)',
    lineHeight: 1.5,
  },
} satisfies Record<string, CSSProperties>;

/** Chiffres alignes en colonne. A composer avec un niveau de MX_TEXT. */
export const MX_TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
