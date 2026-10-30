import {
  createContext,
  useContext,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { MX_TEXT, type MxMode } from './tokens';
import { MxKV } from './MxKV';
import { mxIconBox } from './internal/mxIcon';
import { MX_VISUALLY_HIDDEN } from './internal/mxVisuallyHidden';

/**
 * Le mode descend par contexte : MxFields le pose une fois, les champs
 * l'heritent. Evite qu'une grille en lecture contienne un champ reste en
 * edition — incoherence facile a introduire si chaque champ portait la prop
 * a la main. Une prop `mode` explicite sur un champ reste prioritaire.
 */
const MxModeContext = createContext<MxMode>('edit');

/**
 * CHAMP DATE — VOLONTAIREMENT ABSENT DU TRONC. Ne pas l'ajouter ici.
 *
 * Le bloc `fields` du handoff prevoit quatre types, dont `kind: 'date'`, rendu
 * par un `<input type="date">` natif. `docs/PROJECT_INSTRUCTIONS.md` l'interdit :
 * toute saisie de date passe par les pickers AURA, jamais par un input natif.
 *
 * Arbitrage de Greg du 2026-09-23 : la regle projet PRIME sur le `kind: date`
 * du handoff. Ce n'est donc ni un oubli ni un manque a combler — c'est un ecart
 * assume. Le champ date viendra en T2.6, quand les pickers AURA seront habilles
 * aux tokens mx ; il exposera l'API d'un champ mx par-dessus le picker, pas un
 * input natif restyle.
 */

interface MxFieldsProps {
  /** Colonnes en mode edition. Ramene a 1 en mode lecture (les lignes
   *  cle/valeur se lisent mieux empilees). */
  cols?: 1 | 2 | 3 | 4;
  mode?: MxMode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** MxFields — grille de champs. */
export function MxFields({ cols = 1, mode = 'edit', children, className, style }: MxFieldsProps) {
  const effectiveCols = mode === 'read' ? 1 : cols;

  return (
    <MxModeContext.Provider value={mode}>
      <div
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
          gap: 'var(--mx-space-12)',
          ...style,
        }}
      >
        {children}
      </div>
    </MxModeContext.Provider>
  );
}

/**
 * ECART TYPOGRAPHIQUE ASSUME — DECISION DE GREG DU 2026-09-23, DEFINITIVE.
 *
 * Le handoff dessine ce champ en 13.5px/600 sur 40px de haut (mesure dans
 * `reference/Mannyx Components V2.html`, pas calculee). Le tronc reste en
 * 12.5px/500 sur 34px : juge trop gros pour la densite des ecrans reels, un
 * decompte final tenant plusieurs dizaines de valeurs a l'ecran.
 *
 * Ce n'est PAS un defaut a corriger. Un audit qui le redecouvre doit le
 * classer « conforme a la decision projet », pas « ERREUR ». Voir la clause
 * « echelle typographique » de docs/design/handoff-mannyx-ds/LISEZ-MOI-EN-PREMIER.md.
 *
 * La decision porte sur la TAILLE ET LA GRAISSE DU TEXTE, et sur rien d'autre.
 * Le rayon, la bordure, l'ecart au label et l'anneau de focus ci-dessous
 * suivent le handoff.
 *
 * Elle n'est pas non plus SYMETRIQUE : elle protege le tronc d'un handoff plus
 * GROS ou plus GRAS. Si le handoff etait plus petit ou plus leger que le code
 * en place, elle ne jouerait pas et il faudrait descendre a sa valeur. Ici il
 * est plus gros : elle joue.
 */
const INPUT_STYLE: CSSProperties = {
  width: '100%',
  minHeight: 'var(--mx-control-h)',
  padding: '0 var(--mx-space-12)',
  // 6px : valeur de la table des rayons du README pour « cartes, champs, selects,
  // menus ». Ne pas remonter a 8px, reserve aux boutons de drawer et aux encarts.
  borderRadius: 'var(--mx-radius-6)',
  background: 'var(--mx-input-bg)',
  // 1.5px, comme le README ET mannyx-drawer.js. Le code portait 1px avant le
  // 2026-09-23, au motif qu'un filet de 1.5px « rendait trop gras ». Mesure
  // faite depuis : a densite de pixels 1, le navigateur arrondit 1.5px a un
  // seul pixel physique, donc les deux valeurs sont indiscernables. A densite 2
  // c'est le rendu voulu par la DA. Conformite sans contrepartie visible.
  border: 'var(--mx-border-w) solid var(--mx-input-border)',
  color: 'var(--mx-text)',
  // AUCUN `outline` ici, et c'est voulu : le contour de focus clavier est
  // pose par l'EXCEPTION 1 / 2 de tokens-mx.css sur `[data-mx-focus]`, que les
  // deux champs ci-dessous portent. Un `outline:'none'` en ligne l'annulerait —
  // le style d'attribut bat la feuille. Le contour du navigateur au clic souris
  // est neutralise par la seconde regle de cette exception, pas ici.
  ...MX_TEXT.meta,
};

/** Enveloppe commune : label au-dessus, champ dessous, aide en pied. */
function FieldShell({
  id,
  label,
  hint,
  error,
  hideLabel,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /**
   * Message d'erreur -- remplace `hint` (jamais les deux a la fois), en
   * `--mx-danger` au lieu de `--mx-text3`. LOT BOOKING-DRAWERS-FIN, LOT 2,
   * C1.1 (2026-10-18).
   */
  error?: ReactNode;
  /** Masque visuellement le libelle (nom accessible conserve). */
  hideLabel?: boolean;
  children: ReactNode;
}) {
  // gap 6px : ecart label/champ de `.mx-dr-field`. Pas un token d'espacement,
  // l'echelle n'en a que 4 et 8 ; la valeur du handoff prime sur l'arrondi.
  //
  // `position:'relative'` — CORRECTIF C2.3 (LOT ARTISTES-LISTE, 2026-10-03) :
  // ce conteneur doit toujours etre le bloc englobant du `<label>` quand
  // `hideLabel` pose `MX_VISUALLY_HIDDEN` (position:absolute) sur lui, voir
  // le commentaire de ce helper. Pose INCONDITIONNELLEMENT (pas seulement
  // si `hideLabel`) : un champ sans libelle cache aujourd'hui peut le
  // devenir demain sans que ce conteneur soit retouche, et `position:
  // relative` sans `top`/`left` ne change rien au rendu normal (aucun
  // changement visuel pour les champs existants).
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: hideLabel ? 0 : 'calc(6px * var(--mx-scale, 1))',
        minWidth: 0,
        position: 'relative',
      }}
    >
      <label
        htmlFor={id}
        style={
          hideLabel ? MX_VISUALLY_HIDDEN : { ...MX_TEXT.fieldLabelStrong, color: 'var(--mx-text2)' }
        }
      >
        {label}
      </label>
      {children}
      {error ? (
        <span style={{ ...MX_TEXT.help, color: 'var(--mx-danger)' }}>{error}</span>
      ) : hint ? (
        <span style={{ ...MX_TEXT.help, color: 'var(--mx-text3)' }}>{hint}</span>
      ) : null}
    </div>
  );
}

/**
 * Mecanique de focus partagee — extraite pour C7, mais NON BRANCHEE sur
 * MxNumberField ni MxSelectField : ils la dupliquent encore chacun a la main
 * (leur propre `useState(focused)` + handlers + calcul de `borderColor`/
 * `boxShadow`), et ce lot ne les touche pas. Les deux sont en PRODUCTION dans
 * le pilote (SettlementDrawerMx) ; un refactor cosmetique sur du code qui
 * marche ne se fait pas en marge d'un autre lot (decision Greg, 2026-09-24).
 * A REBRANCHER SUR LES QUATRE CHAMPS dans un lot de refactor dedie, si Greg le
 * demande — pas avant.
 */
function useMxFieldFocus() {
  const [focused, setFocused] = useState(false);
  return {
    handlers: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    /** `disabled` gele l'anneau, comme sur MxNumberField/MxSelectField. */
    focusStyle: (disabled?: boolean): CSSProperties => ({
      borderColor: focused ? 'var(--mx-accent)' : 'var(--mx-input-border)',
      boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
      transition:
        'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
    }),
  };
}

interface MxNumberFieldProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  mode?: MxMode;
  disabled?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
  /** Aide sous le champ (sous-total, unite…). */
  hint?: ReactNode;
  /** Valeur affichee en mode lecture si elle differe de `value`. */
  readValue?: ReactNode;
  /**
   * Message d'erreur de validation -- LOT BOOKING-DRAWERS-FIN, LOT 2, C1.1
   * (2026-10-18). MEME convention que `MxPickerField` (interne, partagee par
   * les pickers) : bordure `--mx-danger`, message sous le champ en
   * `MX_TEXT.help`/`--mx-danger`. Prioritaire sur `hint` (jamais les deux a
   * la fois, voir `FieldShell`).
   */
  error?: string;
}

/**
 * MxNumberField — seul type de champ numerique du tronc (tranche 1).
 * En mode lecture, rend une ligne cle/valeur : c'est ce qui permet aux deux
 * arbres consultation/edition du pilote de converger sans changer l'affichage.
 */
export function MxNumberField({
  label,
  value,
  onChange,
  mode,
  disabled,
  min,
  step,
  placeholder,
  hint,
  readValue,
  error,
}: MxNumberFieldProps) {
  const inherited = useContext(MxModeContext);
  const effective = mode ?? inherited;
  const id = useId();
  const [focused, setFocused] = useState(false);

  if (effective === 'read') {
    return <MxKV label={label} value={readValue ?? value} tabular />;
  }

  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="number"
        data-mx-focus=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        step={step}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...INPUT_STYLE,
          fontVariantNumeric: 'tabular-nums',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          borderColor: focused ? 'var(--mx-accent)' : error ? 'var(--mx-danger)' : 'var(--mx-input-border)',
          boxShadow: focused ? 'var(--mx-focus-ring)' : 'none',
          transition:
            'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        }}
      />
    </FieldShell>
  );
}

export interface MxSelectOption {
  value: string;
  label: string;
}

interface MxSelectFieldProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  options: MxSelectOption[];
  mode?: MxMode;
  disabled?: boolean;
  hint?: ReactNode;
  /** Masque visuellement le libelle (nom accessible conserve) — barre de
   *  filtres compacte, LOT PAGE-NOTIFICATIONS B1. En mode lecture, `label`
   *  reste affiche par `MxKV` (hideLabel ne s'y applique pas : hors propos
   *  d'une ligne cle/valeur, toujours visible). */
  hideLabel?: boolean;
  /** Voir `MxNumberFieldProps.error` — meme contrat, meme rendu. */
  error?: string;
}

/**
 * MxSelectField — seul type de champ a choix du tronc (tranche 1).
 * Chevron Lucide superpose a un <select> natif : on garde le menu et le clavier
 * du systeme, on ne remplace que l'habillage.
 */
export function MxSelectField({
  label,
  value,
  onChange,
  options,
  mode,
  disabled,
  hint,
  hideLabel,
  error,
}: MxSelectFieldProps) {
  const inherited = useContext(MxModeContext);
  const effective = mode ?? inherited;
  const id = useId();
  const [focused, setFocused] = useState(false);

  if (effective === 'read') {
    const current = options.find((o) => o.value === value);
    return <MxKV label={label} value={current?.label ?? value} />;
  }

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div style={{ position: 'relative', display: 'flex' }}>
        <select
          id={id}
          data-mx-focus=""
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...INPUT_STYLE,
            appearance: 'none',
            paddingRight: 'var(--mx-space-32)',
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderColor: focused ? 'var(--mx-accent)' : error ? 'var(--mx-danger)' : 'var(--mx-input-border)',
            boxShadow: focused ? 'var(--mx-focus-ring)' : 'none',
            transition:
              'border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          style={{
            ...mxIconBox('sm'),
            position: 'absolute',
            right: 'var(--mx-space-12)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--mx-text3)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </FieldShell>
  );
}

interface MxTextFieldProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /**
   * Sous-types HTML natifs couverts par C7 : aucun ne change le STYLE — le
   * handoff pose une seule regle pour `input,select,textarea` (mannyx-drawer.js
   * ligne 57) — seuls le clavier mobile et la validation natifs du navigateur
   * different.
   */
  type?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'search';
  mode?: MxMode;
  disabled?: boolean;
  placeholder?: string;
  /** Aide sous le champ. */
  hint?: ReactNode;
  /** Valeur affichee en mode lecture si elle differe de `value`. */
  readValue?: ReactNode;
  /**
   * Icone de tete — LOT PAGE-NOTIFICATIONS, B1 (2026-10-01). COMPOSANT
   * Lucide, jamais un element deja instancie (meme convention que partout
   * dans le tronc). MEME mecanisme que le chevron de MxSelectField : icone
   * superposee en `position:absolute`/`pointerEvents:'none'`, a GAUCHE au
   * lieu d'a droite — mirroir, pas reinvention. `aria-hidden`, le champ
   * reste nomme par son `<label>` (visible ou masque via `hideLabel`),
   * jamais par l'icone.
   */
  icon?: LucideIcon;
  /** Masque visuellement le libelle (nom accessible conserve). */
  hideLabel?: boolean;
}

/**
 * MxTextField — champ texte du tronc (C7).
 *
 * PAS de prop `mono` : le handoff pose `data-mono` sur input/textarea
 * (mannyx-drawer.js ligne 58, `font-family:var(--font-mono);
 * font-variant-numeric:tabular-nums`), mais aucun appelant de MxTextField n'en
 * a besoin aujourd'hui — le mono du tronc vit deja sur MxNumberField. Meme
 * regle que `danger` sur MxButton : le tronc ne produit que ce qu'un
 * consommateur demande.
 * RECETTE, le jour ou un appelant arrive (ex. un identifiant technique affiche
 * en colonnes) : ajouter `mono?: boolean` a cette interface, et dans le style
 * `...(mono ? { fontFamily: 'var(--mx-font-mono)', fontVariantNumeric:
 * 'tabular-nums' } : null)` — exactement le motif deja pose sur MxNumberField.
 */
export function MxTextField({
  label,
  value,
  onChange,
  type = 'text',
  mode,
  disabled,
  placeholder,
  hint,
  readValue,
  icon: Icon,
  hideLabel,
}: MxTextFieldProps) {
  const inherited = useContext(MxModeContext);
  const effective = mode ?? inherited;
  const id = useId();
  const { handlers, focusStyle } = useMxFieldFocus();

  if (effective === 'read') {
    return <MxKV label={label} value={readValue ?? value} />;
  }

  return (
    <FieldShell id={id} label={label} hint={hint} hideLabel={hideLabel}>
      <div style={{ position: 'relative', display: 'flex' }}>
        <input
          id={id}
          type={type}
          data-mx-focus=""
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          {...handlers}
          style={{
            ...INPUT_STYLE,
            // 32px : meme repli que MxSelectField pour son chevron
            // (`paddingRight:'var(--mx-space-32)'`), mirroir a GAUCHE. Absent
            // (`undefined`), le raccourci `padding` d'INPUT_STYLE s'applique
            // sans ecart — aucun site d'appel existant n'est affecte.
            paddingLeft: Icon ? 'var(--mx-space-32)' : undefined,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            ...focusStyle(disabled),
          }}
        />
        {Icon ? (
          <Icon
            aria-hidden="true"
            style={{
              ...mxIconBox('sm'),
              position: 'absolute',
              left: 'var(--mx-space-12)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--mx-text3)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </FieldShell>
  );
}

interface MxTextAreaProps {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  mode?: MxMode;
  disabled?: boolean;
  placeholder?: string;
  /** `.mx-dr-field textarea rows` du handoff n'impose pas de valeur : 3 est le
   *  defaut le plus courant releve dans reference/mannyx-drawer.js (ligne 141). */
  rows?: number;
  hint?: ReactNode;
  readValue?: ReactNode;
}

/**
 * MxTextArea — zone de texte du tronc (C7).
 *
 * TROIS ECARTS AU SOCLE COMMUN, tous les trois du handoff, PAS de l'echelle
 * typographique — la decision de Greg du 2026-09-23 ne couvre que taille et
 * graisse du texte, rien d'autre (mannyx-drawer.js ligne 60,
 * `.mx-dr-field textarea{resize:vertical;min-height:72px;line-height:1.5}`) :
 *   - `resize:'vertical'`
 *   - `minHeight:72` — LITTERAL, comme le 34 d'INPUT_STYLE : aucun token entre
 *     64 et 80 ne vaut 72, et 72 n'a pas vocation a en devenir un (un seul
 *     usage, pas une valeur qui se repete).
 *   - `lineHeight:1.5` — le handoff pose un interlignage EXPLICITE sur
 *     textarea, contrairement a l'input (voir INPUT_STYLE/MxNumberField, qui
 *     n'en pose aucun). MX_TEXT.meta porte 1.3 : ecrase ici, pas dans le preset
 *     partage, pour ne pas changer l'interlignage des champs a une ligne.
 *
 * PADDING VERTICAL LITTERAL A 10 — CONFORMITE, PAS UN CHOIX. Le handoff pose
 * `padding:10px 12px` UNIFORME pour input/select/textarea (ligne 57) ; 12
 * correspond exactement a --mx-space-12 (deja consomme par INPUT_STYLE), mais
 * aucun token de l'echelle (4/8/12/16/24/32/48/64/80/96) ne vaut 10. Ni typo ni
 * ecart assume : ecrire 8 par reflexe d'echelle introduirait un ecart de 2px
 * SANS raison, exactement ce qu'un audit redecouvrirait dans six mois. Le 10
 * reste donc litteral, comme le 72 ci-dessus.
 */
export function MxTextArea({
  label,
  value,
  onChange,
  mode,
  disabled,
  placeholder,
  rows = 3,
  hint,
  readValue,
}: MxTextAreaProps) {
  const inherited = useContext(MxModeContext);
  const effective = mode ?? inherited;
  const id = useId();
  const { handlers, focusStyle } = useMxFieldFocus();

  if (effective === 'read') {
    return <MxKV label={label} value={readValue ?? value} />;
  }

  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea
        id={id}
        data-mx-focus=""
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        {...handlers}
        style={{
          ...INPUT_STYLE,
          minHeight: 'calc(72px * var(--mx-scale, 1))',
          padding: 'calc(10px * var(--mx-scale, 1)) var(--mx-space-12)',
          lineHeight: 1.5,
          resize: 'vertical',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          ...focusStyle(disabled),
        }}
      />
    </FieldShell>
  );
}

export default MxFields;
