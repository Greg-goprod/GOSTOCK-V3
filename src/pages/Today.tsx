import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { REQUEST_STATUS, VEHICLE_STATUS, deadlineState, formatPeriod } from '../lib/requests';
import { RequestOverview } from '../types';

const DAY = 24 * 60 * 60 * 1000;

const Kpi: React.FC<{ value: number | string; label: string; to: string; tone?: 'bad' | 'warn' }> = ({ value, label, to, tone }) => (
  <Link
    to={to}
    className="mx-card mx-card-hover p-4 flex flex-col gap-1"
  >
    <span className={`font-mono text-[29px] font-bold tracking-[-0.02em] tabular-nums ${tone === 'bad' ? 'text-danger-600 dark:text-danger-400' : tone === 'warn' ? 'text-warning-700 dark:text-warning-300' : 'text-gray-900 dark:text-white'}`}>
      {value}
    </span>
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
  </Link>
);

const Block: React.FC<{ title: string; to: string; link: string; children: React.ReactNode; empty: string; count: number }> = ({ title, to, link, children, empty, count }) => (
  <section className="mx-card p-5 flex flex-col gap-3 min-w-0">
    <div className="flex justify-between items-baseline gap-2">
      <h2 className="text-[16px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h2>
      <Link to={to} className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1">
        {link} <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
    {count === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-200 dark:divide-gray-700">{children}</ul>}
  </section>
);

// Tableau du magasin (accueil des rôles du magasin) : ce qui part, ce qui doit revenir, ce qui manque
const Today: React.FC = () => {
  const { checkouts, equipment, users, consumableStock, depots, vehicles, loadingAppData } = useApp();
  const [requests, setRequests] = useState<RequestOverview[]>([]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase!
        .from('requests_overview')
        .select('*')
        .in('status', ['requested', 'approved', 'ready', 'out'])
        .order('start_at');
      setRequests((data || []) as RequestOverview[]);
    })();
  }, []);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const toPrepare = requests.filter(r => ['approved', 'ready'].includes(r.status) && new Date(r.start_at) <= new Date(endOfToday.getTime() + DAY));
  const toApprove = requests.filter(r => r.status === 'requested');

  const overdue = useMemo(
    () => checkouts.filter(c => c.status === 'overdue' || (c.status === 'active' && c.dueDate && new Date(c.dueDate).getTime() < Date.now())),
    [checkouts]
  );

  const lowStock = useMemo(
    () => consumableStock.filter(s => s.minQuantity > 0 && s.quantity < s.minQuantity),
    [consumableStock]
  );

  const vehiclesOut = vehicles.filter(v => v.status === 'in_use');
  const vehicleWarnings = vehicles.filter(v => v.status !== 'retired' && [v.nextServiceDate, v.tiresDate, v.inspectionDate].some(d => deadlineState(d) === 'overdue' || deadlineState(d) === 'soon'));

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : 'Inconnu';
  };
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  const daysLate = (due: string) => Math.max(1, Math.floor((Date.now() - new Date(due).getTime()) / DAY));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi value={toPrepare.length} label="Demandes à préparer" to="/demandes" />
        <Kpi value={toApprove.length} label="Demandes à valider" to="/demandes" tone={toApprove.length ? 'warn' : undefined} />
        <Kpi value={overdue.length} label="Retours en retard" to="/checkouts" tone={overdue.length ? 'bad' : undefined} />
        <Kpi value={lowStock.length} label="Consommables sous le seuil" to="/commande" tone={lowStock.length ? 'warn' : undefined} />
        <Kpi value={`${vehiclesOut.length} / ${vehicles.filter(v => v.status !== 'retired').length}`} label="Véhicules sortis" to="/vehicules" />
      </div>

      {loadingAppData ? (
        <p className="text-gray-600 dark:text-gray-400">Chargement…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Block title="À préparer (aujourd'hui et demain)" to="/demandes" link="Demandes" count={toPrepare.length} empty="Rien à préparer.">
            {toPrepare.map(r => (
              <li key={r.id} className="flex justify-between items-center gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.requester_name}{r.destination ? ` · ${r.destination}` : ''}</div>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{r.number} · {formatPeriod(r.start_at, r.end_at)}</div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${REQUEST_STATUS[r.status].className}`}>{REQUEST_STATUS[r.status].label}</span>
              </li>
            ))}
          </Block>

          <Block title="Retours en retard" to="/checkouts" link="Sorties" count={overdue.length} empty="Aucun retard.">
            {overdue.slice(0, 8).map(c => (
              <li key={c.id} className="flex justify-between items-center gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{itemName(c.equipmentId)}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{userName(c.userId)} · prévu le {new Date(c.dueDate).toLocaleDateString('fr-CH')}</div>
                </div>
                <span className="shrink-0 rounded bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200 px-2 py-0.5 text-[11px] font-bold">{daysLate(c.dueDate)} j</span>
              </li>
            ))}
          </Block>

          <Block title="Stock bas" to="/commande" link="Feuille de commande" count={lowStock.length} empty="Tous les consommables sont au-dessus de leur seuil.">
            {lowStock.slice(0, 8).map(s => {
              const item = equipment.find(e => e.id === s.equipmentId);
              return (
                <li key={s.id} className="flex justify-between items-center gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item?.name ?? 'Consommable'}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{depots.find(d => d.id === s.depotId)?.name}</div>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-warning-800 dark:text-warning-200">{s.quantity} / {s.minQuantity} {item?.unit}</span>
                </li>
              );
            })}
          </Block>

          <Block title="Véhicules" to="/vehicules" link="Flotte" count={vehiclesOut.length + vehicleWarnings.length} empty="Aucun véhicule sorti ni échéance proche.">
            {vehiclesOut.map(v => (
              <li key={v.id} className="flex justify-between items-center gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.name}</div>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{v.plate}</div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${VEHICLE_STATUS[v.status].className}`}>{VEHICLE_STATUS[v.status].label}</span>
              </li>
            ))}
            {vehicleWarnings.filter(v => v.status !== 'in_use').map(v => (
              <li key={`w-${v.id}`} className="flex justify-between items-center gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.name}</div>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{v.plate}</div>
                </div>
                <span className="shrink-0 rounded bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200 px-2 py-0.5 text-[11px] font-bold">Échéance proche</span>
              </li>
            ))}
          </Block>
        </div>
      )}
    </div>
  );
};

export default Today;
