# Doctrine Configuration — roue du module (décision Greg, 2026-10-04)

> **Portée.** Ce document fixe où vit le bouton de configuration d'un module Mannyx (la
> « roue dentée ») et ce qu'il ouvre. Il complète `DOCTRINE-BARRE-OUTILS.md` (qui, elle,
> couvre la barre d'outils d'une **liste**, pas la configuration d'un **module**) et
> `DOCTRINE-DRAWER.md` (modèle à onglets, réutilisé ici pour le drawer de configuration).
>
> **Statut.** Décision définitive de Greg, LOT BARRES-OUTILS, A (2026-10-04). Vaut pour
> TOUS les modules Mannyx (Artistes, Booking, Contrats, Notifications, Production,
> Presse, Staff, Contacts, Finance…).
>
> **Ce lot pose l'ACCUEIL de la roue dans `ModuleChrome` (zone actions de l'en-tête) —
> AUCUN drawer de configuration n'est construit ici.** Aucun module ne passe encore de
> `configAction` : l'inventaire des configurations existantes (ce qu'un module a
> aujourd'hui dans Réglages) fait l'objet d'un lot ultérieur, dédié, avant toute
> construction de drawer. Ne pas construire de drawer de configuration au prétexte de
> cette doctrine sans instruction explicite.

---

## 1. Le modèle, en une phrase

**Une roue par MODULE (pas par page, pas par liste), toujours à la même place — zone
actions de l'en-tête du module (`ModuleChrome`/`MxPageHeader`), après les actions propres
à la page. Un clic ouvre UN drawer de configuration du module, avec un onglet par page du
module, ouvert sur l'onglet de la page courante.**

## 2. Pourquoi dans l'en-tête du module, pas dans `MxToolbar`

`MxToolbar` (voir `DOCTRINE-BARRE-OUTILS.md`) est la barre d'outils d'une **liste** — elle
existe une fois par page qui liste quelque chose (Artistes, Contrats…), parfois plusieurs
fois si un module a plusieurs pages avec chacune sa liste. La configuration, elle, est une
notion de **module** : un seul jeu de réglages (ex. les réglages du module Artistes),
consulté/modifié depuis n'importe quelle page de ce module. Poser la roue dans
`MxToolbar` aurait dupliqué le bouton par liste, et désynchronisé son état (quel onglet de
configuration ouvrir depuis quelle liste ?). `ModuleChrome` est déjà le point UNIQUE
partagé par toutes les pages d'un module (en-tête + onglets de navigation, voir son
commentaire d'en-tête) — la roue y trouve naturellement sa place, une fois pour tout le
module.

Une version antérieure de `DOCTRINE-BARRE-OUTILS.md` (LOT ARTISTES-LISTE C3) prévoyait un
emplacement `config` dans `MxToolbar` — retiré par ce lot, jamais branché par aucune page.

## 3. Tronc — `ModuleChrome`, prop `configAction`

`src/layout/ModuleChrome.tsx` expose `configAction?: ModuleChromeConfigAction` :

```ts
export interface ModuleChromeConfigAction {
  /** Page de reglages dont le droit `update` conditionne la visibilite de la roue. */
  pageId: string;
  /** Nom du module, insere dans l'aria-label traduit (« Configurer {module} »). */
  moduleLabel: string;
  onConfigure: () => void;
}
```

- **Branche Mx uniquement** (`MxIconButton` est une primitive tronc, jamais rendue en
  branche ancienne — même principe que `actions`, qui ne mélange jamais `MxButton` et les
  boutons AURA de la branche historique).
- **Absente par défaut** : aucun module ne la fournit aujourd'hui — pas de roue nulle
  part tant qu'aucun inventaire de configuration n'a été fait pour ce module (comportement
  identique à une prop non fournie, même convention que `config` dans `MxToolbar`
  auparavant).
- **Visibilité conditionnée au droit `update`** : la roue n'apparaît que si l'utilisateur a
  le droit `update` sur `configAction.pageId` — même convention `can(pageId, 'update')`
  que le reste de l'application (`src/components/auth/Can.tsx`). Un utilisateur sans ce
  droit ne voit tout simplement pas la roue, qui redevient absente (comportement identique
  à `configAction` non fourni).
- **Toujours en DERNIÈRE position de la zone actions** (après les `actions` propres à la
  page) : la roue reste repérable au même endroit visuel quel que soit le nombre d'actions
  de page — c'est `ModuleChromeView` qui compose cet ordre, jamais l'appelant.
- `onConfigure` : pas de drawer construit par ce lot — l'appelant peut poser un no-op
  aujourd'hui ; le câblage réel (ouverture du drawer de configuration) arrive avec le lot
  qui construit ce drawer, module par module.
- Icône `Settings` (lucide), rendue via `MxIconButton` — `aria-label` traduit (clé
  `module_chrome.configure_aria_label`, « Configurer {module} »/« Configure {module} »/
  « {module} konfigurieren », `{module}` remplacé manuellement par `configAction.moduleLabel`,
  même convention que les autres clés à paramètre du projet).

## 4. Le drawer de configuration (lot ultérieur, pas construit ici)

Quand un module a sa configuration construite, le clic sur la roue ouvre **un seul
drawer de configuration pour tout le module**, avec **un onglet par page du module**
(modèle à onglets de `DOCTRINE-DRAWER.md`, `MxTabPanels`) — **ouvert sur l'onglet de la
page courante** (celle depuis laquelle l'utilisateur a cliqué la roue).

Règles, non négociables :

- **Un bloc de configuration = un composant unique**, partagé entre l'onglet concerné de
  ce drawer et la page Réglages globale (`src/pages/settings/`) — **jamais dupliqué**. Si
  un réglage existe déjà dans Réglages, l'onglet du drawer de module l'affiche via le MÊME
  composant, pas une copie réécrite pour l'occasion. Une évolution future d'un bloc de
  réglage ne doit avoir qu'un seul endroit à modifier (même principe que l'ancienne règle
  `config` de `DOCTRINE-BARRE-OUTILS.md`, reprise ici à l'échelle du module plutôt que de
  la page).
- **Un onglet par page du module** qui a une configuration recensée — pas une page sans
  réglage n'a pas d'onglet (comportement identique à l'omission d'un onglet vide ailleurs
  dans le tronc, ex. groupes B/C de `ContratsListMx`).
- **Ouverture sur l'onglet de la page courante** : le drawer doit toujours s'ouvrir sur la
  configuration pertinente pour l'endroit d'où l'utilisateur l'a demandé, pas sur un
  premier onglet arbitraire.
- Tant qu'aucun inventaire des réglages d'un module donné n'a été fait, `configAction`
  reste non fourni pour ce module (voir §3) — c'est l'état actuel de TOUS les modules.

## 5. Référence d'implémentation

`src/layout/ModuleChrome.tsx` (`ModuleChromeView`) pose l'accueil de la roue (§3) — voir
son commentaire d'en-tête (« ROUE DE CONFIGURATION DU MODULE »). Aucun des 9 layouts de
module ne fournit encore `configAction` : ce lot ne change le rendu d'AUCUNE page
existante, il prépare uniquement l'emplacement.
