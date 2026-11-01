import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { confirmAction } from '../lib/confirm';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import PageTitle from '../components/common/PageTitle';
import { MxCardGrid } from '../components/mx/MxCardGrid';
import { MxEntityCard } from '../components/mx/MxEntityCard';
import { MxBadge } from '../components/mx/MxBadge';
import { MxEmpty } from '../components/mx/MxEmpty';

interface OrganizationRow {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  people: number;
  admins: number;
}

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Console de la plateforme : créer et suspendre les entreprises clientes (réservé à l'administrateur de la plateforme)
const Organizations: React.FC = () => {
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', first: '', last: '' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('platform_list_organizations');
    if (error) toast.error(errorMessage(error));
    else setRows((data || []) as OrganizationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const { error } = await supabase.rpc('platform_create_organization', {
      p_name: form.name, p_admin_email: form.email, p_admin_first_name: form.first, p_admin_last_name: form.last,
    });
    setSaving(false);
    if (error) return void toast.error(errorMessage(error));
    toast.success(`Entreprise « ${form.name.trim()} » créée`);
    setCreated({ name: form.name.trim(), email: form.email.trim().toLowerCase() });
    setForm({ name: '', email: '', first: '', last: '' });
    await load();
  };

  const toggle = async (row: OrganizationRow) => {
    const next = !row.active;
    const message = next
      ? `Réactiver « ${row.name} » ? Ses utilisateurs retrouvent l'accès.`
      : `Suspendre « ${row.name} » ? Ses utilisateurs n'auront plus accès à l'application (leurs données sont conservées).`;
    if (!(await confirmAction(message))) return;
    const { error } = await supabase.rpc('platform_set_organization_active', { p_organization_id: row.id, p_active: next });
    if (error) return void toast.error(errorMessage(error));
    toast.success(next ? 'Entreprise réactivée' : 'Entreprise suspendue');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Entreprises</PageTitle>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Les entreprises clientes de la plateforme. Chacune ne voit que ses données. Seul toi (administrateur de la plateforme) peux en créer ou en suspendre.
        </p>
      </div>

      <Card>
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
          <Button type="submit" icon={<Plus size={16} />} loading={saving}>Créer l'entreprise</Button>
          {created && (
            <p className="text-sm text-gray-700 dark:text-gray-300" role="status">
              {`« ${created.name} » est créée. Demande à ${created.email} de se connecter avec cette adresse : sa fiche d'administrateur s'active à la première connexion.`}
            </p>
          )}
        </form>
      </Card>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>
      ) : rows.length === 0 ? (
        <MxEmpty icon={Building2} title="Aucune entreprise" description="Crée la première entreprise ci-dessus." />
      ) : (
        <MxCardGrid
          items={rows}
          getItemKey={r => r.id}
          renderItem={r => (
            <MxEntityCard
              avatarName={r.name}
              title={r.name}
              infoParts={[
                { content: `${r.people} personne(s) active(s) · ${r.admins} administrateur(s)` },
                { content: `Créée le ${format(new Date(r.created_at), 'dd.MM.yyyy', { locale: fr })}` },
              ]}
              statusBadge={r.active ? <MxBadge tone="success">Active</MxBadge> : <MxBadge tone="danger">Suspendue</MxBadge>}
              menuLabel={`Actions pour ${r.name}`}
              menuActions={[
                r.active
                  ? { id: 'suspend', label: 'Suspendre', icon: PowerOff, tone: 'danger' as const, onSelect: () => void toggle(r) }
                  : { id: 'activate', label: 'Réactiver', icon: Power, onSelect: () => void toggle(r) },
              ]}
              onOpen={() => undefined}
            />
          )}
        />
      )}
    </div>
  );
};

export default Organizations;
