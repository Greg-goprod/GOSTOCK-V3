import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Ce que la personne connectée peut faire dans la discussion et les documents d'un projet : écrire (équipe du projet ou responsable) et modérer
// (droit de suppression). C'est la base qui décide ; l'écran le lui demande pour ne proposer que ce qui sera accepté.
export function useProjectRights(projectId: string): { canWrite: boolean; canModerate: boolean } {
  const [rights, setRights] = useState({ canWrite: false, canModerate: false });
  useEffect(() => {
    let live = true;
    void (async () => {
      const [w, m] = await Promise.all([
        supabase.rpc('cp_can_discuss', { p_project: projectId }),
        supabase.rpc('rbac_has_any_permission', { p_keys: ['cp.projects:delete'] }),
      ]);
      if (live) setRights({ canWrite: !w.error && w.data === true, canModerate: !m.error && m.data === true });
    })();
    return () => { live = false; };
  }, [projectId]);
  return rights;
}
