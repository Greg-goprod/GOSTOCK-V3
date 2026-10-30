import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, FileX, Loader2 } from 'lucide-react';

import { MX_TEXT, MX_TONE_TEXT } from './tokens';
import { mxIconBox } from './internal/mxIcon';

/**
 * MxDocPreview — LOT CONTRATS B2 (2026-10-02). Aperçu de document (PDF)
 * intégré au CORPS d'un panneau (drawer/section), par opposition à une
 * modale séparée (`InvoicePdfViewer`, `PaymentProofViewer`, le `Modal` PDF de
 * `SettlementDrawerMx`).
 *
 * NOUVELLE PRIMITIVE DE TRONC, PAS UNE EXTENSION DE `MxPreview` : ce dernier
 * nom appartient déjà à `src/components/mx/__demo__/MxPreview.tsx`, une démo
 * jetable de vitrine des primitives (« À SUPPRIMER après revue visuelle »),
 * sans aucun rapport avec l'aperçu de document — aucun mécanisme à étendre
 * n'existait avant ce lot. Voir le rapport B2.0 (LOT CONTRATS) pour le détail
 * de cette correction.
 *
 * MODÈLE REPRIS, AVEC UN ÉCART ASSUMÉ : `TabFichiers.tsx`
 * (`pages/app/administration/finance-v2/tabs/`), le seul embryon de pattern
 * « PDF dans le corps d'un panneau » trouvé dans le projet — bandeau
 * (libellé + Télécharger + Ouvrir) au-dessus d'une `<iframe>`, état de
 * chargement. L'ÉCART : ce modèle n'a AUCUN état d'erreur explicite (un échec
 * de résolution d'URL signée n'y affiche rien) — corrigé ici par la prop
 * `error`.
 *
 * Aucun libellé en dur : tout le texte arrive par props (i18n à la charge de
 * l'appelant). Icônes exclusivement lucide-react. Zéro CSS, uniquement
 * `var(--mx-*)`.
 *
 * PROP `fill` — LOT CONTRATS B2, C3.2 (2026-10-02) : le drawer Contrat doit
 * donner « toute la hauteur disponible du corps » à son document (au moins
 * ~70% de la hauteur visible), avec défilement INTERNE à l'aperçu plutôt que
 * le corps entier du drawer qui défile. `fill` étire le conteneur sur l'axe
 * flex du PARENT (`flex:1; minHeight:0`) au lieu de la hauteur fixe
 * `--mx-docpreview-h` — nécessite un ancêtre flex-column borné en hauteur,
 * ce qu'est déjà le corps de `MxDrawer` (`flex:1; minHeight:0;
 * overflowY:auto`). Le minimum « ~70% » est à la charge de l'APPELANT (sur
 * son propre conteneur, via `style`/`minHeight`) : cette primitive ne connaît
 * pas la hauteur du drawer qui l'héberge.
 *
 * MODE PLEINE HAUTEUR — LOT CONTRATS B2, C4.4 (2026-10-02), DOCTRINE DRAWER
 * (decision Greg) : « aperçu PDF en pleine hauteur de son onglet, avec la
 * barre d'outils NATIVE [du navigateur] et son propre défilement ». Deux
 * consequences sur l'API, par rapport a C3.2 :
 * 1. AUCUN parametre `#toolbar=0`/equivalent n'est jamais ajoute a `url` —
 *    la barre d'outils du lecteur PDF integre au navigateur (telecharger,
 *    imprimer, zoomer...) reste donc TOUJOURS visible, sans que cette
 *    primitive n'ait besoin de la reproduire elle-meme.
 * 2. `onDownload`/`onOpenExternal` (C3.2, actions FIGEES a exactement deux
 *    boutons) sont REMPLACES par `actions?: ReactNode` — « actions passées
 *    par l'appelant », litteral de C4.4 : l'appelant compose lui-meme ses
 *    boutons (Telecharger/Ouvrir/Remplacer... autant qu'il en a besoin,
 *    typiquement des `MxIconButton`), cette primitive ne connait plus leur
 *    nombre ni leur nature. Seul consommateur a ce jour (`ContractDrawerMx`),
 *    migre dans le meme lot — aucune retrocompatibilite a preserver.
 * `headerContent?: ReactNode` complete le meme assouplissement : permet a
 * l'appelant de substituer un contenu INTERACTIF (ex. le sélecteur compact
 * de version de l'onglet Document, C4.5) a la simple etiquette `label` dans
 * la zone de GAUCHE du bandeau — `label` reste TOUJOURS requis, consomme par
 * le `title` de l'iframe (nom accessible du document), que `headerContent`
 * soit fourni ou non.
 */
export interface MxDocPreviewProps {
  /** URL signée du document à afficher dans l'iframe. `null` : aucun document pour cette version. */
  url: string | null;
  /** Résolution de l'URL signée en cours. */
  loading: boolean;
  /** Message d'erreur à afficher (prioritaire sur `url`/`loading`). `null`/absent : pas d'erreur. */
  error?: string | null;
  /** Message affiché quand `url` est `null`, `loading` est faux et `error` est absent. */
  emptyLabel: string;
  /** Nom du document affiché (ex. « Original »). Sert de `title` à l'iframe (nom accessible), TOUJOURS — que `headerContent` soit fourni ou non. */
  label: string;
  /** Contenu de la zone GAUCHE du bandeau, a la place du simple texte `label` — ex. le sélecteur compact de version (C4.5). Absent : `label` est rendu en texte brut (comportement C3.2 inchangé). */
  headerContent?: ReactNode;
  /** Zone d'actions (DROITE du bandeau) — composée par l'appelant (ex. `MxIconButton` Télécharger/Ouvrir/Remplacer). Absente par défaut. */
  actions?: ReactNode;
  /** Etire l'apercu sur la hauteur disponible du conteneur flex parent, avec
   *  defilement interne, au lieu de la hauteur fixe `--mx-docpreview-h`.
   *  Defaut `false` (usage autonome, hauteur fixe). Voir l'en-tete du
   *  fichier (LOT CONTRATS B2, C3.2). */
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}

function CenteredState({ role, children }: { role?: 'status' | 'alert'; children: React.ReactNode }) {
  return (
    <div
      role={role}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--mx-space-8)',
        // 100% du conteneur dedie (le <div> ajoute ci-dessous) : fixe (repli
        // `--mx-docpreview-h`) ou etire (`fill`), la hauteur est desormais
        // decidee UNE SEULE FOIS par ce conteneur, jamais ici.
        height: '100%',
        textAlign: 'center',
        padding: 'var(--mx-space-16)',
      }}
    >
      {children}
    </div>
  );
}

export function MxDocPreview({
  url,
  loading,
  error,
  emptyLabel,
  label,
  headerContent,
  actions,
  fill = false,
  className,
  style,
}: MxDocPreviewProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--mx-radius-8)',
        border: 'var(--mx-border-w) solid var(--mx-border)',
        overflow: 'hidden',
        // `fill` : le conteneur ENTIER (bandeau + zone de document) occupe la
        // hauteur disponible du parent flex, bornee ailleurs (le corps de
        // MxDrawer) — sans minHeight:0 ici, un enfant flex ne peut jamais
        // devenir plus PETIT que son contenu, ce qui empecherait le
        // defilement interne demande.
        ...(fill ? { flex: 1, minHeight: 0 } : null),
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mx-space-8)',
          padding: 'var(--mx-space-8) var(--mx-space-12)',
          background: 'var(--mx-surface2)',
          borderBottom: 'var(--mx-border-w) solid var(--mx-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {headerContent ?? (
            <span style={{ ...MX_TEXT.help, color: 'var(--mx-text2)' }}>{label}</span>
          )}
        </div>
        {actions ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mx-space-4)', flexShrink: 0 }}>
            {actions}
          </div>
        ) : null}
      </div>

      {/* Zone de document : SEUL conteneur qui porte une hauteur — fixe
          (repli `--mx-docpreview-h`) ou etiree + defilement interne
          (`fill`), jamais les deux a la fois, jamais sur l'iframe/l'etat
          centre directement (voir CenteredState ci-dessus). */}
      <div
        style={
          fill
            ? { flex: 1, minHeight: 0, overflow: 'auto' }
            : { height: 'var(--mx-docpreview-h)', overflow: 'hidden' }
        }
      >
        {error ? (
          <CenteredState role="alert">
            <AlertTriangle style={mxIconBox('xl')} aria-hidden="true" color={MX_TONE_TEXT.danger} />
            <span style={{ ...MX_TEXT.body, color: 'var(--mx-text2)' }}>{error}</span>
          </CenteredState>
        ) : loading ? (
          <CenteredState role="status">
            <Loader2 style={mxIconBox('xl')} aria-hidden="true" className="animate-spin" />
          </CenteredState>
        ) : url ? (
          <iframe
            src={url}
            title={label}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#fff',
            }}
          />
        ) : (
          <CenteredState>
            <FileX style={mxIconBox('xl')} aria-hidden="true" color="var(--mx-text3)" />
            <span style={{ ...MX_TEXT.body, color: 'var(--mx-text3)' }}>{emptyLabel}</span>
          </CenteredState>
        )}
      </div>
    </div>
  );
}

export default MxDocPreview;
