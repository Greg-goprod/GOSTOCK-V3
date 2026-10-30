import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, Info, type LucideIcon } from 'lucide-react';

import { useI18n } from '../../lib/i18n';
import { MxModal, type MxModalSize } from './MxModal';
import { MxButton } from './MxButton';
import { MX_TEXT, MX_TONE_FILL, MX_TONE_TEXT } from './tokens';
import { mxIconBox } from './internal/mxIcon';

/**
 * MxConfirmDialog — LOT MODALE B3 (2026-10-02). Construit SUR MxModal
 * (`role="alertdialog"`), couche d'empilement `zLayer="alert"` (voile et
 * panneau au-dessus de toute modale AURA relevee a la main, sous les
 * toasts — voir MX_Z.alert(Scrim) dans tokens.ts).
 *
 * N'UTILISE PAS L'EN-TETE STANDARD DE MxModal (`showHeader={false}`).
 * Le catalogue (#s-modals, « 1 colonne — Confirmation ») montre DEUX titres
 * distincts empiles — un en-tete de chrome court (« Supprimer l'artiste »,
 * 14px) PUIS une question centree complete (« Supprimer Bob Sinclar ? »,
 * 15px) : dupliquer cette structure aurait exige deux props de titre pour
 * une seule information. Simplification deliberee, assumee : UN SEUL
 * `title`, rendu centre dans le corps avec la pastille d'icone et le
 * message, nom accessible porte par `aria-label` (MxModal, showHeader=false).
 *
 * PASTILLE D'ICONE : APLAT PLEIN (MX_TONE_FILL), PAS le fond teinte a 10%
 * du catalogue. Meme ecart assume que MxNote (voir son en-tete) : le projet
 * a abandonne la famille de fonds teintes delaves (tokens-mx.css, « il
 * n'existe AUCUNE famille "douce" de fonds teintes laves ») — un ton se pose
 * en aplat plein ou en texte nu, jamais entre les deux. Introduire un
 * `--mx-tone-fill-lt-<ton>` pour cette seule pastille aurait reintroduit
 * exactement la piste rejetee.
 *
 * FOCUS INITIAL SUR ANNULER (l'action la MOINS destructrice), pas sur le
 * premier champ trouve : passe a MxModal via `initialFocusRef`.
 *
 * MODE ASYNCHRONE (`asyncConfirm`, defaut `true`) : `onConfirm` peut
 * renvoyer une Promise, attendue ici — chargement et erreur geres EN
 * INTERNE, bouton desactive pendant l'attente (pas de double envoi). C'est
 * le mode des NOUVEAUX usages. `asyncConfirm={false}` : semantique
 * HISTORIQUE de `ConfirmDialog` (AURA) — `onConfirm()` puis fermeture
 * IMMEDIATE, sans attendre quoi que ce soit ; `loading`/`confirmDisabled`
 * redeviennent entierement pilotes par le parent, comme avant la bascule
 * (voir mxDialogsFlag.ts / B4). Decision de Greg (LOT MODALE B,
 * 2026-10-02) : la bascule de ConfirmDialog ne doit RIEN changer a sa
 * semantique, seul son habillage visuel change.
 */

export type MxConfirmDialogTone = 'danger' | 'warning' | 'info';

const DEFAULT_ICON: Record<MxConfirmDialogTone, LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

/** Ton -> variante de MxButton de l'action de confirmation. Annuler reste toujours 'ghost'. */
const CONFIRM_BUTTON_VARIANT: Record<MxConfirmDialogTone, 'danger' | 'primary'> = {
  danger: 'danger',
  warning: 'primary',
  info: 'primary',
};

export interface MxConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Peut renvoyer une Promise : attendue si `asyncConfirm` (defaut). Ignoree si `asyncConfirm={false}`. */
  onConfirm: () => void | Promise<void>;
  /** Defaut `'danger'`. */
  tone?: MxConfirmDialogTone;
  /** Defaut via i18n `confirm_dialog.title`. */
  title?: string;
  message: string;
  /** Encart distinct mettant en evidence l'element vise. */
  itemName?: string;
  /** Contenu libre sous le message (ex. case de double validation). */
  extraContent?: ReactNode;
  /** Defaut via i18n `confirm_dialog.confirm`. */
  confirmLabel?: string;
  /** Defaut via i18n `confirm_dialog.cancel`. */
  cancelLabel?: string;
  /** Remplace l'icone par defaut du ton (AlertTriangle danger/warning, Info info). */
  icon?: LucideIcon;
  /**
   * Defaut `true` : attend la Promise de `onConfirm`, gere chargement/erreur
   * en interne. `false` : semantique HISTORIQUE de ConfirmDialog(AURA) — voir
   * l'en-tete de fichier. N'a de sens a `false` que pour cette bascule.
   */
  asyncConfirm?: boolean;
  /** N'a d'effet que si `asyncConfirm={false}` (pilotage externe, comme avant la bascule). */
  loading?: boolean;
  /** Desactive l'action de confirmation, dans les deux modes. */
  confirmDisabled?: boolean;
  /** Defaut `'sm'` (380px, taille de la variante « Confirmation » du catalogue). */
  size?: MxModalSize;
  className?: string;
  style?: CSSProperties;
}

export function MxConfirmDialog({
  open,
  onClose,
  onConfirm,
  tone = 'danger',
  title,
  message,
  itemName,
  extraContent,
  confirmLabel,
  cancelLabel,
  icon,
  asyncConfirm = true,
  loading = false,
  confirmDisabled = false,
  size = 'sm',
  className,
  style,
}: MxConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTitle = title ?? t('confirm_dialog.title');
  const resolvedConfirmLabel = confirmLabel ?? t('confirm_dialog.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('confirm_dialog.cancel');
  const Icon = icon ?? DEFAULT_ICON[tone];

  const handleClose = () => {
    if (asyncConfirm && submitting) return;
    setError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (confirmDisabled) return;

    if (!asyncConfirm) {
      // Semantique HISTORIQUE : aucune attente, meme si la fonction renvoie
      // une Promise — voir l'en-tete de fichier.
      onConfirm();
      onClose();
      return;
    }

    if (submitting) return; // pas de double envoi
    setError(null);
    const result = onConfirm();
    if (result && typeof (result as Promise<void>).then === 'function') {
      setSubmitting(true);
      (result as Promise<void>)
        .then(() => {
          setSubmitting(false);
          onClose();
        })
        .catch((err: unknown) => {
          setSubmitting(false);
          setError(err instanceof Error ? err.message : String(err));
        });
    } else {
      onClose();
    }
  };

  const busy = asyncConfirm ? submitting : loading;

  return (
    <MxModal
      open={open}
      onClose={handleClose}
      title={resolvedTitle}
      showHeader={false}
      role="alertdialog"
      zLayer="alert"
      size={size}
      dismissible={!busy}
      initialFocusRef={cancelRef}
      footerAlign="center"
      className={className}
      style={style}
      footer={
        <>
          <MxButton ref={cancelRef} variant="ghost" onClick={handleClose} disabled={busy}>
            {resolvedCancelLabel}
          </MxButton>
          <MxButton
            variant={CONFIRM_BUTTON_VARIANT[tone]}
            onClick={handleConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? t('confirm_dialog.loading') : resolvedConfirmLabel}
          </MxButton>
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--mx-space-12)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'calc(48px * var(--mx-scale, 1))',
            height: 'calc(48px * var(--mx-scale, 1))',
            borderRadius: 'var(--mx-radius-6)',
            background: MX_TONE_FILL[tone].bg,
            color: MX_TONE_FILL[tone].fg,
            flexShrink: 0,
          }}
        >
          <Icon style={mxIconBox('xl')} />
        </span>

        <h2 style={{ ...MX_TEXT.confirmTitle, color: 'var(--mx-text)', margin: 0 }}>
          {resolvedTitle}
        </h2>

        <p style={{ ...MX_TEXT.confirmMessage, color: 'var(--mx-text2)', margin: 0 }}>{message}</p>

        {itemName ? (
          <div
            style={{
              width: '100%',
              padding: 'var(--mx-space-12)',
              borderRadius: 'var(--mx-radius-8)',
              background: 'var(--mx-muted-box)',
              border: 'var(--mx-border-w) solid var(--mx-border)',
            }}
          >
            <span style={{ ...MX_TEXT.blockTitle, color: 'var(--mx-text)' }}>{itemName}</span>
          </div>
        ) : null}

        {tone === 'danger' ? (
          <p style={{ ...MX_TEXT.band, color: MX_TONE_TEXT.danger, margin: 0 }}>
            {t('confirm_dialog.irreversible')}
          </p>
        ) : null}

        {extraContent ? <div style={{ width: '100%' }}>{extraContent}</div> : null}

        {error ? (
          <p style={{ ...MX_TEXT.help, color: MX_TONE_TEXT.danger, margin: 0 }}>{error}</p>
        ) : null}
      </div>
    </MxModal>
  );
}

export default MxConfirmDialog;
