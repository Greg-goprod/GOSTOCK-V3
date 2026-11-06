import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { confirmAction } from '../../lib/confirm';
import type { PlatformCompany, PlatformModule } from '../../lib/platformConsole';
import Card from '../common/Card';
import Button from '../common/Button';
import { MxBadge } from '../mx/MxBadge';
import { MxEmpty } from '../mx/MxEmpty';

interface Props {
  companyId: string;
  onCompanyChange: (id: string) => void;
  companies: PlatformCompany[];
  modules: PlatformModule[];
  onChanged: () => Promise<void>;
}

// Modules payants : on choisit une entreprise, puis on active ou retire chaque module
const ModulesSection: React.FC<Props> = ({ companyId, onCompanyChange, companies, modules, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (companies.length > 0 && !companies.some(c => c.id === companyId)) onCompanyChange(companies[0].id); }, [companies, companyId, onCompanyChange]);
  const company = companies.find(c => c.id === companyId);

  if (!company) return <MxEmpty icon={CheckCircle} title="Aucune entreprise" description="Crée d'abord une entreprise." />;

  const toggle = async (module: PlatformModule) => {
    if (!supabase || busy) return;
    const enabled = company.modules.includes(module.key);
    const message = enabled
      ? `Retirer « ${module.label} » à « ${company.name} » ? Ses utilisateurs n'y auront plus accès (leurs données sont conservées).`
      : `Activer « ${module.label} » pour « ${company.name} » ?`;
    if (!(await confirmAction(message))) return;
    setBusy(module.key);
    const { error } = await supabase.rpc('platform_set_module', { p_organization_id: company.id, p_module_key: module.key, p_enabled: !enabled });
    setBusy(null);
    if (error) return void toast.error(errorMessage(error));
    toast.success(enabled ? 'Module retiré' : 'Module activé');
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">Entreprise
        <select value={companyId} onChange={e => onCompanyChange(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (suspendue)'}</option>)}
        </select>
      </label>
      <Card>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label={`Modules de ${company.name}`}>
          {modules.map(m => {
            const enabled = company.modules.includes(m.key);
            return (
              <li key={m.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{m.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{m.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {enabled ? <MxBadge tone="success">Activé</MxBadge> : <MxBadge tone="neutral">Non activé</MxBadge>}
                  <Button size="sm" variant={enabled ? 'outline' : 'primary'} icon={enabled ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    loading={busy === m.key} onClick={() => void toggle(m)}>
                    {enabled ? 'Retirer' : 'Activer'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};

export default ModulesSection;
