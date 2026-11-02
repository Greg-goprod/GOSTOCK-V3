import React, { useState } from 'react';
import { Building2, Plus, Power, PowerOff, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { confirmAction } from '../../lib/confirm';
import { formatBytes, formatDateTime, type PlatformCompany, type PlatformModule, type PlatformUsage } from '../../lib/platformConsole';
import Card from '../common/Card';
import Button from '../common/Button';
import { EntityTable } from '../common/EntityTable';
import { MxCardGrid } from '../mx/MxCardGrid';
import { CompanyCard } from './CompanyCard';
import { MxBadge } from '../mx/MxBadge';
import { MxEmpty } from '../mx/MxEmpty';
import { MxEntityViewToggle } from '../mx/MxEntityViewToggle';
import { readMxViewMode, writeMxViewMode } from '../mx/mxViewModeStorage';

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  companies: PlatformCompany[];
  usage: Map<string, PlatformUsage>;
  modules: PlatformModule[];
  onChanged: () => Promise<void>;
  onManageModules: (companyId: string) => void;
}

const CompaniesSection: React.FC<Props> = ({ companies, usage, modules, onChanged, onManageModules }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', first: '', last: '' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  const [viewMode, setViewModeState] = useState<'cards' | 'list'>(() => readMxViewMode('gomat-view-companies', ['cards', 'list'] as const, 'cards'));
  const setViewMode = (mode: 'cards' | 'list') => { setViewModeState(mode); writeMxViewMode('gomat-view-companies', mode); };
  const moduleLabel = (key: string) => modules.find(m => m.key === key)?.label ?? key;

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !supabase) return;
    setSaving(true);
    const { error } = await supabase.rpc('platform_create_organization', {
      p_name: form.name, p_admin_email: form.email, p_admin_first_name: form.first, p_admin_last_name: form.last,
    });
    setSaving(false);
    if (error) return void toast.error(errorMessage(error));
    toast.success(`Entreprise « ${form.name.trim()} » créée`);
    setCreated({ name: form.name.trim(), email: form.email.trim().toLowerCase() });
    setForm({ name: '', email: '', first: '', last: '' });
    await onChanged();
  };

  const toggle = async (row: PlatformCompany) => {
    if (!supabase) return;
    const next = !row.active;
    const message = next
      ? `Réactiver « ${row.name} » ? Ses utilisateurs retrouvent l'accès.`
      : `Suspendre « ${row.name} » ? Ses utilisateurs n'auront plus accès à l'application (leurs données sont conservées).`;
    if (!(await confirmAction(message))) return;
    const { error } = await supabase.rpc('platform_set_organization_active', { p_organization_id: row.id, p_active: next });
    if (error) return void toast.error(errorMessage(error));
    toast.success(next ? 'Entreprise réactivée' : 'Entreprise suspendue');
    await onChanged();
  };

  const stateBadge = (r: PlatformCompany) => (r.active ? <MxBadge tone="success">Active</MxBadge> : <MxBadge tone="danger">Suspendue</MxBadge>);
  const actionButton = (r: PlatformCompany) => (
    <Button size="sm" variant={r.active ? 'outline' : 'primary'} icon={r.active ? <PowerOff size={14} /> : <Power size={14} />} onClick={() => void toggle(r)}>
      {r.active ? 'Suspendre' : 'Réactiver'}
    </Button>
  );

  return (
    <div className="space-y-6">
      {!showForm && companies.length > 0 && (
        <div><Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>Nouvelle entreprise</Button></div>
      )}
      {(showForm || companies.length === 0) && <Card>
        <form onSubmit={create} className="space-y-4" aria-label="Nouvelle entreprise">
          <h2 className="font-bold text-gray-900 dark:text-white">Nouvelle entreprise</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Nom de l'entreprise
              <input className={`${inputClass} mt-1`} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Prénom de l'administrateur
              <input className={`${inputClass} mt-1`} value={form.first} onChange={e => setForm({ ...form, first: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nom de l'administrateur
              <input className={`${inputClass} mt-1`} value={form.last} onChange={e => setForm({ ...form, last: e.target.value })} required />
            </label>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">E-mail de l'administrateur
              <input type="email" className={`${inputClass} mt-1`} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" icon={<Plus size={16} />} loading={saving}>Créer l'entreprise</Button>
            {companies.length > 0 && <Button variant="outline" onClick={() => setShowForm(false)}>Fermer</Button>}
          </div>
          {created && (
            <p className="text-sm text-gray-700 dark:text-gray-300" role="status">
              {`« ${created.name} » est créée, sans module activé. Demande à ${created.email} de se connecter avec cette adresse : sa fiche d'administrateur s'active à la première connexion. Active ses modules dans l'onglet Modules.`}
            </p>
          )}
        </form>
      </Card>}

      {companies.length === 0 ? (
        <MxEmpty icon={Building2} title="Aucune entreprise" description="Crée la première entreprise ci-dessus." />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end"><MxEntityViewToggle value={viewMode} onChange={setViewMode} aria-label="Affichage des entreprises" /></div>
          {viewMode === 'list' ? (
            <EntityTable
              items={companies}
              getKey={r => r.id}
              caption="Entreprises"
              columns={[
                { id: 'name', label: 'Entreprise', render: r => <span className="font-medium">{r.name}</span> },
                { id: 'state', label: 'État', render: stateBadge },
                { id: 'people', label: 'Personnes', render: r => `${usage.get(r.id)?.people_active ?? r.people} (${r.admins} adm.)` },
                { id: 'last', label: 'Dernière connexion', hideOnMobile: true, render: r => formatDateTime(usage.get(r.id)?.last_sign_in ?? null) },
                { id: 'equipment', label: 'Articles', hideOnMobile: true, render: r => usage.get(r.id)?.equipment ?? 0 },
                { id: 'checkouts', label: 'Sorties (30 j)', hideOnMobile: true, render: r => usage.get(r.id)?.checkouts_30d ?? 0 },
                { id: 'storage', label: 'Stockage', hideOnMobile: true, render: r => formatBytes(usage.get(r.id)?.storage_bytes ?? 0) },
                { id: 'modules', label: 'Modules', hideOnMobile: true, render: r => (r.modules.length ? r.modules.map(moduleLabel).join(', ') : <span className="text-gray-500">Aucun</span>) },
                { id: 'action', label: 'Action', render: r => <span className="inline-flex gap-2">{actionButton(r)}<Button size="sm" variant="outline" icon={<SlidersHorizontal size={14} />} onClick={() => onManageModules(r.id)}>Modules</Button></span> },
              ]}
            />
          ) : (
            <MxCardGrid
              items={companies}
              getItemKey={r => r.id}
              renderItem={r => (
                <CompanyCard company={r} usage={usage.get(r.id)} modules={modules} onToggleActive={() => void toggle(r)} onManageModules={() => onManageModules(r.id)} />
              )}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CompaniesSection;
