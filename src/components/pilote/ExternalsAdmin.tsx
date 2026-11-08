import React, { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { externalError, externalLabel, loadExternals, type CpExternal } from '../../lib/externals';
import type { PiloteRights } from '../../lib/pilote';
import { CrudSection } from '../sitePlanning/CrudSection';
import { MxBadge } from '../mx/MxBadge';

// Réglages › Intervenants externes : la liste des personnes sans compte qu'on peut assigner aux tâches (nom, société, note). Désactiver un intervenant le retire des
// choix proposés sans le retirer des tâches où il est déjà ; le supprimer le retire de toutes.
const ExternalsAdmin: React.FC<{ rights: PiloteRights }> = ({ rights }) => {
  const [rows, setRows] = useState<CpExternal[]>([]);
  const reload = useCallback(async () => { setRows(await loadExternals()); }, []);
  useEffect(() => { void reload(); }, [reload]);
  // Écrire des intervenants demande le droit de MODIFIER les projets (la base l'impose)
  const write = { create: rights.update, update: rights.update, delete: rights.update };
  return (
    <CrudSection<CpExternal>
      title="Intervenants externes" addLabel="Nouvel intervenant" table="cp_externals" rights={write} onChanged={reload} errorText={externalError} rows={rows}
      emptyIcon={Users} emptyTitle="Aucun intervenant externe" emptyText="Ajoute les personnes sans compte GO-Mat (prestataires, électriciens…) pour pouvoir les assigner aux tâches."
      deleteMessage={e => `Supprimer « ${externalLabel(e)} » ? Il sera retiré de toutes les tâches où il est assigné.`}
      fields={[
        { key: 'name', label: 'Nom', type: 'text', required: true },
        { key: 'company', label: 'Société', type: 'text' },
        { key: 'note', label: 'Note', type: 'textarea' },
        { key: 'active', label: 'Actif (proposé dans les choix)', type: 'checkbox' },
      ]}
      columns={[
        { id: 'name', label: 'Nom', render: e => <span className="font-medium">{e.name}</span> },
        { id: 'company', label: 'Société', render: e => e.company ?? '—' },
        { id: 'note', label: 'Note', hideOnMobile: true, render: e => <span className="text-gray-600 dark:text-gray-400">{e.note ?? ''}</span> },
        { id: 'active', label: 'État', render: e => <MxBadge tone={e.active ? 'success' : 'neutral'}>{e.active ? 'Actif' : 'Inactif'}</MxBadge> },
      ]}
    />
  );
};

export default ExternalsAdmin;
