import {
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

import { MX_TEXT, MX_TONE_TEXT } from './tokens';
import { MxBadge } from './MxBadge';
import { mxIconBox } from './internal/mxIcon';
import { MX_VISUALLY_HIDDEN } from './internal/mxVisuallyHidden';

/**
 * MxTagInput — LOT CONTRATS B3, B3.1 (2026-10-03). Champ de JETONS generique
 * du tronc : destine en premier lieu aux listes CC/CCI des drawers d'envoi
 * d'email (`SendForSignatureDrawerMx`/`SendToArtistDrawerMx`), mais zero
 * logique email en dur — `validate`/`invalidMessage` sont fournis par
 * l'appelant, exactement comme `accept`/`rejectedTypeMessage` de
 * `MxDropzone` (meme convention de bornage : le tronc ne connait pas le
 * DOMAINE de la valeur, seulement sa FORME de jetons).
 *
 * DECLENCHEURS D'AJOUT, exactement les 3 demandes par Greg :
 * - Entree ou virgule pendant la saisie (`onKeyDown`, `preventDefault` : la
 *   virgule n'atteint donc jamais la valeur du champ) ;
 * - collage de plusieurs valeurs separees par virgule/point-virgule/retour a
 *   la ligne (`onPaste`) — un collage SANS separateur n'est PAS intercepte,
 *   le texte atterrit normalement dans le champ (comportement natif) ;
 * - perte de focus (`onBlur`) — AJOUT SILENCIEUX comme le faisaient
 *   `addCcEmail(true)`/`addBccEmail(true)` des modales AURA d'origine :
 *   une valeur invalide au blur ne declenche PAS `invalidMessage`, elle
 *   reste simplement dans le champ. C'est ce meme declencheur qui couvre le
 *   besoin d'un flush avant envoi : cliquer sur « Envoyer » declenche le
 *   blur du champ CC/CCI AVANT le clic (ordre naturel du DOM), donc une
 *   valeur tapee mais jamais validee par Entree est deja ajoutee au moment
 *   ou le gestionnaire d'envoi lit l'etat — aucune logique de flush a part
 *   n'est necessaire cote appelant.
 *
 * DOUBLON : une valeur deja presente (apres `trim`) est retiree du texte
 * SANS etre dupliquee, sans erreur — meme convention que les modales AURA
 * d'origine (`if (ccEmails.includes(trimmed)) { clear; return; }`).
 *
 * RETOUR ARRIERE sur champ VIDE retire le dernier jeton (`e.key ===
 * 'Backspace' && inputValue === ''`) — n'agit QUE si la saisie est vide,
 * jamais pendant l'edition d'un texte en cours.
 *
 * ANNEAU DE FOCUS : porte MANUELLEMENT par l'etat `focused` (meme
 * convention que `useMxFieldFocus` de `MxFields.tsx` — NON partagee avec ce
 * fichier, meme precedent assume que `MxNumberField`/`MxSelectField`, qui la
 * dupliquent deja chacun a la main plutot que de la brancher, cf. le
 * commentaire de `useMxFieldFocus` : « A REBRANCHER... dans un lot de
 * refactor dedie, si Greg le demande — pas avant ») PLUTOT que par la
 * pseudo-classe `:focus-visible` de l'EXCEPTION 1/2 (`data-mx-focus` reste
 * pose sur l'INPUT reel pour ce contour supplementaire, mais le cadre VISUEL
 * de l'ensemble jetons+champ est porte par le conteneur, qui n'est lui-meme
 * jamais focalisable directement).
 *
 * JETONS : `MxBadge tone="neutral"` (aplat neutre, PAS une reinvention —
 * seule primitive de « puce » du tronc) + bouton de retrait SANS libelle
 * visible, `aria-label` OBLIGATOIRE fourni par l'appelant via `removeLabel`
 * (meme discipline que `MxIconButton` : un bouton icone seule exige
 * TOUJOURS un nom accessible explicite, jamais invente ici).
 */
export interface MxTagInputProps {
  /** Libelle du champ. Sert de nom accessible via `htmlFor`. */
  label: ReactNode;
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Valide une valeur avant ajout (Entree/virgule/collage). Defaut : toute
   * valeur non vide est acceptee. JAMAIS appliquee a l'ajout silencieux du
   * blur — voir l'en-tete de fichier.
   */
  validate?: (value: string) => boolean;
  /**
   * Message affiche (et annonce, `aria-live="polite"`) quand `validate`
   * rejette une valeur a l'ajout explicite (Entree/virgule/collage). Aucun
   * texte invente en repli : si absent, aucun message n'est rendu — tout le
   * texte vient de l'appelant, convention du tronc.
   */
  invalidMessage?: string;
  /**
   * Nom accessible du bouton de retrait d'un jeton donne — OBLIGATOIRE, un
   * bouton icone seule n'a aucune autre source (meme discipline que
   * `MxIconButton['aria-label']`).
   */
  removeLabel: (tagValue: string) => string;
  placeholder?: string;
  disabled?: boolean;
  /** Aide sous le champ, remplacee par `invalidMessage` pendant un rejet. */
  hint?: ReactNode;
  /** Masque visuellement le libelle (nom accessible conserve). */
  hideLabel?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Separateurs reconnus au COLLAGE multi-valeurs : virgule, point-virgule, retour a la ligne. */
const PASTE_SEPARATORS = /[,;\n]+/;

export function MxTagInput({
  label,
  value,
  onChange,
  validate,
  invalidMessage,
  removeLabel,
  placeholder,
  disabled = false,
  hint,
  hideLabel = false,
  className,
  style,
}: MxTagInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);

  /**
   * Tente d'ajouter `raw` a `value`. Renvoie `true` si le champ de saisie
   * doit etre vide ensuite (ajout reussi OU doublon absorbe), `false` s'il
   * faut CONSERVER le texte tape (valeur invalide, ajout explicite) — meme
   * distinction que les modales AURA d'origine (`addCcEmail`/`addBccEmail`).
   */
  function tryAdd(raw: string, options: { silent?: boolean } = {}): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    if (value.includes(trimmed)) return true;
    if (validate && !validate(trimmed)) {
      if (!options.silent) setError(true);
      return false;
    }
    onChange([...value, trimmed]);
    return true;
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function handleChange(next: string) {
    setInputValue(next);
    setError(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (tryAdd(inputValue)) setInputValue('');
      return;
    }
    if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text || !PASTE_SEPARATORS.test(text)) return; // valeur unique : laisser le collage natif remplir le champ
    e.preventDefault();
    const parts = text
      .split(PASTE_SEPARATORS)
      .map((p) => p.trim())
      .filter(Boolean);
    // Accumulation locale plutot que plusieurs `onChange` successifs : chacun
    // fermerait sur le MEME `value` d'origine (prop, pas une ref mutable) et
    // ecraserait les ajouts precedents de la meme boucle — un seul `onChange`
    // final, avec la liste complete, evite cette perte.
    const next = [...value];
    let anyInvalid = false;
    for (const part of parts) {
      if (next.includes(part)) continue;
      if (validate && !validate(part)) {
        anyInvalid = true;
        continue;
      }
      next.push(part);
    }
    if (next.length !== value.length) onChange(next);
    setError(anyInvalid);
    setInputValue('');
  }

  function handleBlur() {
    setFocused(false);
    tryAdd(inputValue, { silent: true });
  }

  const danger = error && !!invalidMessage;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: hideLabel ? 0 : 'calc(6px * var(--mx-scale, 1))',
        minWidth: 0,
        // CORRECTIF C2.3 (LOT ARTISTES-LISTE, 2026-10-03) — meme raison que
        // FieldShell (MxFields.tsx) : bloc englobant du `<label>` quand
        // `hideLabel` pose `MX_VISUALLY_HIDDEN` (position:absolute) sur lui.
        // Pose inconditionnellement, aucun changement visuel sinon.
        position: 'relative',
        ...style,
      }}
    >
      <label
        htmlFor={id}
        style={hideLabel ? MX_VISUALLY_HIDDEN : { ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }}
      >
        {label}
      </label>

      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--mx-space-4)',
          minHeight: 'var(--mx-control-h)',
          padding: 'calc(4px * var(--mx-scale, 1)) var(--mx-space-8)',
          borderRadius: 'var(--mx-radius-6)',
          background: 'var(--mx-input-bg)',
          border: `var(--mx-border-w) solid ${danger ? MX_TONE_TEXT.danger : focused ? 'var(--mx-accent)' : 'var(--mx-input-border)'}`,
          boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          transition:
            'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        }}
      >
        {value.map((tag) => (
          <MxBadge key={tag} tone="neutral">
            <span>{tag}</span>
            <button
              type="button"
              aria-label={removeLabel(tag)}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <X style={mxIconBox('xs')} aria-hidden="true" />
            </button>
          </MxBadge>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          data-mx-focus=""
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: 'calc(80px * var(--mx-scale, 1))',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: 'calc(4px * var(--mx-scale, 1)) 0',
            color: 'var(--mx-text)',
            ...MX_TEXT.meta,
          }}
        />
      </div>

      {danger ? (
        <span aria-live="polite" style={{ ...MX_TEXT.help, color: MX_TONE_TEXT.danger }}>
          {invalidMessage}
        </span>
      ) : hint ? (
        <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{hint}</span>
      ) : null}
    </div>
  );
}

export default MxTagInput;
