import React, { useEffect, useState } from 'react';
import { Mail, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { useApp } from '../../contexts/AppContext';
import { confirmAction } from '../../lib/confirm';

interface Recipient {
  id: string;
  name: string;
  email: string;
  kinds: string[];
  depot_id: string | null;
  active: boolean;
}

const KINDS = [
  { id: 'low_stock', label: 'Stock bas' },
  { id: 'request_to_approve', label: 'Demandes à valider' },
  { id: 'vehicle_deadline', label: 'Échéances véhicules' },
  { id: 'maintenance_due', label: 'Entretiens et contrôles OIBT' },
  { id: 'tool_damaged', label: 'Outils rendus abîmés' },
  { id: 'incident', label: 'Pertes, vols, casse' },
  { id: 'return_escalation', label: 'Retards de plus de 3 jours' },
  { id: 'inventory_gap', label: "Écarts d'inventaire (outils)" },
  { id: 'monthly_report', label: 'Rapport mensuel' },
  { id: 'rental_due', label: 'Locations à rendre / en retard' },
  { id: 'training_expiry', label: 'Formations à renouveler' },
  { id: 'transfer', label: 'Transferts entre dépôts' },
  { id: 'ppe_renewal', label: 'EPI à renouveler' },
  { id: 'mission_end', label: 'Fins de mission (intérimaires)' },
  { id: 'warranty_end', label: 'Fins de garantie' },
  { id: 'repair_late', label: 'Réparations en retard' },
  { id: 'battery_end', label: 'Batteries en fin de vie' },
  { id: 'drop_box', label: 'Boîte de retour' },
  { id: 'tool_found', label: 'Outils trouvés' },
  { id: 'backup_due', label: 'Rappel de sauvegarde' },
];

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

// Destinataires des alertes envoyées par e-mail (fonction send-notification-emails)
const NotificationRecipients: React.FC = () => {
  const { depots } = useApp();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [form, setForm] = useState({ name: '', email: '', depotId: '', kinds: KINDS.map(k => k.id) });
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('notification_recipients').select('*').order('name');
    if (error) toast.error(errorMessage(error));
    setRecipients((data || []) as Recipient[]);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.kinds.length) {
      toast.error('Choisissez au moins un type d\'alerte');
      return;
    }
    const { error } = await supabase.from('notification_recipients').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      kinds: form.kinds,
      depot_id: form.depotId || null,
    });
    if (error) {
      toast.error(error.code === '23505' ? 'Cette adresse est déjà dans la liste' : errorMessage(error));
      return;
    }
    setForm({ name: '', email: '', depotId: '', kinds: KINDS.map(k => k.id) });
    await load();
  };

  const update = async (id: string, changes: Partial<Recipient>) => {
    const { error } = await supabase.from('notification_recipients').update(changes).eq('id', id);
    if (error) toast.error(errorMessage(error));
    await load();
  };

  const remove = async (recipient: Recipient) => {
    if (!await confirmAction(`Retirer ${recipient.email} des destinataires ?`)) return;
    const { error } = await supabase.from('notification_recipients').delete().eq('id', recipient.id);
    if (error) toast.error(errorMessage(error));
    await load();
  };

  const sendTest = async (recipient: Recipient) => {
    setTesting(recipient.id);
    const { data, error } = await supabase.functions.invoke('send-notification-emails', { body: { test: recipient.email } });
    setTesting(null);
    if (error) {
      // Le message utile est dans le corps de la réponse d'erreur
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
      toast.error(detail?.error || errorMessage(error));
      return;
    }
    if (data?.sent) toast.success(`E-mail de test envoyé à ${recipient.email}`);
  };

  const toggleKind = (kinds: string[], kind: string) =>
    kinds.includes(kind) ? kinds.filter(k => k !== kind) : [...kinds, kind];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Les alertes partent par e-mail dans les 5 minutes, via le service d'envoi de Mannyx. Un destinataire limité
        à un dépôt ne reçoit que les alertes de ce dépôt.
      </p>

      {recipients.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
          {recipients.map(r => (
            <li key={r.id} className="p-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className={`text-sm font-medium ${r.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 line-through'}`}>{r.name}</div>
                <div className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">{r.email}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {KINDS.map(k => (
                    <label key={k.id} className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={r.kinds.includes(k.id)}
                        onChange={() => update(r.id, { kinds: toggleKind(r.kinds, k.id) })}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      {k.label}
                    </label>
                  ))}
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    · {r.depot_id ? depots.find(d => d.id === r.depot_id)?.name ?? 'Dépôt supprimé' : 'Tous les dépôts'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" icon={<Send size={14} />} onClick={() => sendTest(r)} disabled={testing === r.id}>
                  {testing === r.id ? 'Envoi…' : 'Tester'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => update(r.id, { active: !r.active })}>
                  {r.active ? 'Suspendre' : 'Réactiver'}
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => remove(r)} ariaLabel={`Retirer ${r.email}`} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="recipient-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
          <input id="recipient-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required placeholder="ex. Magasin principal" />
        </div>
        <div>
          <label htmlFor="recipient-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
          <input id="recipient-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} required placeholder="magasin@exemple.ch" />
        </div>
        <div>
          <label htmlFor="recipient-depot" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dépôt</label>
          <select id="recipient-depot" value={form.depotId} onChange={e => setForm({ ...form, depotId: e.target.value })} className={inputClass}>
            <option value="">Tous les dépôts</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alertes reçues</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {KINDS.map(k => (
              <label key={k.id} className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={form.kinds.includes(k.id)}
                  onChange={() => setForm({ ...form, kinds: toggleKind(form.kinds, k.id) })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <Button type="submit" variant="primary" icon={<Mail size={16} />}>AJOUTER LE DESTINATAIRE</Button>
        </div>
      </form>
    </div>
  );
};

export default NotificationRecipients;
