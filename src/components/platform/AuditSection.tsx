import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '../../lib/requests';
import { AUDIT_LABELS, formatDateTime, loadPlatformAudit, type PlatformAuditRow, type PlatformModule } from '../../lib/platformConsole';
import Button from '../common/Button';
import { EntityTable } from '../common/EntityTable';
import { MxEmpty } from '../mx/MxEmpty';

// Journal des actions de la plateforme (en ajout seul : personne ne peut le modifier)
const AuditSection: React.FC<{ modules: PlatformModule[] }> = ({ modules }) => {
  const [rows, setRows] = useState<PlatformAuditRow[] | null>(null);

  const load = useCallback(async () => {
    try { setRows(await loadPlatformAudit()); } catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const detail = (r: PlatformAuditRow) => {
    const key = typeof r.metadata?.module === 'string' ? r.metadata.module : null;
    if (key) return modules.find(m => m.key === key)?.label ?? key;
    return typeof r.metadata?.admin_email === 'string' ? `Administrateur : ${r.metadata.admin_email}` : '';
  };

  if (rows === null) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  if (rows.length === 0) return <MxEmpty icon={ScrollText} title="Journal vide" description="Les actions de la plateforme (création, suspension, modules) apparaîtront ici." />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">Journal en ajout seul : chaque action y reste, personne ne peut la modifier ni la supprimer.</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>Actualiser</Button>
      </div>
      <EntityTable
        items={rows}
        getKey={r => r.id}
        caption="Journal de la plateforme"
        columns={[
          { id: 'at', label: 'Date', render: r => <span className="whitespace-nowrap">{formatDateTime(r.at)}</span> },
          { id: 'action', label: 'Action', render: r => <span className="font-medium">{AUDIT_LABELS[r.action] ?? r.action}</span> },
          { id: 'target', label: 'Entreprise', render: r => r.target_name ?? '—' },
          { id: 'detail', label: 'Détail', hideOnMobile: true, render: detail },
          { id: 'actor', label: 'Par', hideOnMobile: true, render: r => r.actor_email ?? '—' },
        ]}
      />
    </div>
  );
};

export default AuditSection;
