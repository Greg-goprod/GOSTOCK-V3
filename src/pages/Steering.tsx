import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';

interface ToolUsage {
  equipment_id: string;
  name: string;
  article_number: string | null;
  units: number;
  purchase_price: number;
  days_out: number;
  checkouts: number;
  usage_rate: number;
  last_checkout: string | null;
}

interface LateRow {
  user_id: string;
  name: string;
  late_returns: number;
  overdue_now: number;
  checkouts: number;
}

const chf = (n: number) => n.toLocaleString('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
const DAY = 24 * 60 * 60 * 1000;

const Kpi: React.FC<{ label: string; value: string; to?: string; tone?: 'bad' | 'warn' }> = ({ label, value, to, tone }) => {
  const body = (
    <>
      <span className={`font-mono text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-tone-danger' : tone === 'warn' ? 'text-tone-warning' : 'text-gray-900 dark:text-white'}`}>{value}</span>
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    </>
  );
  const className = 'bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col gap-1';
  return to ? <Link to={to} className={`${className} hover:ring-2 hover:ring-primary-400`}>{body}</Link> : <div className={className}>{body}</div>;
};

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 min-w-0">
    <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
    {hint && <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{hint}</p>}
    {children}
  </section>
);

// Tableau du responsable : utilisation des outils, retards, coûts, pertes
const Steering: React.FC = () => {
  const { checkouts, vehicles } = useApp();
  const [usage, setUsage] = useState<ToolUsage[]>([]);
  const [late, setLate] = useState<LateRow[]>([]);
  const [sites, setSites] = useState<{ site: string; amount: number }[]>([]);
  const [incidentsValue, setIncidentsValue] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [fuel, setFuel] = useState<{ vehicle_id: string; amount: number | null; liters: number }[]>([]);
  const [km, setKm] = useState<Record<string, number>>({});

  useEffect(() => {
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const since90 = new Date(Date.now() - 90 * DAY).toISOString();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    Promise.all([
      supabase.from('tool_usage').select('*'),
      supabase.from('late_returns_by_person').select('*'),
      supabase.from('site_cost_lines').select('site, amount').gte('at', since30),
      supabase.from('incidents').select('cost, decision, equipment_id, equipment(purchase_price)').gte('occurred_at', yearStart),
      supabase.from('stock_value').select('value'),
      supabase.from('fuel_entries').select('vehicle_id, amount, liters').gte('filled_at', since90),
      supabase.from('vehicle_logbook').select('vehicle_id, distance').gte('start_at', since90),
    ]).then(([u, l, s, i, v, f, t]) => {
      setUsage(((u.data || []) as ToolUsage[]).map(r => ({ ...r, days_out: Number(r.days_out), usage_rate: Number(r.usage_rate), purchase_price: Number(r.purchase_price), units: Number(r.units), checkouts: Number(r.checkouts) })));
      setLate(((l.data || []) as LateRow[]).map(r => ({ ...r, late_returns: Number(r.late_returns), overdue_now: Number(r.overdue_now), checkouts: Number(r.checkouts) })));
      const bySite = new Map<string, { site: string; amount: number }>();
      for (const row of s.data || []) {
        const key = String(row.site).trim().toLowerCase();
        const entry = bySite.get(key) ?? { site: String(row.site).trim(), amount: 0 };
        entry.amount += Number(row.amount);
        bySite.set(key, entry);
      }
      setSites([...bySite.values()].sort((a, b) => b.amount - a.amount).slice(0, 8));
      setIncidentsValue((i.data || [])
        .filter(r => r.decision !== 'found')
        .reduce((sum, r) => sum + Number(r.cost ?? (r.equipment as { purchase_price?: number } | null)?.purchase_price ?? 0), 0));
      setStockValue((v.data || []).reduce((sum, r) => sum + Number(r.value), 0));
      setFuel((f.data || []).map(r => ({ vehicle_id: r.vehicle_id, amount: r.amount === null ? null : Number(r.amount), liters: Number(r.liters) })));
      const kmMap: Record<string, number> = {};
      for (const row of t.data || []) kmMap[row.vehicle_id] = (kmMap[row.vehicle_id] ?? 0) + Number(row.distance ?? 0);
      setKm(kmMap);
    });
  }, []);

  const overdueNow = checkouts.filter(c => (c.status === 'active' || c.status === 'overdue') && new Date(c.dueDate).getTime() < Date.now()).length;
  const idle = useMemo(() => usage.filter(u => u.checkouts === 0).sort((a, b) => b.purchase_price * b.units - a.purchase_price * a.units), [usage]);
  const busy = useMemo(() => usage.filter(u => u.usage_rate >= 70).sort((a, b) => b.usage_rate - a.usage_rate), [usage]);
  const idleValue = idle.reduce((s, u) => s + u.purchase_price * u.units, 0);
  const lateSorted = [...late].filter(l => l.late_returns + l.overdue_now > 0).sort((a, b) => (b.late_returns + b.overdue_now * 2) - (a.late_returns + a.overdue_now * 2));
  const fleet = vehicles.filter(v => v.status !== 'retired').map(v => {
    const entries = fuel.filter(f => f.vehicle_id === v.id);
    return { vehicle: v, km: km[v.id] ?? 0, amount: entries.reduce((s, f) => s + (f.amount ?? 0), 0) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mx-page-title">Pilotage</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Utilisation du matériel, retards et coûts : de quoi décider achats, reventes et rappels.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Retours en retard" value={String(overdueNow)} to="/checkouts" tone={overdueNow ? 'bad' : undefined} />
        <Kpi label={`Pertes et casse ${new Date().getFullYear()}`} value={chf(incidentsValue)} to="/incidents" tone={incidentsValue ? 'warn' : undefined} />
        <Kpi label="Valeur du stock" value={chf(stockValue)} to="/couts" />
        <Kpi label="Outils jamais sortis (90 j)" value={`${idle.length} · ${chf(idleValue)}`} tone={idle.length ? 'warn' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Jamais sortis depuis 90 jours" hint="À revendre, à transférer dans un autre dépôt, ou à ne pas racheter.">
          {idle.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Tous les outils ont servi.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {idle.slice(0, 10).map(u => (
                <li key={u.equipment_id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span className="truncate">{u.name} <span className="font-mono text-xs text-gray-500">{u.article_number}</span></span>
                  <span className="font-mono shrink-0">{u.units > 1 ? `${u.units} × ` : ''}{chf(u.purchase_price)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Très demandés (70 % du temps ou plus)" hint="Sortis presque en permanence : un exemplaire de plus éviterait des refus.">
          {busy.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun outil saturé.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {busy.slice(0, 10).map(u => (
                <li key={u.equipment_id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span className="truncate">{u.name}{u.units > 1 ? ` (${u.units} ex.)` : ''}</span>
                  <span className="font-mono shrink-0">{u.usage_rate.toLocaleString('fr-CH')} %</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Retards par personne (90 jours)" hint="Retours en retard et emprunts encore en retard.">
          {lateSorted.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun retard.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {lateSorted.slice(0, 10).map(l => (
                <li key={l.user_id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span>{l.name}</span>
                  <span className="font-mono">
                    {l.late_returns} en retard / {l.checkouts}
                    {l.overdue_now > 0 && <span className="text-tone-danger"> · {l.overdue_now} en cours</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Coûts par chantier (30 jours)" hint="Consommables et jours d'outils.">
          {sites.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune sortie.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {sites.map(s => (
                <li key={s.site} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span className="truncate">{s.site}</span>
                  <span className="font-mono">{chf(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/couts" className="mt-2 inline-block text-sm text-primary-700 dark:text-primary-300 hover:underline">Détail et export →</Link>
        </Section>

        <Section title="Flotte (90 jours)" hint="Kilomètres et carburant par véhicule.">
          {fleet.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucun véhicule.</p> : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {fleet.map(f => (
                <li key={f.vehicle.id} className="py-1.5 flex justify-between gap-2 text-gray-800 dark:text-gray-200">
                  <span className="truncate">{f.vehicle.name} <span className="font-mono text-xs text-gray-500">{f.vehicle.plate}</span></span>
                  <span className="font-mono">{f.km.toLocaleString('fr-CH')} km · {chf(f.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
};

export default Steering;
