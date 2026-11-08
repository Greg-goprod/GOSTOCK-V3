import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Download, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { downloadText } from '../lib/download';
import { toCsv } from '../lib/piloteExports';
import { loadGantt, piloteError, type GanttData } from '../lib/pilote';
import {
  budgetError, budgetLevel, buildBudgetRows, formatChf, laborByProject, laborOf, loadBudget, loadBudgetRights, MAX_AMOUNT, MAX_RATE,
  parseAmount, remainingToCommit, sumLines, totalsByProject, usedRatio, variance, EMPTY_TOTALS,
  type BudgetData, type BudgetLevel, type BudgetRights, type CpBudgetLine,
} from '../lib/budget';
import { CrudSection } from '../components/sitePlanning/CrudSection';
import { EntityTable } from '../components/common/EntityTable';
import { MxBadge } from '../components/mx/MxBadge';
import { MxEmpty } from '../components/mx/MxEmpty';
import Button from '../components/common/Button';

const EMPTY: GanttData = { statuses: [], projects: [], templates: [], members: [], sites: [], items: [], itemMembers: [], links: [], calendarDays: [], capacities: [], baselines: [] };
const NO_DATA: BudgetData = { lines: [], rates: [] };
const todayZurich = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
const hoursText = (h: number) => (Math.round(h * 10) / 10).toLocaleString('fr-CH', { maximumFractionDigits: 1 });

const LEVEL: Record<BudgetLevel, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger'; bar: string }> = {
  none: { label: 'Pas de budget', tone: 'neutral', bar: 'bg-gray-300' },
  ok: { label: 'Dans le budget', tone: 'success', bar: 'bg-emerald-500' },
  warn: { label: 'Presque atteint', tone: 'warning', bar: 'bg-amber-500' },
  over: { label: 'Dépassé', tone: 'danger', bar: 'bg-red-500' },
};
const money = 'whitespace-nowrap text-right tabular-nums';
const gap = (v: number) => <span className={v < 0 ? 'font-semibold text-danger-600 dark:text-danger-400' : undefined}>{formatChf(v)}</span>;

// PILOTE › Pilotage › Budget : les lignes de budget de chaque projet (prévu, engagé, réel, en CHF), l'écart, la main-d'œuvre estimée
// (heures estimées × taux horaire des personnes assignées) et les taux horaires. Réservé aux personnes qui ont le droit « budget ».
const PiloteBudget: React.FC = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [budget, setBudget] = useState<BudgetData>(NO_DATA);
  const [rights, setRights] = useState<BudgetRights | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { users } = useApp();

  const reload = useCallback(async () => {
    try {
      const [g, b] = await Promise.all([loadGantt(), loadBudget()]);
      setData(g); setBudget(b);
    } catch (e) { toast.error(piloteError(e)); setData(prev => prev ?? EMPTY); }
  }, []);
  useEffect(() => { void reload(); void loadBudgetRights().then(setRights); }, [reload]);

  const userName = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.last_name}`.trim()])), [users]);
  const projects = useMemo(() => [...(data?.projects ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [data]);
  const totals = useMemo(() => totalsByProject(budget.lines), [budget.lines]);
  const labor = useMemo(() => (data ? laborByProject(data, budget.rates) : new Map()), [data, budget.rates]);
  const grand = useMemo(() => sumLines(budget.lines.filter(l => projects.some(p => p.id === l.project_id))), [budget.lines, projects]);
  const rateOf = useMemo(() => new Map(budget.rates.map(r => [r.user_id, r.hourly_rate])), [budget.rates]);
  // Les personnes qui comptent : équipes, assignations et taux déjà saisis
  const people = useMemo(() => {
    const ids = new Set<string>();
    for (const m of data?.members ?? []) ids.add(m.user_id);
    for (const m of data?.itemMembers ?? []) ids.add(m.user_id);
    for (const r of budget.rates) ids.add(r.user_id);
    return [...ids].filter(id => userName.has(id)).sort((a, b) => (userName.get(a) ?? '').localeCompare(userName.get(b) ?? '', 'fr'));
  }, [data, budget.rates, userName]);

  // Projet affiché en détail : celui qu'on a choisi, sinon le premier qui a un budget, sinon le premier
  const current = projects.find(p => p.id === selected) ?? projects.find(p => totals.has(p.id)) ?? projects[0] ?? null;
  const currentLines = current ? budget.lines.filter(l => l.project_id === current.id) : [];

  const saveRate = async (userId: string) => {
    const raw = (draft[userId] ?? '').trim();
    setDraft(d => { const n = { ...d }; delete n[userId]; return n; });
    if (raw === '') {
      if (!rateOf.has(userId)) return;
      const { error } = await supabase.from('cp_user_rates').delete().eq('user_id', userId);
      if (error) return void toast.error(budgetError(error));
      toast.success('Taux retiré');
      return void (await reload());
    }
    const value = parseAmount(raw, MAX_RATE);
    if (value === null) return void toast.error('Taux horaire : un montant entre 0 et 9 999,99 CHF');
    const { error } = await supabase.from('cp_user_rates').upsert({ user_id: userId, hourly_rate: value }, { onConflict: 'organization_id,user_id' });
    if (error) return void toast.error(budgetError(error));
    toast.success('Taux enregistré');
    await reload();
  };

  const exportCsv = () => {
    const rows = buildBudgetRows(projects, budget.lines, labor);
    if (rows.length === 0) return void toast('Aucune ligne de budget à exporter.');
    downloadText(toCsv(rows), `pilote-budget-${todayZurich()}.csv`, 'text/csv;charset=utf-8');
  };

  if (!data || rights === null) return <p className="text-gray-500 dark:text-gray-400 font-medium">Chargement…</p>;
  if (!rights.read) return <MxEmpty icon={Wallet} title="Budget réservé" description="Tu n'as pas le droit de consulter les budgets. Demande-le à un administrateur (droit « budget »)." />;

  const canRate = rights.create && rights.update;
  const cur = current ? totals.get(current.id) ?? EMPTY_TOTALS : EMPTY_TOTALS;
  const curLabor = current ? laborOf(labor, current.id) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-400">
          Pour chaque projet, des lignes de budget en CHF : <strong>prévu</strong> (ce que tu comptes dépenser), <strong>engagé</strong> (commandé, pas encore payé) et <strong>réel</strong> (payé).
          Tu saisis les montants à la main. La main-d'œuvre est estimée à part, avec les heures de la Charge et les taux horaires.
        </p>
        <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCsv}>Exporter (CSV)</Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Total de tous les projets" data-budget-summary>
        {[
          { id: 'planned', label: 'Prévu', value: formatChf(grand.planned) },
          { id: 'committed', label: 'Engagé', value: formatChf(grand.committed) },
          { id: 'actual', label: 'Réel', value: formatChf(grand.actual) },
          { id: 'variance', label: 'Écart (prévu − réel)', value: formatChf(variance(grand)) },
        ].map(k => (
          <div key={k.id} className="rounded-lg bg-white p-3 shadow dark:bg-gray-800" data-kpi={k.id}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{k.label}</dt>
            <dd className={`mt-1 text-xl font-bold tabular-nums ${k.id === 'variance' && variance(grand) < 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-900 dark:text-white'}`}>{k.value} <span className="text-xs font-medium text-gray-500">CHF</span></dd>
          </div>
        ))}
      </dl>

      {projects.length === 0 ? (
        <MxEmpty icon={Coins} title="Aucun projet" description="Crée un projet pour y saisir un budget." />
      ) : (
        <EntityTable<(typeof projects)[number]> caption="Budget par projet" items={projects} getKey={p => p.id}
          rowClassName={p => (p.id === current?.id ? 'bg-primary-50 dark:bg-primary-900/20' : '')}
          columns={[
            { id: 'name', label: 'Projet', render: p => (
              <button type="button" aria-pressed={p.id === current?.id} onClick={() => setSelected(p.id)} className="text-left font-semibold text-primary-700 hover:underline dark:text-primary-300">{p.name}</button>
            ) },
            { id: 'planned', label: 'Prévu', className: money, render: p => formatChf((totals.get(p.id) ?? EMPTY_TOTALS).planned) },
            { id: 'committed', label: 'Engagé', className: money, hideOnMobile: true, render: p => formatChf((totals.get(p.id) ?? EMPTY_TOTALS).committed) },
            { id: 'actual', label: 'Réel', className: money, render: p => formatChf((totals.get(p.id) ?? EMPTY_TOTALS).actual) },
            { id: 'variance', label: 'Écart', className: money, render: p => gap(variance(totals.get(p.id) ?? EMPTY_TOTALS)) },
            { id: 'level', label: 'État', render: p => {
              const t = totals.get(p.id) ?? EMPTY_TOTALS; const lv = budgetLevel(t); const r = usedRatio(t);
              return (
                <span className="inline-flex items-center gap-2" data-level={lv}>
                  <MxBadge tone={LEVEL[lv].tone}>{LEVEL[lv].label}</MxBadge>
                  {r !== null && <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">{Math.round(r * 100)} %</span>}
                </span>
              );
            } },
            { id: 'labor', label: "Main-d'œuvre est.", className: money, hideOnMobile: true, render: p => { const l = laborOf(labor, p.id); return l.hours > 0 ? formatChf(l.cost) : '—'; } },
          ]} />
      )}

      {current && (
        <section aria-label={`Budget du projet ${current.name}`} className="space-y-4" data-budget-project={current.id}>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{current.name}</h2>

          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="img"
            aria-label={usedRatio(cur) === null ? 'Aucun prévu saisi' : `${Math.round((usedRatio(cur) ?? 0) * 100)} % du prévu consommé (le plus grand de l'engagé et du réel)`}>
            <div className={`h-full ${LEVEL[budgetLevel(cur)].bar}`} style={{ width: `${Math.min(100, Math.round((usedRatio(cur) ?? 0) * 100))}%` }} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400" data-budget-remaining>
            Reste à engager : <strong className="tabular-nums">{formatChf(remainingToCommit(cur))} CHF</strong> · Marge sur le réel : <strong className="tabular-nums">{formatChf(variance(cur))} CHF</strong>
          </p>

          <CrudSection<CpBudgetLine>
            title="Lignes de budget" addLabel="Nouvelle ligne" table="cp_budget_lines" baseValues={{ project_id: current.id, position: currentLines.length }}
            rights={rights} onChanged={reload} errorText={budgetError} rows={currentLines}
            emptyIcon={Wallet} emptyTitle="Aucune ligne de budget" emptyText="Ajoute une ligne par catégorie de dépense : matériel, prestataires, déplacements…"
            deleteMessage={l => `Supprimer la ligne « ${l.category} » ?`}
            fields={[
              { key: 'category', label: 'Catégorie', type: 'text', required: true },
              { key: 'planned', label: 'Prévu (CHF)', type: 'number', required: true, initial: '0', max: MAX_AMOUNT },
              { key: 'committed', label: 'Engagé (CHF)', type: 'number', required: true, initial: '0', max: MAX_AMOUNT, hint: 'Commandé ou promis, pas encore payé.' },
              { key: 'actual', label: 'Réel (CHF)', type: 'number', required: true, initial: '0', max: MAX_AMOUNT, hint: 'Déjà payé.' },
              { key: 'note', label: 'Note', type: 'textarea' },
            ]}
            columns={[
              { id: 'category', label: 'Catégorie', render: l => <span className="font-medium">{l.category}</span> },
              { id: 'planned', label: 'Prévu', className: money, render: l => formatChf(l.planned) },
              { id: 'committed', label: 'Engagé', className: money, hideOnMobile: true, render: l => formatChf(l.committed) },
              { id: 'actual', label: 'Réel', className: money, render: l => formatChf(l.actual) },
              { id: 'variance', label: 'Écart', className: money, render: l => gap(variance(l)) },
              { id: 'note', label: 'Note', hideOnMobile: true, render: l => <span className="text-gray-600 dark:text-gray-400">{l.note ?? ''}</span> },
            ]}
          />

          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800" data-labor>
            <h3 className="font-bold text-gray-900 dark:text-white">Main-d'œuvre estimée</h3>
            {curLabor && curLabor.hours > 0 ? (
              <>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white" data-labor-cost>{formatChf(curLabor.cost)} <span className="text-sm font-medium text-gray-500">CHF</span></p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {`${hoursText(curLabor.valuedHours)} h valorisées sur ${hoursText(curLabor.hours)} h estimées.`}
                  {curLabor.unvaluedHours > 0 && <> {`${hoursText(curLabor.unvaluedHours)} h d'assignés sans taux horaire ne sont pas valorisées.`}</>}
                  {curLabor.unassignedHours > 0 && <> {`${hoursText(curLabor.unassignedHours)} h n'ont aucun assigné.`}</>}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Aucune heure estimée dans ce projet (fiche d'une tâche › « Estimation »).</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Les heures d'une tâche sont partagées à parts égales entre ses assignés, puis multipliées par leur taux. Si une phase et ses tâches sont toutes deux estimées, les deux comptent (comme dans la Charge) :
              estime plutôt l'un ou l'autre. Ce montant n'est pas ajouté aux lignes de budget.
            </p>
          </div>
        </section>
      )}

      <section aria-label="Taux horaires" className="space-y-2" data-rates>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Taux horaires</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Coût d'une heure de travail de chaque personne, en CHF (0 pour du bénévolat). Vide = pas de taux : ses heures ne sont pas valorisées. Visible seulement par les personnes qui ont le droit « budget ».
        </p>
        {people.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune personne dans les équipes ou les assignations pour l'instant.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map(id => {
              const stored = rateOf.get(id);
              const shown = draft[id] ?? (stored === undefined ? '' : String(stored).replace('.', ','));
              return (
                <li key={id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 shadow-sm dark:bg-gray-800" data-rate-user={id}>
                  <label htmlFor={`rate-${id}`} className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName.get(id)}</label>
                  <span className="flex items-center gap-1">
                    <input id={`rate-${id}`} inputMode="decimal" autoComplete="off" disabled={!canRate} placeholder="—" value={shown}
                      onChange={e => setDraft(d => ({ ...d, [id]: e.target.value }))}
                      onBlur={() => { if (draft[id] !== undefined && draft[id] !== (stored === undefined ? '' : String(stored).replace('.', ','))) void saveRate(id); else setDraft(d => { const n = { ...d }; delete n[id]; return n; }); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-gray-900 disabled:opacity-70 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                    <span className="text-xs text-gray-500">CHF/h</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PiloteBudget;
