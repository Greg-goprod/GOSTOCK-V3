import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/requests';

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

// Sauvegarde complète téléchargée (JSON) ; le rappel mensuel s'arrête pour 30 jours
const BackupPanel: React.FC = () => {
  const [last, setLast] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'last_backup_at').maybeSingle()
      .then(({ data }) => setLast(data?.value || null));
  }, []);

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

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Télécharge toutes les données de GO-Mat dans un fichier (JSON) à garder hors de Supabase : serveur de l'entreprise, clé USB, coffre.
        Un rappel arrive chaque mois tant qu'aucune sauvegarde n'a été faite. Les photos et PV restent dans le stockage Supabase.
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Dernière sauvegarde : {last ? new Date(last).toLocaleString('fr-CH', { dateStyle: 'long', timeStyle: 'short' }) : 'jamais'}
      </p>
      <Button icon={<Download size={16} />} onClick={run} loading={progress !== null}>
        {progress ? `Sauvegarde ${progress}…` : 'Télécharger la sauvegarde complète'}
      </Button>
    </div>
  );
};

export default BackupPanel;
