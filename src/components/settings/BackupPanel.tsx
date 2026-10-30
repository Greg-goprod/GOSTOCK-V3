import React, { useEffect, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';
import { confirmAction } from '../../lib/confirm';

// Toutes les tables de GO-Mat, sauf les abonnements de téléphones et les codes de badge (secrets)
const TABLES = [
  'organizations', 'system_settings', 'depots', 'storage_bins', 'departments', 'role_configs', 'status_configs',
  'users', 'user_depots', 'trainings', 'user_trainings', 'ppe_types', 'ppe_issues', 'user_ppe_sizes',
  'categories', 'equipment_groups', 'equipment_subgroups', 'suppliers', 'catalog_products',
  'equipment', 'equipment_instances', 'equipment_accessories', 'consumable_stock', 'stock_movements',
  'kits', 'kit_items', 'sites', 'requests', 'request_items', 'request_templates', 'delivery_notes', 'checkouts', 'return_checks',
  'vehicles', 'vehicle_trips', 'fuel_entries', 'maintenance_types', 'equipment_maintenance', 'maintenance_plans', 'maintenance_plan_runs',
  'repair_orders', 'incidents', 'inventory_counts', 'inventory_count_lines', 'purchase_orders', 'purchase_order_lines',
  'transfers', 'transfer_lines', 'rentals', 'notification_recipients', 'notifications', 'audit_log',
];
const PAGE = 1000;

interface StoredBackup {
  name: string;
  created_at: string;
  size?: number;
}

interface BackupFile {
  application?: string;
  exported_at?: string;
  tables?: Record<string, unknown[]>;
}

// Sauvegarde : téléchargement immédiat, sauvegardes automatiques mensuelles (stockage privé) et restauration
const BackupPanel: React.FC = () => {
  const [last, setLast] = useState<string | null>(null);
  const [lastAuto, setLastAuto] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [stored, setStored] = useState<StoredBackup[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<{ name: string; data: BackupFile } | null>(null);
  const [restoreLog, setRestoreLog] = useState<string[]>([]);

  const load = async () => {
    const { data } = await supabase.from('system_settings').select('id, value').in('id', ['last_backup_at', 'last_auto_backup_at', 'auto_backup']);
    const value = (id: string) => data?.find(s => s.id === id)?.value || null;
    setLast(value('last_backup_at'));
    setLastAuto(value('last_auto_backup_at'));
    setAuto(value('auto_backup') !== 'false');
    const files = await supabase.storage.from('backups').list('', { sortBy: { column: 'name', order: 'desc' } });
    setStored(((files.data || []) as StoredBackup[]).filter(f => f.name.endsWith('.json')));
  };

  useEffect(() => {
    load();
  }, []);

  const dateTime = (value: string) => new Date(value).toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' });

  const run = async () => {
    const dump: Record<string, unknown[]> = {};
    try {
      for (const [index, table] of TABLES.entries()) {
        setProgress(`${index + 1} / ${TABLES.length} · ${table}`);
        const rows: unknown[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
          if (error) {
            // Table absente ou illisible : notée dans le fichier, la sauvegarde continue
            dump[`_erreur_${table}`] = [errorMessage(error)];
            break;
          }
          rows.push(...(data || []));
          if (!data || data.length < PAGE) break;
        }
        dump[table] = rows;
      }
      const stamp = new Date().toISOString();
      const blob = new Blob([JSON.stringify({ application: 'GO-Mat', exported_at: stamp, tables: dump })], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GO-Mat_sauvegarde_${stamp.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase.from('system_settings').upsert({ id: 'last_backup_at', value: stamp, description: 'Dernière sauvegarde complète téléchargée' });
      setLast(stamp);
      const total = Object.values(dump).reduce((s, rows) => s + rows.length, 0);
      toast.success(`Sauvegarde téléchargée : ${total.toLocaleString('fr-CH')} lignes`);
    } catch (error) {
      toast.error(`Sauvegarde interrompue : ${errorMessage(error)}`);
    } finally {
      setProgress(null);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setAuto(enabled);
    const { error } = await supabase.from('system_settings').upsert({ id: 'auto_backup', value: String(enabled), description: 'Sauvegarde complète automatique chaque mois dans le stockage privé' });
    if (error) {
      setAuto(!enabled);
      toast.error(errorMessage(error));
    }
  };

  const downloadStored = async (name: string) => {
    const { data, error } = await supabase.storage.from('backups').createSignedUrl(name, 60, { download: name });
    if (error || !data) return toast.error(error ? errorMessage(error) : 'Fichier introuvable');
    window.location.assign(data.signedUrl);
  };

  const pickRestore = async (file: File | undefined) => {
    setRestoreLog([]);
    if (!file) return setRestoreFile(null);
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      if (data.application !== 'GO-Mat' || !data.tables) throw new Error('format');
      setRestoreFile({ name: file.name, data });
    } catch {
      setRestoreFile(null);
      toast.error("Ce fichier n'est pas une sauvegarde GO-Mat");
    }
  };

  const pickStoredRestore = async (name: string) => {
    setRestoreLog([]);
    const { data, error } = await supabase.storage.from('backups').download(name);
    if (error || !data) return toast.error(error ? errorMessage(error) : 'Fichier introuvable');
    try {
      setRestoreFile({ name, data: JSON.parse(await data.text()) as BackupFile });
    } catch {
      toast.error("Ce fichier n'est pas une sauvegarde GO-Mat");
    }
  };

  // Remet les lignes absentes, table par table dans l'ordre des dépendances ; rien n'est écrasé ni supprimé
  const restore = async () => {
    if (!restoreFile?.data.tables) return;
    if (!await confirmAction('Remettre les lignes supprimées depuis cette sauvegarde ? Les données actuelles ne sont ni modifiées ni supprimées.')) return;
    const tables = restoreFile.data.tables;
    const log: string[] = [];
    let total = 0;
    for (const [index, table] of TABLES.entries()) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      setProgress(`${index + 1} / ${TABLES.length} · ${table}`);
      let restored = 0;
      try {
        for (let from = 0; from < rows.length; from += 500) {
          const { data, error } = await supabase.rpc('restore_missing_rows', { p_table: table, p_rows: rows.slice(from, from + 500) });
          if (error) throw error;
          restored += Number(data) || 0;
        }
        if (restored) log.push(`${table} : ${restored} ligne(s) remise(s)`);
        total += restored;
      } catch (error) {
        log.push(`${table} : erreur, ${errorMessage(error)}`);
      }
    }
    setProgress(null);
    setRestoreLog(log.length ? log : ['Rien à remettre : toutes les lignes de la sauvegarde sont déjà présentes.']);
    if (total) toast.success(`${total.toLocaleString('fr-CH')} ligne(s) remise(s)`);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Télécharge toutes les données de GO-Mat dans un fichier (JSON) à garder hors de Supabase : serveur de l'entreprise, clé USB, coffre.
          Les photos et PV restent dans le stockage Supabase.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {`Dernière sauvegarde téléchargée : ${last ? dateTime(last) : 'jamais'}`}
        </p>
        <Button icon={<Download size={16} />} onClick={run} loading={progress !== null}>
          {progress ? `Sauvegarde ${progress}…` : 'Télécharger la sauvegarde complète'}
        </Button>
      </div>

      <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Sauvegarde automatique</h4>
        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={auto} onChange={e => toggleAuto(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
          Chaque mois, une sauvegarde complète est rangée dans le stockage privé de GO-Mat (les 12 dernières sont gardées).
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {`Dernière sauvegarde automatique : ${lastAuto ? dateTime(lastAuto) : 'pas encore faite'}`}
        </p>
        {stored.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {stored.map(f => (
              <li key={f.name} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-gray-800 dark:text-gray-200">{f.name}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={() => downloadStored(f.name)}>Télécharger</Button>
                  <Button size="sm" variant="outline" icon={<RotateCcw size={14} />} onClick={() => pickStoredRestore(f.name)}>Restaurer…</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Restaurer depuis une sauvegarde</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Remet ce qui a été supprimé par erreur (articles, personnes, sorties…). Les lignes encore présentes ne sont jamais modifiées.
        </p>
        <input type="file" accept="application/json,.json" aria-label="Fichier de sauvegarde" onChange={e => pickRestore(e.target.files?.[0])}
          className="block text-sm text-gray-700 dark:text-gray-300" />
        {restoreFile && (
          <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-2">
            <p className="text-gray-800 dark:text-gray-200">
              <span className="font-mono">{restoreFile.name}</span>
              {restoreFile.data.exported_at ? ` · faite le ${dateTime(restoreFile.data.exported_at)}` : ''}
              {` · ${Object.entries(restoreFile.data.tables ?? {}).filter(([t]) => !t.startsWith('_')).reduce((s, [, rows]) => s + (Array.isArray(rows) ? rows.length : 0), 0).toLocaleString('fr-CH')} lignes`}
            </p>
            <Button icon={<RotateCcw size={16} />} onClick={restore} loading={progress !== null}>
              {progress ? `Restauration ${progress}…` : 'Remettre les lignes manquantes'}
            </Button>
          </div>
        )}
        {restoreLog.length > 0 && (
          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            {restoreLog.map(line => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BackupPanel;
