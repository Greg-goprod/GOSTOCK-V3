# 04 -- Design System AURA

## Vue d'ensemble

AURA est le design system de MANNYX. Il fournit des tokens CSS, des composants React, et des conventions visuelles pour assurer la coherence de l'interface.

**Reference visuelle** : `docs/ui.html` (ouvrir dans un navigateur pour voir tous les composants rendus).

## Palette de couleurs

### Couleurs principales (palette officielle)

| Nom             | Hex       | Usage                      |
| --------------- | --------- | -------------------------- |
| Oxford Blue     | `#0B1D3A` | Arriere-plan principal     |
| Federal Blue    | `#050A30` | Surfaces elevees           |
| Resolution Blue | `#002fa7` | Accent secondaire          |
| Cobalt Blue     | `#0047ab` | Liens, actions secondaires |
| White Smoke     | `#f5f5f5` | Texte sur fond sombre      |
| Eminence        | `#6C2F7E` | Violet profond             |
| Purpureus       | `#9B59B6` | Violet clair               |
| Light Green     | `#85E085` | Succes, positif            |
| Taupe Gray      | `#8B8589` | Texte muted                |
| Violet Blue     | `#7C4DFF` | Primary (violet neon)      |

### Tokens CSS

Les couleurs sont definies dans `src/styles/tokens.css` via des variables CSS :

```css
:root {
  /* Primary */
  --color-primary: #7c4dff;
  --color-primary-hover: #9e7bff;
  --color-primary-muted: rgba(124, 77, 255, 0.15);

  /* Surfaces */
  --bg-surface: #0b1d3a;
  --bg-elevated: #112240;
  --bg-card: #0d2137;

  /* Texte */
  --text-primary: #f5f5f5;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Bordures */
  --border-default: rgba(148, 163, 184, 0.1);
  --border-focus: #7c4dff;

  /* Feedback */
  --color-success: #85e085;
  --color-warning: #ffc107;
  --color-error: #ff5252;
  --info: #64b5f6;

  /* Glows */
  --glow-primary: 0 0 15px rgba(124, 77, 255, 0.3);
  --glow-primary-strong: 0 0 25px rgba(124, 77, 255, 0.5);

  /* Z-index */
  --z-modal: 50;
  --z-toast: 60;
}
```

Le theme par defaut est **dark**. Un light mode existe via `[data-theme="light"]`.

### Utilisation dans Tailwind

Les tokens sont mappes dans `tailwind.config.ts` :

```
text-primary    -> var(--color-primary)
bg-surface      -> var(--bg-surface)
bg-elevated     -> var(--bg-elevated)
border-default  -> var(--border-default)
shadow-glow-primary -> var(--glow-primary)
```

Couleurs additionnelles Tailwind : `violetNeon`, `violetNeonAlt`, `night`.

## Typographie

| Police      | Usage                     | Poids                     |
| ----------- | ------------------------- | ------------------------- |
| **Inter**   | Body text, labels, inputs | 300-900                   |
| **Manrope** | Headings (H1-H4)          | 400-700, `tracking-tight` |

Les polices sont chargees via Google Fonts dans `index.html`.

Classes Tailwind : `font-sans` (Inter), `font-manrope` (Manrope).

## Composants AURA

Tous dans `src/components/aura/`. Utilisation obligatoire pour toute nouvelle page.

### Button

```tsx
import { Button } from '@/components/aura/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  Sauvegarder
</Button>
<Button variant="ghost" size="sm">Annuler</Button>
<Button variant="danger" size="sm">Supprimer</Button>
```

Variantes : `primary`, `secondary`, `ghost`, `danger`, `outline`.
Tailles : `sm`, `md`, `lg`.

### Input

```tsx
import { Input } from '@/components/aura/Input';

<Input
  label="Nom"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Entrez le nom"
  error={errors.name}
/>;
```

### PhoneInput

```tsx
import { PhoneInput } from '@/components/aura/PhoneInput';

<PhoneInput value={phone} onChange={setPhone} label="Telephone" />;
```

Utilise `libphonenumber-js` pour la validation E.164.
Selecteur de pays (240+), auto-detection, formatage automatique.

### Card

```tsx
import { Card, CardHeader, CardBody, CardTitle } from '@/components/aura/Card';

<Card>
  <CardHeader>
    <CardTitle>Titre de la carte</CardTitle>
  </CardHeader>
  <CardBody>Contenu...</CardBody>
</Card>;
```

### Modal

```tsx
import { Modal } from '@/components/aura/Modal';

<Modal isOpen={show} onClose={() => setShow(false)} title="Editer">
  {/* Contenu du modal */}
</Modal>;
```

### ConfirmDialog

```tsx
import { ConfirmDialog } from '@/components/aura/ConfirmDialog';

<ConfirmDialog
  isOpen={showConfirm}
  title="Supprimer ?"
  message="Cette action est irreversible."
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  variant="danger"
/>;
```

### Table

```tsx
import Table from '@/components/aura/Table';
import { useTableSort } from '@/hooks/useTableSort';

const { sortedData, sortConfig, requestSort } = useTableSort(data, 'name');

<Table
  columns={[
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'actions', label: '', render: (row) => <ActionButtons ... /> },
  ]}
  data={sortedData}
  sortConfig={sortConfig}
  onSort={requestSort}
  loading={loading}
  emptyMessage="Aucun resultat"
/>
```

### Badge

```tsx
import { Badge } from '@/components/aura/Badge';

<Badge variant="success">Actif</Badge>
<Badge variant="warning">En attente</Badge>
<Badge variant="error">Annule</Badge>
```

### Toast

```tsx
import { useToast } from '@/components/aura/ToastProvider';

const { addToast } = useToast();
addToast({ type: 'success', message: 'Sauvegarde reussie' });
addToast({ type: 'error', message: 'Erreur lors de la suppression' });
```

Ou la version simplifiee :

```tsx
import { useToastSimple } from '@/components/aura/ToastProvider';

const toast = useToastSimple();
toast.success('Sauvegarde reussie');
toast.error('Erreur');
```

### PageHeader

```tsx
import { PageHeader } from '@/components/aura/PageHeader';

<PageHeader icon={MapPin} title="Missions" subtitle="Gestion des missions de transport" />;
```

### EmptyState

```tsx
import { EmptyState } from '@/components/aura/EmptyState';

<EmptyState
  icon={Inbox}
  title="Aucune mission"
  description="Creez votre premiere mission pour commencer."
  action={{ label: 'Nouvelle mission', onClick: handleCreate }}
/>;
```

### ViewModeToggle

```tsx
import { ViewModeToggle } from '@/components/aura/ViewModeToggle';

<ViewModeToggle mode={viewMode} onChange={setViewMode} />;
```

Bascule entre vue `list` et `grid`.

### Tooltip

```tsx
import Tooltip from '@/components/aura/Tooltip';

<Tooltip content="Information supplementaire">
  <button>Hover moi</button>
</Tooltip>;
```

### ActionButtons

```tsx
import { ActionButtons } from '@/components/aura/ActionButtons';

<ActionButtons onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} />;
```

### Kanban (Contrats)

```tsx
import { KanbanBoard } from '@/components/aura/KanbanBoard';
```

Colonnes draggables avec palette AURA (taupe, cobalt, resolution, eminence, purpureus, lightgreen).

## Pickers Date/Heure

Les pickers AURA sont **obligatoires** -- ne jamais utiliser d'inputs HTML natifs `<input type="date">`.

Les composants sont dans `src/components/ui/pickers/` :

| Composant        | Usage                                |
| ---------------- | ------------------------------------ |
| `DatePicker`     | Selection de date (calendrier)       |
| `TimePicker`     | Selection d'heure (horloge visuelle) |
| `DateTimePicker` | Combinaison date + heure             |

Styles dans `src/styles/pickers.css` (classes `clock-circle`, `calendar-day`, etc.).

## Toolbar

Pour les barres d'outils au-dessus des tableaux :

- Hauteur fixe : **32px**
- Composants en `size="sm"` (Input, Select, Button)
- Fond : transparent ou `bg-surface`

## Conventions visuelles

| Element           | Convention                                                    |
| ----------------- | ------------------------------------------------------------- |
| Couleur primaire  | `violet-400` / `violet-500`                                   |
| Icones            | Lucide React uniquement, taille `w-5 h-5`                     |
| Icone suppression | Poubelle rouge (`text-red-400`)                               |
| Padding page      | `p-6`                                                         |
| Breadcrumb        | `text-gray-400`, format "Section / Sous-section"              |
| Transitions       | `transition-smooth` (classe utilitaire)                       |
| Cards             | `bg-elevated`, `rounded-xl`, `border border-default`          |
| Modals            | Centre ecran, overlay `bg-black/50`, z-index `var(--z-modal)` |
| Toasts            | Coin superieur droit, z-index `var(--z-toast)`                |
