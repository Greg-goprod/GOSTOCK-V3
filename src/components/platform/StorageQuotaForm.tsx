import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { formatBytes, type PlatformCompany, type PlatformQuota } from '../../lib/platformConsole';
import Modal from '../common/Modal';
import Button from '../common/Button';

const GO = 1024 ** 3;
const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  company: PlatformCompany | null;
  quota?: PlatformQuota;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

// Limite de stockage des documents PILOTE d'une entreprise (console de la plateforme) : en Go, ou illimitée. La base refuse tout autre appelant.
const StorageQuotaForm: React.FC<Props> = ({ company, quota, onClose, onSaved }) => {
  const [go, setGo] = useState('2');
  const [unlimited, setUnlimited] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
    const bytes = quota?.quota_bytes ?? null;
    setUnlimited(!!quota && bytes === null);
    setGo(bytes === null ? '2' : String(Number((bytes / GO).toFixed(2))));
  }, [company, quota]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!company || saving || !supabase) return;
    const value = Number(go.replace(',', '.'));
    if (!unlimited && (!Number.isFinite(value) || value < 0)) return void toast.error('Indique une limite en Go (0 ou plus)');
    setSaving(true);
    const { error } = await supabase.rpc('platform_set_storage_quota', { p_organization_id: company.id, p_bytes: unlimited ? null : Math.round(value * GO) });
    setSaving(false);
    if (error) return void toast.error(errorMessage(error));
    toast.success('Limite enregistrée');
    await onSaved();
    onClose();
  };

  return (
    <Modal isOpen={!!company} onClose={onClose} title="Limite de stockage des documents" size="sm">
      {company && (
        <form onSubmit={submit} className="space-y-4" aria-label="Limite de stockage">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {`« ${company.name} » : ${formatBytes(quota?.used_bytes ?? 0)} utilisés.`}
          </p>
          <div>
            <label htmlFor="quota-go" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limite (en Go)</label>
            <input id="quota-go" className={inputClass} inputMode="decimal" value={go} disabled={unlimited} onChange={e => setGo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} /> Illimité
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Ne compte que les documents PILOTE (fichiers joints aux projets et aux tâches). Les photos, les fichiers et les sauvegardes ont leurs propres limites. La limite est atteinte à un fichier près : un dépôt en cours peut la dépasser de peu.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={saving}>Enregistrer</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default StorageQuotaForm;
