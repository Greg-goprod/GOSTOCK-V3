import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/requests';
import { ROLE_LABELS } from '../lib/roles';
import { REQUEST_STATUS, VEHICLE_STATUS } from '../lib/requests';
import PageTitle from '../components/common/PageTitle';
import { PageCommands } from '../components/Layout/ModuleHeader';

interface AuditEntry {
  id: number;
  at: string;
  user_id: string | null;
  table_name: string;
  record_id: string | null;
  action: 'insert' | 'update' | 'delete';
  changes: Record<string, unknown>;
}

const TABLES: Record<string, string> = {
  users: 'Personne',
  user_depots: 'Dépôts d\'une personne',
  equipment: 'Article',
  requests: 'Demande',
  checkouts: 'Sortie',
  vehicles: 'Véhicule',
  system_settings: 'Réglage',
  organizations: 'Entreprise',
  depots: 'Dépôt',
  maintenance_plans: 'Plan d\'entretien',
  purchase_orders: 'Commande fournisseur',
  incidents: 'Perte / casse',
  notification_recipients: 'Destinataire d\'alertes',
  consumable_stock: 'Stock / seuil',
  sites: 'Chantier',
  kits: 'Kit',
  kit_items: 'Contenu de kit',
  trainings: 'Formation',
  user_trainings: 'Formation d\'une personne',
  rentals: 'Location',
  storage_bins: 'Emplacement',
  transfers: 'Transfert',
  ppe_types: 'Type d\'EPI',
  ppe_issues: 'EPI remis',
  repair_orders: 'Réparation',
};

const ACTIONS = { insert: 'Création', update: 'Modification', delete: 'Suppression' };
const PAGE = 100;

// Champs lisibles dans le journal (les autres restent visibles sous leur nom technique)
const FIELD_LABELS: Record<string, string> = {
  role: 'rôle', permissions: 'droits', active: 'accès actif', email: 'e-mail', name: 'nom', status: 'état',
  min_quantity: 'seuil', total_quantity: 'quantité totale', purchase_price: 'prix d\'achat', daily_rate: 'tarif / jour',
  decision: 'décision', cost: 'coût', decided_by: 'décidé par', due_date: 'retour prévu', return_date: 'rendu le',
  first_name: 'prénom', last_name: 'nom de famille', value: 'valeur', license_categories: 'permis', article_series: 'série',
  decided_at: 'décidée le', start_at: 'début', end_at: 'fin', destination: 'chantier ou service', notes: 'remarque', needs_approval: 'validation requise',
  approval_reason: 'motif de validation', picked_up_by: 'retiré par', issued_at: 'sortie le', closed_at: 'clôturée le', number: 'numéro',
  quantity: 'quantité', description: 'description', image_url: 'image', requires_approval: 'validation requise', requires_signature: 'signature requise',
  decision_note: 'note de décision', sent_at: 'envoyé le', received: 'reçu', returned_on: 'rendu le', expected_on: 'retour prévu', repairer: 'réparateur',
  plate: 'plaque', current_km: 'kilomètrage', budget: 'budget', client: 'client', address: 'adresse', start_on: 'début', end_on: 'fin',
  access_until: 'accès jusqu\'au', department: 'service', phone: 'téléphone', last_login_at: 'dernière connexion', title: 'titre', reason: 'motif',
};
// Champs techniques sans intérêt pour le lecteur
const HIDDEN_FIELDS = new Set(['id', 'organization_id', 'created_at', 'updated_at', 'search_text', 'delivery_note_id']);
// Valeurs d'état lisibles (demandes, véhicules) au lieu des mots techniques
const STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(REQUEST_STATUS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(VEHICLE_STATUS).map(([k, v]) => [k, v.label])),
  active: 'actif', overdue: 'en retard', returned: 'rendu', in_transit: 'en route', received: 'réceptionné', open: 'ouvert', draft: 'brouillon', sent: 'envoyée',
  pending: 'à décider', replaced: 'remplacé', lost: 'perdu', found: 'retrouvé',
};
const humanize = (key: string) => FIELD_LABELS[key] ?? key.replace(/_/g, ' ');

const show = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '∅';
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`).toLocaleDateString('fr-CH');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' });
  if (Array.isArray(value)) return value.length ? value.join(', ') : '∅';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Journal : qui a modifié quoi et quand (personnes et rôles, stock, demandes, réglages…)
const AuditLog: React.FC = () => {
  const { users } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [table, setTable] = useState('');
  const [person, setPerson] = useState('');
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = async (offset = 0) => {
    setLoading(true);
    let query = supabase.from('audit_log').select('*').order('at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (table) query = query.eq('table_name', table);
    if (person) query = query.eq('user_id', person);
    const { data, error } = await query;
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    const rows = (data || []) as AuditEntry[];
    setEntries(prev => (offset === 0 ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, person]);

  const name = (id: string | null) => {
    if (!id) return 'Système';
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : 'Personne supprimée';
  };

  const describe = (e: AuditEntry) => {
    if (e.action !== 'update') {
      const c = e.changes as Record<string, unknown>;
      return [c.name, c.number, c.first_name && `${c.first_name} ${c.last_name ?? ''}`, c.email, c.id && !c.name && !c.number ? c.id : null]
        .filter(Boolean).map(String).slice(0, 2).join(' · ');
    }
    return Object.entries(e.changes as Record<string, [unknown, unknown]>)
      .filter(([key]) => !HIDDEN_FIELDS.has(key))
      .map(([key, [before, after]]) => {
        // Référence à une autre fiche (dépôt, personne…) : un identifiant ne se lit pas
        if (key.endsWith('_id')) return `${humanize(key.slice(0, -3))} modifié`;
        const label = (v: unknown) => (key === 'role' ? ROLE_LABELS[v as keyof typeof ROLE_LABELS] ?? show(v)
          : (key === 'status' || key === 'decision') && typeof v === 'string' ? STATUS_LABELS[v] ?? show(v) : show(v));
        return `${humanize(key)} : ${label(before)} → ${label(after)}`;
      })
      .join(' · ') || 'Mise à jour technique';
  };

  const inputClass = 'rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

  return (
    <div className="space-y-6">
      <div>
          <PageTitle>Journal</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Chaque modification : qui, quand, avant → après. Les recalculs automatiques ne sont pas listés.</p>
      </div>
      <PageCommands filters={<div className="flex flex-wrap gap-2">
        <select value={table} onChange={e => setTable(e.target.value)} aria-label="Type" className={inputClass}>
          <option value="">Tout</option>
          {Object.entries(TABLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={person} onChange={e => setPerson(e.target.value)} aria-label="Personne" className={inputClass}>
          <option value="">Tout le monde</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
        </select>
      </div>} />

      <ul className="rounded-lg bg-white dark:bg-gray-800 shadow divide-y divide-gray-200 dark:divide-gray-700">
        {entries.length === 0 && !loading && <li className="p-4 text-sm text-gray-600 dark:text-gray-400">Aucune entrée.</li>}
        {entries.map(e => (
          <li key={e.id} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {ACTIONS[e.action]} · {TABLES[e.table_name] ?? e.table_name}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {new Date(e.at).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'medium' })} · {name(e.user_id)}
              </span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 break-words">{describe(e)}</p>
          </li>
        ))}
      </ul>

      {more && entries.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(entries.length)} loading={loading}>Plus ancien</Button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
