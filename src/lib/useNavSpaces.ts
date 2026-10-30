import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccess } from './access';
import { NAV_SPACES, NavSpace } from './navigation';

// Espaces et pages visibles selon les droits de la personne connectée
export function useNavSpaces(): NavSpace[] {
  const { can } = useAuth();
  return useMemo(() => NAV_SPACES
    .map(space => ({ ...space, links: space.links.filter(link => canAccess(link.to, can)) }))
    .filter(space => space.links.length > 0), [can]);
}
