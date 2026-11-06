import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { Permission, PERMISSION_LABELS, ROLE_LABELS, ROLE_PERMISSIONS } from '../../lib/roles';
import { errorMessage } from '../../lib/requests';
import DateInput from '../common/DateInput';
import { LICENSE_CATEGORIES } from '../../lib/licenses';
import { accessExpired } from '../../lib/people';
import { confirmAction } from '../../lib/confirm';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User;
}

type Role = User['role'];

const ROLE_HINTS: Record<Role, string> = {
  admin: 'Tout, y compris les réglages et les autres administrateurs.',
  manager: 'Valide les demandes, gère les personnes, le stock et la flotte, tous les dépôts.',
  technician: 'Scanne, prépare, sort et reprend le matériel, gère le stock de ses dépôts.',
  user: 'Fait ses demandes et voit le matériel qu\'il a emprunté. Ne scanne jamais.',
};

// Droits proposés « à la carte » (réglages : réservé au rôle administrateur)
const EXTRA_PERMISSIONS: Permission[] = ['scan', 'approve', 'manage_stock', 'manage_fleet', 'view_all', 'manage_people', 'all_depots'];

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department: '',
  role: 'user' as Role,
  permissions: [] as Permission[],
  active: true,
  license_categories: [] as string[],
  license_expires_on: '',
  person_kind: 'employee' as 'employee' | 'temp' | 'subcontractor',
  company: '',
  access_until: '',
  deposit_amount: '',
  deposit_paid_on: '',
  deposit_returned_on: '',
};

// Catégories de permis suisses courantes pour la flotte

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user }) => {
  const { depots, refreshUsers } = useApp();
  const { profile, refreshProfile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [form, setForm] = useState(emptyForm);
  const [depotIds, setDepotIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '',
        department: user.department || '',
        role: user.role,
        permissions: (user.permissions || []) as Permission[],
        active: user.active !== false,
        license_categories: user.licenseCategories || [],
        license_expires_on: user.licenseExpiresOn || '',
        person_kind: user.personKind ?? 'employee',
        company: user.company || '',
        access_until: user.accessUntil || '',
        deposit_amount: user.depositAmount != null ? String(user.depositAmount) : '',
        deposit_paid_on: user.depositPaidOn || '',
        deposit_returned_on: user.depositReturnedOn || '',
      });
      supabase.from('user_depots').select('depot_id').eq('user_id', user.id)
        .then(({ data }) => setDepotIds((data || []).map(d => d.depot_id)));
    } else {
      setForm(emptyForm);
      setDepotIds([]);
    }
  }, [isOpen, user]);

  const inherited = ROLE_PERMISSIONS[form.role];
  const effective = new Set([...inherited, ...form.permissions]);
  const depotScoped = effective.has('scan') || effective.has('manage_stock');

  const togglePermission = (permission: Permission) =>
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const deposit = Number(form.deposit_amount.replace(',', '.'));
    if (form.deposit_amount.trim() && (Number.isNaN(deposit) || deposit < 0)) {
      toast.error('Montant de caution invalide');
      return;
    }
    // Date d'accès déjà passée : la personne ne pourra ni se connecter ni emprunter
    if (accessExpired(form.access_until) && (!user || form.access_until !== (user.accessUntil || ''))
        && !await confirmAction(`La date « accès jusqu'au » (${new Date(`${form.access_until}T12:00:00`).toLocaleDateString('fr-CH')}) est déjà passée : cette personne ne pourra ni se connecter, ni utiliser son badge, ni emprunter. Enregistrer quand même ?`)) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        role: form.role,
        // On n'enregistre que ce qui s'ajoute au rôle
        permissions: form.permissions.filter(p => !inherited.includes(p)),
        active: form.active,
        license_categories: form.license_categories,
        license_expires_on: form.license_expires_on || null,
        person_kind: form.person_kind,
        company: form.person_kind === 'employee' ? null : form.company.trim() || null,
        access_until: form.access_until || null,
        deposit_amount: form.deposit_amount.trim() ? deposit : null,
        deposit_paid_on: form.deposit_amount.trim() ? form.deposit_paid_on || null : null,
        deposit_returned_on: form.deposit_amount.trim() ? form.deposit_returned_on || null : null,
      };

      let userId = user?.id;
      if (user) {
        const { error } = await supabase.from('users').update(payload).eq('id', user.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('users').insert(payload).select('id').single();
        if (error) throw error;
        userId = data.id;
      }

      // Dépôts attribués : aucun dépôt coché = tous les dépôts
      const { data: current, error: readError } = await supabase.from('user_depots').select('depot_id').eq('user_id', userId!);
      if (readError) throw readError;
      const before = (current || []).map(d => d.depot_id);
      const wanted = depotScoped ? depotIds : [];
      const removed = before.filter(id => !wanted.includes(id));
      const added = wanted.filter(id => !before.includes(id));
      if (removed.length) {
        const { error } = await supabase.from('user_depots').delete().eq('user_id', userId!).in('depot_id', removed);
        if (error) throw error;
      }
      if (added.length) {
        const { error } = await supabase.from('user_depots').insert(added.map(depot_id => ({ user_id: userId, depot_id })));
        if (error) throw error;
      }

      toast.success(user ? 'Personne mise à jour'
        : accessExpired(payload.access_until) ? `${payload.first_name} ajouté(e), accès déjà échu`
        : `${payload.first_name} ajouté(e) : connexion possible avec ${payload.email}`);
      if (user && user.id === profile?.id) await refreshProfile();
      // Les listes de personnes des autres écrans (permis, « Pour qui », comptoir) la proposent tout de suite
      await refreshUsers();
      onClose();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      toast.error(code === '23505' ? 'Cette adresse e-mail est déjà utilisée' : errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const roles: Role[] = isAdmin ? ['user', 'technician', 'manager', 'admin'] : ['user', 'technician', 'manager'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Modifier la personne' : 'Ajouter une personne'} size="lg">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="user-first" className={labelClass}>Prénom</label>
            <input id="user-first" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="user-last" className={labelClass}>Nom</label>
            <input id="user-last" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="user-email" className={labelClass}>E-mail (sert à se connecter)</label>
            <input id="user-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="user-phone" className={labelClass}>Téléphone</label>
            <input id="user-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="user-dept" className={labelClass}>Service</label>
            <input id="user-dept" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className={inputClass} />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Rôle</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map(role => (
              <label
                key={role}
                className={`flex gap-3 rounded-md border-[1.5px] p-[14px] cursor-pointer ${form.role === role ? 'border-[color:var(--mx-accent)] bg-[color:var(--mx-accent-lt)]' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <input type="radio" name="role" value={role} checked={form.role === role} onChange={() => setForm({ ...form, role })} className="mt-1 text-primary-600 focus:ring-primary-500" />
                <span>
                  <span className="block text-[length:calc(13.5px*var(--mx-scale,1))] font-bold text-gray-900 dark:text-gray-100">{ROLE_LABELS[role]}</span>
                  <span className="mt-0.5 block text-[length:calc(12px*var(--mx-scale,1))] text-gray-600 dark:text-gray-400">{ROLE_HINTS[role]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {form.role !== 'admin' && (
          <fieldset>
            <legend className={labelClass}>Droits</legend>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Les droits grisés viennent du rôle ; coches-en d'autres pour cette personne seulement.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXTRA_PERMISSIONS.map(permission => {
                const fromRole = inherited.includes(permission);
                return (
                  <label key={permission} className={`inline-flex items-center gap-2 text-sm ${fromRole ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={effective.has(permission)}
                      disabled={fromRole}
                      onChange={() => togglePermission(permission)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {PERMISSION_LABELS[permission]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {depotScoped && !effective.has('all_depots') && depots.length > 1 && (
          <fieldset>
            <legend className={labelClass}>Dépôts</legend>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Aucun dépôt coché : tous les dépôts.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {depots.map(depot => (
                <label key={depot.id} className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={depotIds.includes(depot.id)}
                    onChange={() => setDepotIds(ids => (ids.includes(depot.id) ? ids.filter(id => id !== depot.id) : [...ids, depot.id]))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {depot.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className={labelClass}>Permis de conduire</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {LICENSE_CATEGORIES.map(({ code: cat, label }) => (
              <label key={cat} title={label} className="inline-flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={form.license_categories.includes(cat)}
                  onChange={() => setForm(f => ({ ...f, license_categories: f.license_categories.includes(cat) ? f.license_categories.filter(c => c !== cat) : [...f.license_categories, cat] }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-mono">{cat}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 max-w-xs">
            <label htmlFor="user-license-exp" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Valable jusqu'au (facultatif)</label>
            <DateInput id="user-license-exp" value={form.license_expires_on} onChange={e => setForm({ ...form, license_expires_on: e.target.value })} className={inputClass} />
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Une réservation de véhicule est refusée si le permis ne couvre pas sa catégorie. Coche la catégorie la plus haute : elle inclut celles qu'elle exige (B inclut F, G et M ; CE inclut C, C1, C1E, BE et B ; DE inclut D, D1, D1E, BE et B). Les permis machines (cariste, nacelle, grutier…) se saisissent dans « Formations ».</p>
        </fieldset>

        <fieldset className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Statut</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="user-kind" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select id="user-kind" value={form.person_kind} onChange={e => setForm({ ...form, person_kind: e.target.value as typeof form.person_kind })} className={inputClass}>
                <option value="employee">Collaborateur</option>
                <option value="temp">Intérimaire</option>
                <option value="subcontractor">Sous-traitant</option>
              </select>
            </div>
            {form.person_kind !== 'employee' && (
              <div>
                <label htmlFor="user-company" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Entreprise</label>
                <input id="user-company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={inputClass} placeholder="ex. Adecco" />
              </div>
            )}
            <div>
              <label htmlFor="user-until" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Accès jusqu'au{form.person_kind === 'employee' ? ' (facultatif)' : ''}</label>
              <DateInput id="user-until" value={form.access_until} onChange={e => setForm({ ...form, access_until: e.target.value })} className={inputClass} required={form.person_kind !== 'employee'} />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Après cette date : plus de connexion ni de badge, et rien ne peut être emprunté au-delà.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="user-deposit" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Caution (CHF, facultatif)</label>
              <input id="user-deposit" inputMode="decimal" value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })} className={inputClass} placeholder="ex. 200" />
            </div>
            {form.deposit_amount.trim() !== '' && (
              <>
                <div>
                  <label htmlFor="user-deposit-paid" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Versée le</label>
                  <DateInput id="user-deposit-paid" value={form.deposit_paid_on} onChange={e => setForm({ ...form, deposit_paid_on: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="user-deposit-returned" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Rendue le</label>
                  <DateInput id="user-deposit-returned" value={form.deposit_returned_on} onChange={e => setForm({ ...form, deposit_returned_on: e.target.value })} className={inputClass} />
                </div>
              </>
            )}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={e => setForm({ ...form, active: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Accès actif</span>
            <span className="block text-xs text-gray-600 dark:text-gray-400">Décoche pour bloquer la connexion sans supprimer l'historique.</span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" variant="primary" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

export default UserModal;
