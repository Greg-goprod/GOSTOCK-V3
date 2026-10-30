import { Fragment, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';

import { MxAvatar, type MxAvatarSize } from './MxAvatar';
import { MxMenu } from './MxMenu';

/**
 * MxEntityCard -- LOT VUES-CARTES-LISTE, V1 (Greg, 2026-10-16). Carte
 * d'entite UNIQUE du tronc, tiree de `ContractCardMx` (LOT CONTRATS B2,
 * C1.1) -- doctrine de Greg : « toute page de liste d'entites propose
 * cartes (par defaut) et liste, avec MxEntityCard et MxTable ». Premiers
 * consommateurs : `ContractCardMx` (refactore en fine couche au-dessus de
 * cette primitive, memes DOM/tests qu'avant -- voir son commentaire de
 * tete) et `OfferCardMx` (nouveau, vue cartes des Offres).
 *
 * STRUCTURE (ordre fixe, chaque bloc optionnel sauf avatar/titre) : avatar,
 * titre, UNE ligne d'informations separee par « · » (consigne explicite de
 * Greg -- `ContractCardMx` affichait ces memes informations sur 3 lignes
 * empilees, toujours reservees meme vides ; ce lot les reunit sur une seule
 * ligne, CHAQUE partie restant toujours rendue -- y compris vide, via un
 * contenu nbsp fourni par l'appelant -- pour qu'une carte sans certaines
 * informations garde la MEME structure DOM qu'une carte complete), pastille
 * de statut, barre d'etapes (role="img", meme convention que l'indicateur a
 * N segments de `ContractCardMx`), puis une echeance.
 *
 * DOCTRINE DES CARTES (LOT OFFRES-CYCLE, C1.4, Greg, 2026-10-17) — REMPLACE
 * la regle du 16/10 (« menu « ... » a gauche, action principale a droite » en
 * pied de carte) : AUCUN BOUTON sur une carte. Toutes les actions vivent
 * dans UN SEUL menu « ... » (`menuActions`), EN HAUT A DROITE de la carte --
 * meme emplacement et meme patron que le menu des cartes d'artiste
 * (`RowActionsMenu`/`ArtistCard`, `ArtistesListMx.tsx` : bouton brut,
 * `triggerProps` etales, icone `MoreVertical`). Les tons (succes/danger) de
 * chaque action sont ceux de sa definition UNIQUE (ex. `OfferMxRowActionsBar`
 * pour les offres), transmis tels quels a `MxMenuAction.tone` -- memes tons
 * que les boutons de liste et le pied de drawer, jamais redefinis ici.
 * L'ancien `footer` (gen. `MxEntityActionFooter`, pied de carte) est
 * SUPPRIME de ce modele : les listes et le pied de drawer gardent leurs
 * boutons/`MxEntityActionFooter`, inchanges -- seule la CARTE n'en affiche
 * plus aucun.
 *
 * `due` est TOUJOURS rendu (meme absent/vide) : la ligne d'echeance reserve
 * sa hauteur inconditionnellement, pour que toutes les cartes d'une grille
 * partagent la MEME hauteur, qu'une offre ait une echeance affichee ou non
 * (avant ce correctif, `due ? <div>...</div> : null` rendait bien le
 * conteneur des que l'appelant passait un ELEMENT -- meme vide a l'execution,
 * ex. `<OfferDeadlineBadge/>` qui peut rendre `null` -- mais omettait le
 * conteneur LUI-MEME si `due` n'etait pas fourni du tout ; dans les deux cas,
 * un conteneur sans contenu a hauteur 0, d'ou l'ecart de hauteur constate en
 * recette entre cartes avec/sans echeance).
 *
 * RACINE `role="button"` (PAS un `<button>` natif) -- a la difference de
 * l'ancien `ContractCardMx` (toute la carte etait un `<button>`, car elle
 * n'avait aucune action interne) : le menu `MxMenu` rend son DECLENCHEUR en
 * `<button>` natif (`renderTrigger`), et le HTML interdit d'imbriquer un
 * `<button>` dans un `<button>`. Meme patron que `ArtistCard`
 * (`ArtistesListMx.tsx`) -- `role="button"` + `tabIndex={0}` + `onKeyDown`
 * Entree/Espace. `getByRole('button', ...)` matche les deux de la meme
 * facon (mapping ARIA), donc AUCUNE regression pour les tests existants de
 * `ContractCardMx` qui ciblaient le `<button>` natif.
 *
 * Le menu n'ouvre PAS la carte au clic : le declencheur arrete lui-meme la
 * propagation (`e.stopPropagation()` avant `triggerProps.onClick()`, meme
 * patron qu'`ArtistCard`), et le panneau du menu (rendu via `MxPortal`)
 * arrete deja la sienne cote `MxMenu` (son propre `onClick` sur le
 * conteneur `role="menu"` — necessaire car un portail reste un DESCENDANT
 * REACT du declencheur malgre son attache DOM a `document.body`, voir le
 * commentaire de tete de `MxMenu.tsx`, correctif C2.1).
 */
export interface MxEntityCardInfoPart {
  /** Contenu de cette partie -- fournir un nbsp (`'\u00A0'`) pour une partie absente plutot que l'omettre, afin que la ligne garde la meme structure d'une carte a l'autre. */
  content: ReactNode;
  /** Hook de test optionnel sur CETTE partie precise (ex. `contract-card-agency`). */
  testId?: string;
}

export interface MxEntityCardSteps {
  /** Nombre total de segments. */
  total: number;
  /** Index (0-based) du dernier segment rempli -- segments `<= currentIndex` dans `toneLine`, les suivants en `--mx-border`. */
  currentIndex: number;
  /** Couleur des segments remplis ET du filet superieur de la carte (ex. `MX_TONE_LINE[tone]`). */
  toneLine: string;
  /** Nom accessible du groupe (ex. "Étape 2 sur 6 : À réviser") -- seule source d'info pour un lecteur d'ecran, les segments eux-memes sont `aria-hidden`. */
  ariaLabel: string;
}

/** Action du menu « ... » de la carte -- LOT OFFRES-CYCLE, C1.4 (Greg, 2026-10-17). */
export interface MxEntityCardMenuAction {
  /** Cle React ET identifiant. */
  id: string;
  label: ReactNode;
  /** Icone Lucide OPTIONNELLE -- le COMPOSANT, jamais un element deja instancie. */
  icon?: LucideIcon;
  onSelect: () => void;
  /** Action retiree du menu (jamais affichee desactivee) -- meme convention que `MxEntityActionFooter.overflow`. */
  disabled?: boolean;
  /** Ton -- transmis tel quel a `MxMenuAction.tone` (definition unique de l'entite, ex. `OfferMxRowActionsBar`). */
  tone?: 'success' | 'danger';
}

export interface MxEntityCardProps {
  avatarSrc?: string | null;
  avatarName: string;
  avatarSize?: MxAvatarSize;
  /** Titre affiche en majuscules (CSS) -- `title` HTML pose avec la valeur BRUTE (non transformee) pour l'infobulle au survol. */
  title: string;
  /** Ligne d'informations -- voir `MxEntityCardInfoPart`. Absente -> aucune ligne rendue. */
  infoParts?: MxEntityCardInfoPart[];
  statusBadge?: ReactNode;
  steps?: MxEntityCardSteps;
  /** Échéance -- emplacement TOUJOURS réservé (même hauteur que `due` soit fourni ou non, voir le commentaire de tête). */
  due?: ReactNode;
  /** Actions de la carte -- menu « ... » UNIQUE en haut à droite, AUCUN bouton sur la carte (voir le commentaire de tête). Absent/vide : pas de menu rendu. */
  menuActions?: MxEntityCardMenuAction[];
  /** aria-label du menu ET de son déclencheur -- requis dès que `menuActions` est non vide (ex. "Actions pour {name}"). */
  menuLabel?: string;
  onOpen: () => void;
}

const ELLIPSIS: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
};

/** `.dd-item` du menu de carte -- meme style que `ROW_MENU_TRIGGER_STYLE` (`ArtistesListMx.tsx`), seul declencheur « ... » du tronc a ce jour. */
const MENU_TRIGGER_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'var(--mx-iconbtn-size)',
  height: 'var(--mx-iconbtn-size)',
  borderRadius: 'var(--mx-radius-6)',
  border: 'none',
  background: 'transparent',
  color: 'var(--mx-text3)',
  cursor: 'pointer',
};

export function MxEntityCard({
  avatarSrc,
  avatarName,
  avatarSize = 'lg',
  title,
  infoParts = [],
  statusBadge,
  steps,
  due,
  menuActions = [],
  menuLabel,
  onOpen,
}: MxEntityCardProps) {
  const autoId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleMenuActions = menuActions.filter((a) => !a.disabled);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      data-mx-focus=""
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--mx-space-8)',
        padding: 'var(--mx-space-12)',
        background: 'var(--mx-surface2)',
        // LONGHANDS (pas le raccourci `border`) : le haut porte un trait DISTINCT
        // (3px, ton de l'etape, FIXE) des 3 autres cotes (1px, --mx-border),
        // meme convention que l'ancien ContractCardMx.
        borderLeft: 'var(--mx-border-w) solid var(--mx-border)',
        borderRight: 'var(--mx-border-w) solid var(--mx-border)',
        borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
        borderTop: steps ? `3px solid ${steps.toneLine}` : 'var(--mx-border-w) solid var(--mx-border)',
        borderRadius: 'var(--mx-radius-8)',
        cursor: 'pointer',
        textAlign: 'center',
        width: '100%',
        // LOT VUES-CARTES-LISTE, C1.1 (Greg, 2026-10-16) — RÉGRESSION : en
        // tant qu'ENFANT DE GRILLE (`MxCardGrid` injecte cette racine
        // directement, sans `<div>` intermediaire — voir son commentaire de
        // tete), le `min-width` par defaut d'un item de grille est `auto`
        // (= la taille min-content de son contenu), PAS `0` — meme piege que
        // pour un enfant flex. Une carte dont le contenu (texte, pied
        // d'actions) refuse de descendre sous sa largeur naturelle peut donc
        // deborder de sa piste `minmax(0, 1fr)`, meme si celle-ci est
        // strictement bornee cote grille — d'ou le defilement horizontal
        // constate par Greg. `minWidth: 0` annule ce defaut et rend la carte
        // reellement compressible a la largeur de sa piste.
        minWidth: 0,
      }}
    >
      {visibleMenuActions.length > 0 ? (
        <div style={{ position: 'absolute', top: 'var(--mx-space-8)', right: 'var(--mx-space-8)' }}>
          <MxMenu
            id={`mx-entity-card-menu-${autoId}`}
            label={menuLabel ?? ''}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            groups={[]}
            actions={visibleMenuActions.map((a) => ({
              id: a.id,
              label: a.label,
              icon: a.icon,
              onSelect: a.onSelect,
              tone: a.tone,
            }))}
            renderTrigger={(triggerProps) => (
              <button
                type="button"
                {...triggerProps}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerProps.onClick();
                }}
                aria-label={menuLabel}
                style={MENU_TRIGGER_STYLE}
                data-mx-focus=""
              >
                <MoreVertical style={{ width: 16, height: 16 }} aria-hidden="true" />
              </button>
            )}
          />
        </div>
      ) : null}

      <MxAvatar src={avatarSrc} name={avatarName} size={avatarSize} />

      <span
        title={title}
        style={{
          font: '700 11px/1.3 var(--mx-font-ui)',
          color: 'var(--mx-text)',
          textTransform: 'uppercase',
          ...ELLIPSIS,
        }}
      >
        {title}
      </span>

      {infoParts.length > 0 ? (
        <span
          style={{
            font: '500 10px/1.2 var(--mx-font-ui)',
            color: 'var(--mx-text2)',
            ...ELLIPSIS,
          }}
        >
          {infoParts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 ? <span aria-hidden="true"> · </span> : null}
              <span data-testid={part.testId}>{part.content}</span>
            </Fragment>
          ))}
        </span>
      ) : null}

      {statusBadge ? (
        // LOT OFFRES-VUES, V2 (Greg, 2026-10-18) : `gap` ajoute pour
        // accueillir PLUSIEURS badges cote a cote (offre expiree :
        // "Envoyée" + "Expirée", voir `OfferCardMx.tsx`) -- sans effet sur
        // les appelants a un seul badge (un `gap` flex n'a aucun impact des
        // qu'il n'y a qu'un seul enfant).
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--mx-space-4)' }}>
          {statusBadge}
        </div>
      ) : null}

      {/* TOUJOURS rendu, meme sans `due`/contenu -- voir le commentaire de
          tete (hauteur constante entre cartes d'une meme grille). Hauteur
          calee sur le contenu habituel d'`OfferDeadlineBadge` (icone 14px +
          texte 12px). */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          minHeight: 'calc(16px * var(--mx-scale, 1))',
        }}
      >
        {due}
      </div>

      {steps ? (
        <div
          role="img"
          aria-label={steps.ariaLabel}
          style={{ display: 'flex', gap: 'var(--mx-space-4)', width: '100%' }}
        >
          {Array.from({ length: steps.total }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                flex: 1,
                height: 'calc(4px * var(--mx-scale, 1))',
                borderRadius: 'var(--mx-radius-pill)',
                background: i <= steps.currentIndex ? steps.toneLine : 'var(--mx-border)',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default MxEntityCard;
