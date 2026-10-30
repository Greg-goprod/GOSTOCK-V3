import * as React from 'react'

/**
 * Cible de portal scopee.
 *
 * Par defaut `null` -> les composants portalises (pickers, drawers...) rendent
 * dans `document.body` comme aujourd'hui (aucun changement hors ground).
 *
 * Quand un ancetre fournit une valeur (ex: GroundConsoleScope), les popups
 * portalises rendent DANS ce conteneur et heritent donc de ses tokens scopes
 * (theme Console). Cela evite que les popups "fuient" vers le theme global.
 */
const ScopePortalContext = React.createContext<HTMLElement | null>(null)

export const ScopePortalProvider = ScopePortalContext.Provider

export function useScopePortalTarget(): HTMLElement | null {
  return React.useContext(ScopePortalContext)
}
