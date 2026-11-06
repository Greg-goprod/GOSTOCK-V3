import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Undo2, Wrench, AlertTriangle, ClipboardCheck } from 'lucide-react';
import Modal from '../common/Modal';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { Equipment } from '../../types';

interface HistoryEvent {
  id: string;
  at: string;
  kind: 'out' | 'return' | 'lost' | 'maintenance' | 'incident' | 'inspection';
  title: string;
  detail?: string;
}

const ICONS = {
  out: <ArrowUpRight size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />,
  return: <Undo2 size={16} className="text-tone-success" aria-hidden="true" />,
  lost: <AlertTriangle size={16} className="text-tone-danger" aria-hidden="true" />,
  maintenance: <Wrench size={16} className="text-tone-warning" aria-hidden="true" />,
  incident: <AlertTriangle size={16} className="text-tone-danger" aria-hidden="true" />,
  inspection: <ClipboardCheck size={16} className="text-info-600 dark:text-info-100" aria-hidden="true" />,
};

const CONDITION_LABELS: Record<string, string> = {
  ok: 'bon état', dirty: 'sale', incomplete: 'incomplet', to_repair: 'à réparer', broken: 'cassé',
};
const INCIDENT_LABELS: Record<string, string> = { lost: 'Perte', stolen: 'Vol', broken: 'Casse' };

const fmt = (date: string) => new Date(date).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' });

// Toute la vie d'un outil : sorties (qui, quand), retours, pertes, maintenances
const EquipmentHistoryModal: React.FC<{ equipment: Equipment; onClose: () => void }> = ({ equipment, onClose }) => {
  const { users, equipmentInstances } = useApp();
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);

  useEffect(() => {
    const name = (id: string) => {
      const u = users.find(x => x.id === id);
      return u ? `${u.first_name} ${u.last_name}` : 'Personne inconnue';
    };
    const instanceLabel = (id?: string | null) => (id ? equipmentInstances.find(i => i.id === id)?.qrCode : undefined);

    (async () => {
      const [checkoutsRes, maintenanceRes, checksRes, incidentsRes, plansRes] = await Promise.all([
        supabase.from('checkouts').select('id, user_id, instance_id, checkout_date, due_date, return_date, status, notes').eq('equipment_id', equipment.id),
        supabase.from('equipment_maintenance').select('id, title, start_date, end_date, status, technician_name, cost, notes').eq('equipment_id', equipment.id),
        supabase.from('return_checks').select('checkout_id, condition, notes').eq('equipment_id', equipment.id),
        supabase.from('incidents').select('id, kind, occurred_at, responsible_id, description, decision, cost').eq('equipment_id', equipment.id),
        supabase.from('maintenance_plans').select('id, title, maintenance_plan_runs(id, done_at, result, technician, notes)').eq('equipment_id', equipment.id),
      ]);
      const checkByCheckout = new Map((checksRes.data || []).map(c => [c.checkout_id, c]));
      const list: HistoryEvent[] = [];
      for (const c of checkoutsRes.data || []) {
        const unit = instanceLabel(c.instance_id);
        list.push({
          id: `${c.id}-out`, at: c.checkout_date, kind: 'out',
          title: `Sorti par ${name(c.user_id)}${unit ? ` · ${unit}` : ''}`,
          detail: [`retour prévu le ${new Date(c.due_date).toLocaleDateString('fr-CH')}`, c.notes].filter(Boolean).join(' · '),
        });
        if (c.status === 'returned' && c.return_date) {
          const late = new Date(c.return_date) > new Date(c.due_date);
          const check = checkByCheckout.get(c.id);
          list.push({
            id: `${c.id}-in`, at: c.return_date, kind: 'return',
            title: `Rendu par ${name(c.user_id)}${unit ? ` · ${unit}` : ''}${check ? ` · ${CONDITION_LABELS[check.condition] ?? check.condition}` : ''}`,
            detail: [late && 'rendu en retard', check?.notes].filter(Boolean).join(' · ') || undefined,
          });
        }
      }
      for (const m of maintenanceRes.data || []) {
        list.push({
          id: m.id, at: m.start_date, kind: 'maintenance',
          title: `Maintenance : ${m.title}`,
          detail: [m.status === 'completed' && m.end_date ? `terminée le ${new Date(m.end_date).toLocaleDateString('fr-CH')}` : 'en cours', m.technician_name, m.cost ? `CHF ${Number(m.cost).toFixed(2)}` : null, m.notes].filter(Boolean).join(' · '),
        });
      }
      for (const i of incidentsRes.data || []) {
        list.push({
          id: i.id, at: i.occurred_at, kind: 'incident',
          title: `${INCIDENT_LABELS[i.kind] ?? i.kind} · ${name(i.responsible_id)}`,
          detail: [i.description, i.decision !== 'pending' ? `décision : ${i.decision}` : 'à décider', i.cost ? `CHF ${Number(i.cost).toFixed(2)}` : null].filter(Boolean).join(' · '),
        });
      }
      for (const plan of (plansRes.data || []) as { title: string; maintenance_plan_runs: { id: string; done_at: string; result: string; technician: string | null; notes: string | null }[] }[]) {
        for (const run of plan.maintenance_plan_runs || []) {
          list.push({
            id: run.id, at: run.done_at, kind: 'inspection',
            title: `${plan.title} · ${run.result === 'ok' ? 'conforme' : 'non conforme'}`,
            detail: [run.technician, run.notes].filter(Boolean).join(' · ') || undefined,
          });
        }
      }
      setEvents(list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()));
    })();
  }, [equipment.id, users, equipmentInstances]);

  const outs = events?.filter(e => e.kind === 'out').length ?? 0;
  const lateReturns = events?.filter(e => e.kind === 'return' && e.detail).length ?? 0;

  return (
    <Modal isOpen onClose={onClose} title={`Historique · ${equipment.name}`} size="lg" closeOnBackdrop>
      {events === null ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-mono">{equipment.articleNumber}</span>
            {equipment.serialNumber ? <> · S/N <span className="font-mono">{equipment.serialNumber}</span></> : null}
            {' · '}{outs} sortie{outs > 1 ? 's' : ''}{lateReturns ? ` · ${lateReturns} retour${lateReturns > 1 ? 's' : ''} en retard` : ''}
          </p>
          {events.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Aucun événement pour l'instant.</p>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-4">
              {events.map(e => (
                <li key={e.id} className="ml-5">
                  <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700">{ICONS[e.kind]}</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{fmt(e.at)}{e.detail ? ` · ${e.detail}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Modal>
  );
};

export default EquipmentHistoryModal;
