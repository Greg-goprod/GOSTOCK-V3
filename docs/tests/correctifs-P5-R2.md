# Correctifs proposés — P5 et R2

À l'attention de la session qui a fait les corrections (`3037948`, `d401aaf`). Constats et preuves : `docs/tests/rapport-chrome.md`, section 0.

---

## P5 — CRITIQUE — Revenir sur l'onglet démonte toute l'application

### Mécanisme (vérifié)
1. `@supabase/auth-js` 2.118 : à chaque `visibilitychange` vers `visible`, `_onVisibilityChanged` → `_recoverAndRefresh` → `_notifyAllSubscribers('SIGNED_IN', session)` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, ligne 4155), même si la session et l'utilisateur n'ont pas changé.
2. `src/contexts/AuthContext.tsx`, ligne 65 : sur `SIGNED_IN`, `setLoading(true)`, puis rechargement du profil.
3. `src/components/auth/AuthGate.tsx`, ligne 19 : `if (loading) return <… Chargement…>`. Tout l'arbre de l'application est démonté, puis remonté environ 100 ms plus tard, sans son état.

Conséquence : fenêtres, formulaires, préparations et panier du comptoir perdus dès que l'utilisateur change d'application et revient.

### Correctif 1 (indispensable) — `src/contexts/AuthContext.tsx`

Ne repasser en chargement que si l'utilisateur change réellement.

```tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// dans AuthProvider
const userIdRef = useRef<string | null>(null);

useEffect(() => {
  let active = true;
  supabase.auth.getSession().then(async ({ data }) => {
    if (!active) return;
    userIdRef.current = data.session?.user.id ?? null;
    setSession(data.session);
    await loadProfile(data.session);
    if (active) setLoading(false);
  });

  const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
    // Même jeton : on garde l'objet actuel pour ne pas relancer les effets qui dépendent de la session
    setSession(prev => (prev?.access_token === next?.access_token ? prev : next));

    const nextId = next?.user.id ?? null;
    const userChanged = nextId !== userIdRef.current;
    userIdRef.current = nextId;

    // Changement de personne (connexion, déconnexion) : écran de chargement le temps du profil
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userChanged)) {
      setLoading(true);
      setTimeout(async () => {
        await loadProfile(next);
        setLoading(false);
      }, 0);
      return;
    }
    // Même personne (retour sur l'onglet, profil modifié) : profil rechargé en arrière-plan, rien n'est démonté
    if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
      setTimeout(() => { loadProfile(next); }, 0);
    }
  });

  return () => {
    active = false;
    subscription.subscription.unsubscribe();
  };
}, [loadProfile]);
```

Points d'attention :
- `loadProfile` en arrière-plan ne doit pas vider le profil pendant l'appel (c'est déjà le cas : `setProfile` n'est appelé qu'à la fin).
- Le recalage `setSession(prev => …)` évite que les `useEffect` qui dépendent de `session` rechargent toutes les données à chaque retour sur l'onglet.

### Correctif 2 (recommandé, défense en profondeur) — `src/components/auth/AuthGate.tsx`

Le plein écran « Chargement… » ne doit servir qu'au tout premier chargement. Exposer un `initializing` (vrai jusqu'à la fin du premier `getSession` + profil) et ne remplacer l'arbre que dans ce cas. Pour un changement d'utilisateur, la page de connexion (`!session`) ou un indicateur discret suffit.

### Vérification
1. Ouvrir « Nouvelle demande », saisir des valeurs, passer sur un autre onglet ou une autre application pendant quelques secondes, puis revenir : le formulaire est intact.
2. Au comptoir : scanner un badge et un article, changer d'onglet, revenir : la personne et le panier sont conservés.
3. Dans la console, journaliser les événements (`supabase.auth.onAuthStateChange((e) => console.log(e))`) : `SIGNED_IN` s'affiche au retour sur l'onglet, mais aucun écran « Chargement… » n'apparaît.
4. Se déconnecter puis se reconnecter avec un autre compte : l'écran de chargement apparaît normalement et le bon profil est chargé.
5. Test automatisé suggéré : simuler un `SIGNED_IN` avec le même `user.id` et vérifier que `loading` reste `false`.

---

## R2 — MINEUR — Formulaire d'outil : « Suivant » hors écran, « URL de l'image » masqué

### Mécanisme (vérifié)
- `src/components/common/Accordion.tsx`, ligne 58 (et `AccordionCard.tsx`, ligne 47) : section ouverte = `max-h-screen opacity-100 … overflow-hidden`. Un contenu plus haut que l'écran (1141 px de formulaire pour un écran de 1018 px) est **coupé**.
- `src/styles/gomat-mx.css`, ligne 277 : le pied de formulaire est rendu collant (`position: sticky`) dans les panneaux. Comme son ancêtre direct est la section `overflow: hidden`, il colle au bas de cette section (elle-même coupée), et non au bas du panneau qui défile. Résultat : « Suivant » n'apparaît qu'après défilement, et il recouvre le dernier champ, qui n'est plus atteignable.
- `Accordion` et `AccordionCard` sont utilisés 41 fois : tout contenu de section plus haut que l'écran est potentiellement coupé ailleurs aussi.

### Correctif 1 (indispensable) — `Accordion.tsx` et `AccordionCard.tsx`

Une section ouverte ne doit ni borner sa hauteur ni couper son contenu :

```tsx
<div className={`transition-[max-height,opacity] duration-300 ease-in-out ${
  isOpen ? 'max-h-none opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'
} ${contentClassName}`}>
```

L'animation d'ouverture devient instantanée (on ne peut pas animer vers `max-h-none`). Pour la garder : animation sur `grid-template-rows` (`grid-rows-[0fr]` → `grid-rows-[1fr]`) avec `overflow-hidden` **uniquement pendant la transition**, puis `overflow-visible` sur `transitionend`. Sinon le pied collant reste prisonnier de la section.

### Correctif 2 (recommandé) — pied hors des sections

Dans `AddEquipmentModal.tsx` (vers la ligne 745) et `EditEquipmentModal.tsx` (vers la ligne 731), sortir la barre « Annuler / Suivant » de l'`Accordion` et la placer dans le pied du panneau (`.mx-drawer-footer`). Le bouton reste rattaché au formulaire par son attribut `form` :

```tsx
<form id="equipment-basic-form" onSubmit={handleBasicSubmit} className="space-y-4">…</form>
…
<div className="mx-drawer-footer flex justify-end gap-3">
  <Button variant="outline" onClick={onClose}>Annuler</Button>
  <Button variant="primary" type="submit" form="equipment-basic-form">Suivant</Button>
</div>
```

Même traitement pour l'étape 2 (« Retour / Annuler / Créer le matériel » et « Modifier le matériel »).

### Vérification
1. Écran d'environ 1000 px de haut : ouvrir « Ajouter un équipement ». « Suivant » est visible en bas du panneau **sans défiler**.
2. Défiler jusqu'en bas : « URL de l'image » est entièrement visible et cliquable, au-dessus du pied.
3. Même contrôle dans « Modifier », aux deux étapes.
4. Parcourir quelques autres sections longues (Paramètres, catalogues) : plus aucun contenu coupé en bas.

---

## Hors périmètre, à traiter ensuite (mineurs)

- **R1** : dialogues fermés (« Confirmation », « Menu », « Filtres ») toujours exposés avec `role="dialog"`. Ajouter `aria-hidden="true"` et `inert` quand ils sont fermés, et vider le texte du dialogue de confirmation à la fermeture.
- **R3** : ne suggérer dans « Chantier ou service » que les chantiers qui ont une fiche.
