import {
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Upload } from 'lucide-react';

import { MX_TEXT, MX_TONE_TEXT } from './tokens';
import { mxIconBox } from './internal/mxIcon';
import { useMxReducedMotion } from './internal/useMxReducedMotion';

/**
 * MxDropzone — LOT CONTRATS, ETAPE B1.2 (2026-10-02). 1re primitive de depot
 * de fichier du tronc, construite pour le futur drawer « Contrat » (glisser-
 * deposer d'un contrat recu) mais sans aucune dependance a ce domaine : zero
 * texte en dur, zero logique PDF — tout cela reste au choix de l'appelant.
 *
 * ETATS — exactement les 4 demandes par Greg, aucun de plus :
 *   repos               libelle, filet pointille neutre (--mx-dashed) — depuis
 *                        le LOT TRONC-ETATS-VIDES (2026-10-05), MxDropzone est
 *                        la SEULE primitive du tronc a porter ce filet ; voir
 *                        docs/design/handoff-mannyx-ds/DOCTRINE-ETATS-VIDES.md.
 *   survol avec fichier  pendant un dragenter/dragover, fond --mx-surface2 —
 *                        AUCUN mouse-hover simple n'est implemente : seul le
 *                        survol EN COURS DE DEPOT compte, ce que la demande
 *                        nomme explicitement.
 *   refus                type non accepte OU plusieurs fichiers deposes :
 *                        filet et texte passent au ton danger, le libelle
 *                        visible est REMPLACE par le message fourni en prop
 *                        (`rejectedTypeMessage` / `tooManyFilesMessage`) —
 *                        jamais un texte invente ici. Efface au prochain
 *                        dragenter ou clic (nouvelle tentative), jamais par
 *                        minuteur : deterministe pour les tests, pas de
 *                        delai arbitraire a justifier.
 *   envoi en cours        porte par `disabled` SEUL — aucune 2e prop : Greg
 *                        n'en liste que 4 (`accept`, `label`, `onFile`,
 *                        `disabled`), et « desactivee, aria-busy » decrit
 *                        VISUELLEMENT cet unique etat, pas un etat distinct.
 *                        Decision signalee au rapport B1.2, ouverte a
 *                        revision si Greg veut dissocier un jour « desactive
 *                        sans upload » d'« upload en cours ».
 *
 * ACCESSIBILITE.
 * - Racine `role="button"` + `tabIndex` (0, ou -1 si `disabled`) : ce n'est
 *   pas un <button> natif, le depot de fichier (dragenter/dragover/drop) a
 *   besoin d'un conteneur, d'ou le role pose a la main.
 * - `aria-label={label}` FIXE, y compris pendant un refus : le nom
 *   accessible decrit l'ACTION (« Ajouter un fichier »), jamais l'etat
 *   transitoire d'erreur — Greg demande un aria-label qui decrit l'action,
 *   pas un message qui changerait a chaque refus.
 * - Le libelle VISIBLE, lui, bascule sur le message de refus : un span
 *   `aria-live="polite"` l'entoure pour que le changement soit annonce sans
 *   dupliquer le refus dans l'arbre (pas de role="alert", moins intrusif,
 *   coherent avec MxNote qui ne force jamais une interruption).
 * - `data-mx-focus=""` : anneau de focus clavier, EXCEPTION 1/2 de
 *   tokens-mx.css, meme convention que MxButton/MxIconButton.
 * - Entree/Espace ouvrent l'explorateur (clic programmatique sur le champ
 *   fichier cache) — meme resultat que le clic souris sur la zone.
 *
 * ECHELLE / MOUVEMENT REDUIT. Filet pointille, rayon 10px, padding a
 * l'echelle via --mx-scale (seule primitive du tronc a garder ce filet,
 * voir plus haut) et meme garde `useMxReducedMotion` que
 * MxButton/MxIconButton pour neutraliser les transitions sous
 * `prefers-reduced-motion`.
 */
export interface MxDropzoneProps {
  /**
   * Filtre de type, MEME SYNTAXE que l'attribut HTML natif `accept`
   * (ex. ".pdf,application/pdf", "image/*"). Applique IDENTIQUEMENT au clic
   * (attribut `accept` du champ fichier) et au depot (verifie en JS) — c'est
   * precisement l'alignement demande en B1.1 : un seul jeu de types, une
   * seule logique de correspondance, quel que soit le chemin d'entree.
   */
  accept: string;
  /** Libelle au repos — AUSSI le nom accessible (`aria-label`), fixe. */
  label: string;
  /** Appele avec le fichier valide, au clic (explorateur) ou au depot. */
  onFile: (file: File) => void;
  /** Desactive clic, depot et clavier. Porte aussi `aria-busy` — voir l'etat « envoi en cours » ci-dessus. */
  disabled?: boolean;
  /** Message affiche (et annonce) quand le fichier ne correspond a aucun token de `accept`. */
  rejectedTypeMessage: string;
  /** Message affiche (et annonce) quand plusieurs fichiers sont deposes a la fois. */
  tooManyFilesMessage: string;
  className?: string;
  style?: CSSProperties;
}

type Rejection = 'type' | 'multiple' | null;

/**
 * Decoupe `accept` en tokens et teste un fichier contre chacun — EXTENSION
 * (".pdf"), MIME EXACT ("application/pdf") ou MIME GENERIQUE ("image/*").
 * Memes 2 criteres que l'existant de contrats.tsx (type MIME + extension),
 * mais une SEULE condition, exacte, partagee par le clic et le depot : plus
 * de `file.type.includes('pdf')` (plus large, cote clic) contre
 * `file.type === 'application/pdf'` (strict, cote depot) qui divergeaient —
 * voir le rapport B1.1.
 */
function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function MxDropzone({
  accept,
  label,
  onFile,
  disabled = false,
  rejectedTypeMessage,
  tooManyFilesMessage,
  className,
  style,
}: MxDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rejection, setRejection] = useState<Rejection>(null);
  const reduced = useMxReducedMotion();

  const openExplorer = () => {
    if (disabled) return;
    setRejection(null);
    inputRef.current?.click();
  };

  // `e.target !== e.currentTarget` : le clic PROGRAMMATIQUE sur le champ
  // fichier cache (`inputRef.current.click()`, depuis `openExplorer`) remonte
  // par bulle jusqu'a cette racine, qui porte elle-meme `onClick` — sans ce
  // garde, chaque ouverture de l'explorateur se redeclencherait elle-meme
  // indefiniment. Seul un clic qui cible la racine (souris sur la zone, ou
  // `fireEvent.click(zone)` en test) doit ouvrir l'explorateur.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    openExplorer();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openExplorer();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setRejection(null);
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const evaluateFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setRejection('multiple');
      return;
    }
    const file = files[0];
    if (!matchesAccept(file, accept)) {
      setRejection('type');
      return;
    }
    setRejection(null);
    onFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    evaluateFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    evaluateFiles(e.target.files);
    // Reinitialise la valeur : permet de re-selectionner le MEME fichier
    // (ex. apres un refus corrige a cote) sans que le navigateur ignore le
    // changement, faute de quoi `onChange` ne se redeclenche pas.
    e.target.value = '';
  };

  const danger = rejection !== null;
  const message = rejection === 'type' ? rejectedTypeMessage : rejection === 'multiple' ? tooManyFilesMessage : label;

  return (
    <div
      role="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-busy={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-mx-focus=""
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--mx-space-8)',
        // Memes valeurs que MxEmpty : padding hors echelle standard (20/18px),
        // le handoff de l'etat vide prime ici aussi, meme filet pointille.
        padding: 'calc(20px * var(--mx-scale, 1)) calc(18px * var(--mx-scale, 1))',
        border: `var(--mx-border-w) dashed ${danger ? MX_TONE_TEXT.danger : 'var(--mx-dashed)'}`,
        borderRadius: 'var(--mx-radius-10)',
        background: dragOver && !disabled ? 'var(--mx-surface2)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        boxShadow: focused && !disabled ? 'var(--mx-focus-ring)' : 'none',
        transition: reduced
          ? 'none'
          : 'background var(--mx-dur-fast) var(--mx-ease-appear), border-color var(--mx-dur-fast) var(--mx-ease-appear), box-shadow var(--mx-dur-fast) var(--mx-ease-appear)',
        ...style,
      }}
    >
      {/* Champ fichier reel, cache : porte `accept` pour le filtre natif de
          l'explorateur (meme filtre que la verification JS du depot — voir
          `matchesAccept`). `tabIndex={-1}` : jamais atteint au clavier
          directement, c'est la racine qui le declenche par programme. */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
      />
      <span
        aria-hidden="true"
        style={{ display: 'flex', color: danger ? MX_TONE_TEXT.danger : 'var(--mx-text3)' }}
      >
        <Upload style={mxIconBox('xl')} />
      </span>
      <span
        aria-live="polite"
        style={{
          ...MX_TEXT.body,
          fontWeight: 700,
          color: danger ? MX_TONE_TEXT.danger : 'var(--mx-text2)',
        }}
      >
        {message}
      </span>
    </div>
  );
}

export default MxDropzone;
