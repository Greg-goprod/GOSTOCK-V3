import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PhotoInput from '../components/common/PhotoInput';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { fileUrl } from '../lib/files';
import { errorMessage, toLocalInput } from '../lib/requests';
import { DateTimeInput } from '../components/common/DateInput';

interface PlanStatus {
  id: string;
  equipment_id: string;
  equipment_name: string;
  article_number: string | null;
  kind: 'maintenance' | 'electrical_check';
  title: string;
  interval_months: number | null;
  interval_checkouts: number | null;
  last_done_at: string;
  blocks_checkout: boolean;
  active: boolean;
  due_date: string | null;
  uses_since: number;
  uses_left: number | null;
  state: 'overdue' | 'soon' | 'ok' | 'inactive';
}

interface PlanRun {
  id: string;
  plan_id: string;
  done_at: string;
  result: 'ok' | 'failed';
  technician: string | null;
  cost: number | null;
  notes: string | null;
  report_path: string | null;
}

const STATE: Record<PlanStatus['state'], { label: string; className: string }> = {
  overdue: { label: 'Échu', className: 'bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200' },
  soon: { label: 'Bientôt', className: 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200' },
  ok: { label: 'À jour', className: 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-200' },
  inactive: { label: 'Suspendu', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const inputClass = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const nextDue = (p: PlanStatus) => [
  p.due_date && `le ${new Date(p.due_date).toLocaleDateString('fr-CH')}`,
  p.uses_left !== null && `dans ${Math.max(0, p.uses_left)} sortie${Math.abs(p.uses_left) > 1 ? 's' : ''}`,
].filter(Boolean).join(' ou ');

// Entretien préventif et contrôles électriques (OIBT) : plans, échéances, interventions
const Maintenance: React.FC = () => {
  const { refreshData } = useApp();
  const [plans, setPlans] = useState<PlanStatus[]>([]);
  const [runs, setRuns] = useState<PlanRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'all'>('todo');
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<PlanStatus | null>(null);
  const [historyOf, setHistoryOf] = useState<PlanStatus | null>(null);

  const load = async () => {
    setLoading(true);
    const [plansRes, runsRes] = await Promise.all([
      supabase.from('maintenance_plan_status').select('*').order('equipment_name'),
      supabase.from('maintenance_plan_runs').select('*').order('done_at', { ascending: false }).limit(500),
    ]);
    setLoading(false);
    if (plansRes.error) toast.error(errorMessage(plansRes.error));
    setPlans((plansRes.data || []) as PlanStatus[]);
    setRuns((runsRes.data || []) as PlanRun[]);
  };

  useEffect(() => {
    load();
  }, []);

  const todo = plans.filter(p => p.state === 'overdue' || p.state === 'soon')
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'overdue' ? -1 : 1));
  const shown = tab === 'todo' ? todo : plans;

  const toggleActive = async (plan: PlanStatus) => {
    const { error } = await supabase.from('maintenance_plans').update({ active: !plan.active }).eq('id', plan.id);
    if (error) toast.error(errorMessage(error));
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="mx-page-title">Entretien</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Révisions préventives et contrôles électriques (OIBT), tous les X mois ou toutes les X sorties.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Nouveau plan</Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'todo' ? 'primary' : 'outline'} onClick={() => setTab('todo')}>À faire ({todo.length})</Button>
        <Button size="sm" variant={tab === 'all' ? 'primary' : 'outline'} onClick={() => setTab('all')}>Tous les plans ({plans.length})</Button>
      </div>

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400">Chargement…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-gray-700 dark:text-gray-300">
          {tab === 'todo' ? 'Rien à faire : tous les entretiens sont à jour.' : 'Aucun plan. Créez-en un pour chaque outil à réviser ou à contrôler (OIBT).'}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(plan => (
            <li key={plan.id} className="rounded-lg bg-white dark:bg-gray-800 shadow p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{plan.equipment_name}</p>
                  <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{plan.article_number}</p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${STATE[plan.state].className}`}>{STATE[plan.state].label}</span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                {plan.kind === 'electrical_check' ? <Zap size={14} className="text-warning-600" aria-hidden="true" /> : <ClipboardCheck size={14} className="text-primary-600" aria-hidden="true" />}
                {plan.title}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {[plan.interval_months && `tous les ${plan.interval_months} mois`, plan.interval_checkouts && `toutes les ${plan.interval_checkouts} sorties`].filter(Boolean).join(' ou ')}
                {' · '}dernier le {new Date(plan.last_done_at).toLocaleDateString('fr-CH')}
                {' · '}prochain {nextDue(plan)}
                {plan.blocks_checkout && <span className="block text-danger-700 dark:text-danger-300">Sorties bloquées une fois échu</span>}
              </p>
              <div className="flex flex-wrap gap-2 mt-auto">
                <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => setCompleting(plan)} disabled={!plan.active}>Fait</Button>
                <Button size="sm" variant="outline" onClick={() => setHistoryOf(plan)}>Historique</Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(plan)}>{plan.active ? 'Suspendre' : 'Réactiver'}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && <NewPlanModal onClose={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />}
      {completing && (
        <CompleteModal
          plan={completing}
          onClose={() => setCompleting(null)}
          onDone={async () => { setCompleting(null); await load(); await refreshData(); }}
        />
      )}
      {historyOf && <RunsModal plan={historyOf} runs={runs.filter(r => r.plan_id === historyOf.id)} onClose={() => setHistoryOf(null)} />}
    </div>
  );
};

/* ------------------------------------------------------------------------ */

const NewPlanModal: React.FC<{ onClose: () => void; onDone: () => Promise<void> }> = ({ onClose, onDone }) => {
  const { equipment } = useApp();
  const [kind, setKind] = useState<'maintenance' | 'electrical_check'>('maintenance');
  const [title, setTitle] = useState('Révision');
  const [months, setMonths] = useState('6');
  const [uses, setUses] = useState('');
  const [blocks, setBlocks] = useState(false);
  const [lastDone, setLastDone] = useState(toLocalInput(new Date()));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const tools = useMemo(
    () => equipment.filter(e => e.itemType !== 'consumable' && e.status !== 'retired')
      .filter(e => `${e.name} ${e.articleNumber ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [equipment, search]
  );

  const chooseKind = (k: typeof kind) => {
    setKind(k);
    // Valeurs usuelles : contrôle électrique annuel bloquant, révision semestrielle
    if (k === 'electrical_check') {
      setTitle('Contrôle électrique OIBT');
      setMonths('12');
      setBlocks(true);
    } else {
      setTitle('Révision');
      setMonths('6');
      setBlocks(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected.length) return toast.error('Choisissez au moins un outil');
    if (!months && !uses) return toast.error('Indiquez un intervalle en mois et/ou en sorties');
    setSaving(true);
    const { error } = await supabase.from('maintenance_plans').insert(selected.map(equipment_id => ({
      equipment_id,
      kind,
      title: title.trim(),
      interval_months: months ? Number(months) : null,
      interval_checkouts: uses ? Number(uses) : null,
      blocks_checkout: blocks,
      last_done_at: new Date(lastDone).toISOString(),
    })));
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${selected.length} plan${selected.length > 1 ? 's' : ''} créé${selected.length > 1 ? 's' : ''}`);
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title="Nouveau plan d'entretien" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {([['maintenance', 'Entretien / révision'], ['electrical_check', 'Contrôle électrique (OIBT)']] as const).map(([k, label]) => (
            <label key={k} className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${kind === k ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" checked={kind === k} onChange={() => chooseKind(k)} className="text-primary-600 focus:ring-primary-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="plan-title" className={labelClass}>Intitulé</label>
            <input id="plan-title" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="plan-months" className={labelClass}>Tous les … mois</label>
            <input id="plan-months" type="number" min={1} value={months} onChange={e => setMonths(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="plan-uses" className={labelClass}>Ou toutes les … sorties</label>
            <input id="plan-uses" type="number" min={1} value={uses} onChange={e => setUses(e.target.value)} className={`${inputClass} font-mono`} placeholder="facultatif" />
          </div>
          <div>
            <label htmlFor="plan-last" className={labelClass}>Dernière intervention</label>
            <DateTimeInput id="plan-last" value={lastDone} onChange={e => setLastDone(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-start gap-2 self-end pb-2">
            <input type="checkbox" checked={blocks} onChange={e => setBlocks(e.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-gray-800 dark:text-gray-200">Bloquer les sorties une fois échu</span>
          </label>
        </div>

        <div>
          <span className={labelClass}>Outils concernés ({selected.length})</span>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un outil" className={`${inputClass} mb-2`} />
          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
            {tools.map(t => (
              <li key={t.id}>
                <label className="flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={() => setSelected(ids => (ids.includes(t.id) ? ids.filter(x => x !== t.id) : [...ids, t.id]))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto font-mono text-xs text-gray-500">{t.articleNumber}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Créer</Button>
        </div>
      </form>
    </Modal>
  );
};

const CompleteModal: React.FC<{ plan: PlanStatus; onClose: () => void; onDone: () => Promise<void> }> = ({ plan, onClose, onDone }) => {
  const [doneAt, setDoneAt] = useState(toLocalInput(new Date()));
  const [result, setResult] = useState<'ok' | 'failed'>('ok');
  const [technician, setTechnician] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('complete_maintenance_plan', {
      p_plan_id: plan.id,
      p_done_at: new Date(doneAt).toISOString(),
      p_result: result,
      p_technician: technician || null,
      p_cost: cost ? Number(cost.replace(',', '.')) : null,
      p_notes: notes || null,
      p_report_path: report[0] ?? null,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(result === 'ok' ? `${plan.title} enregistré` : `${plan.equipment_name} mis en maintenance (non conforme)`);
    await onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title={`${plan.title} · ${plan.equipment_name}`} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {([['ok', 'Conforme / effectué'], ['failed', 'Non conforme']] as const).map(([r, label]) => (
            <label key={r} className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${result === r ? (r === 'ok' ? 'border-success-500 bg-success-50 dark:bg-success-900/30' : 'border-danger-500 bg-danger-50 dark:bg-danger-900/30') : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" checked={result === r} onChange={() => setResult(r)} />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
            </label>
          ))}
        </div>
        {result === 'failed' && <p className="text-sm text-danger-700 dark:text-danger-300">L'outil passera en maintenance et ne pourra plus sortir tant qu'elle n'est pas terminée.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="run-date" className={labelClass}>Date</label>
            <DateTimeInput id="run-date" value={doneAt} onChange={e => setDoneAt(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="run-tech" className={labelClass}>Technicien / entreprise</label>
            <input id="run-tech" value={technician} onChange={e => setTechnician(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="run-cost" className={labelClass}>Coût (CHF)</label>
            <input id="run-cost" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="run-notes" className={labelClass}>Remarque</label>
            <input id="run-notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
          </div>
        </div>
        <PhotoInput folder="pv" value={report} onChange={setReport} label="Procès-verbal (PDF ou photo)" allowPdf max={1} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
};

const RunsModal: React.FC<{ plan: PlanStatus; runs: PlanRun[]; onClose: () => void }> = ({ plan, runs, onClose }) => {
  const openReport = async (path: string) => {
    const url = await fileUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };
  return (
    <Modal isOpen onClose={onClose} title={`Historique · ${plan.title}`} size="lg" closeOnBackdrop>
      {runs.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Aucune intervention enregistrée.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {runs.map(r => (
            <li key={r.id} className="py-2 flex justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {new Date(r.done_at).toLocaleDateString('fr-CH')} · {r.result === 'ok' ? 'Conforme' : 'Non conforme'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{[r.technician, r.cost !== null && `CHF ${Number(r.cost).toFixed(2)}`, r.notes].filter(Boolean).join(' · ')}</p>
              </div>
              {r.report_path && <Button size="sm" variant="outline" onClick={() => openReport(r.report_path!)}>PV</Button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default Maintenance;
