import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';

interface RequestRow {
  id: string;
  number: string;
  requester_name: string;
  destination: string | null;
  depot_id: string;
  start_at: string;
  status: 'approved' | 'ready';
}

interface Incoming {
  key: string;
  label: string;
  when: string;
}

const REFRESH_MS = 60_000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const Column: React.FC<{ title: string; count: number; tone: string; children: React.ReactNode }> = ({ title, count, tone, children }) => (
  <section className="flex flex-col min-h-0 rounded-2xl bg-gray-900 border border-gray-800 p-5">
    <h2 className="flex items-baseline justify-between gap-3 mb-4">
      <span className="text-2xl font-black uppercase tracking-tight text-white">{title}</span>
      <span className={`font-mono text-5xl font-bold ${tone}`}>{count}</span>
    </h2>
    <ul className="space-y-2 overflow-hidden">{children}</ul>
  </section>
);

const Row: React.FC<{ main: string; sub: string; alert?: boolean }> = ({ main, sub, alert }) => (
  <li className={`rounded-lg px-4 py-3 ${alert ? 'bg-danger-900/60' : 'bg-gray-800'}`}>
    <p className="text-xl font-semibold text-white truncate">{main}</p>
    <p className={`text-base truncate ${alert ? 'text-danger-200' : 'text-gray-300'}`}>{sub}</p>
  </li>
);

// Écran mural du magasin : préparations du jour, retours attendus, retards, arrivées (rafraîchi chaque minute)
const WallScreen: React.FC = () => {
  const { checkouts, equipment, users, depots, refreshData } = useApp();
  const [params, setParams] = useSearchParams();
  const depotId = params.get('depot') ?? '';
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const [r, t, l] = await Promise.all([
        supabase.from('requests_overview').select('id, number, requester_name, destination, depot_id, start_at, status').in('status', ['approved', 'ready']).order('start_at'),
        supabase.from('transfers').select('id, number, to_depot_id, sent_at, transfer_lines(id)').eq('status', 'in_transit'),
        supabase.from('rental_status').select('id, description, rental_company, end_on, depot_id, state').neq('state', 'returned'),
      ]);
      setRequests((r.data || []) as RequestRow[]);
      const soon = new Date(startOfToday() + 2 * 86400000).toISOString().slice(0, 10);
      setIncoming([
        ...(t.data || []).filter(x => !depotId || x.to_depot_id === depotId).map(x => ({
          key: x.id, label: `Transfert ${x.number} (${(x.transfer_lines as unknown[]).length} lignes)`, when: `envoyé le ${new Date(x.sent_at).toLocaleDateString('fr-CH')}`,
        })),
        ...(l.data || []).filter(x => (!depotId || !x.depot_id || x.depot_id === depotId) && x.end_on <= soon).map(x => ({
          key: x.id, label: `Location à rendre : ${x.description}`, when: `${x.rental_company} · ${x.state === 'overdue' ? 'EN RETARD' : `le ${new Date(x.end_on).toLocaleDateString('fr-CH')}`}`,
        })),
      ]);
    };
    load();
    const timer = window.setInterval(() => { load(); refreshData(); }, REFRESH_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { window.clearInterval(timer); window.clearInterval(clock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depotId]);

  const today = startOfToday();
  const tomorrow = today + 86400000;
  const name = (id: string) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : '';
  };
  const item = (id: string) => equipment.find(e => e.id === id);
  const inDepot = (equipmentId: string) => !depotId || !item(equipmentId)?.depotId || item(equipmentId)?.depotId === depotId;
  const out = checkouts.filter(c => (c.status === 'active' || c.status === 'overdue') && !c.droppedAt && inDepot(c.equipmentId));
  const toPrepare = requests.filter(r => (!depotId || r.depot_id === depotId) && new Date(r.start_at).getTime() < tomorrow);
  const dueToday = out.filter(c => { const t = new Date(c.dueDate).getTime(); return t >= today && t < tomorrow; });
  const late = out.filter(c => new Date(c.dueDate).getTime() < now).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-3xl font-black tracking-tight text-primary-300">GO-Mat</Link>
          <select value={depotId} onChange={e => setParams(e.target.value ? { depot: e.target.value } : {})} aria-label="Dépôt"
            className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-lg text-white">
            <option value="">Tous les dépôts</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <p className="font-mono text-5xl font-bold">{new Date(now).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</p>
      </header>

      <div className="grid flex-1 min-h-0 gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Column title="À préparer" count={toPrepare.length} tone="text-primary-300">
          {toPrepare.slice(0, 8).map(r => (
            <Row key={r.id} main={`${r.requester_name}${r.status === 'ready' ? ' · prête' : ''}`}
              sub={`${r.number} · ${r.destination ?? 'sans chantier'} · ${new Date(r.start_at).getTime() < today ? 'en retard' : time(r.start_at)}`} alert={new Date(r.start_at).getTime() < now && r.status !== 'ready'} />
          ))}
        </Column>
        <Column title="Retours du jour" count={dueToday.length} tone="text-info-300">
          {dueToday.slice(0, 8).map(c => <Row key={c.id} main={item(c.equipmentId)?.name ?? 'Article'} sub={`${name(c.userId)} · ${time(c.dueDate)}`} />)}
        </Column>
        <Column title="En retard" count={late.length} tone="text-danger-400">
          {late.slice(0, 8).map(c => {
            const days = Math.floor((now - new Date(c.dueDate).getTime()) / 86400000);
            return <Row key={c.id} main={item(c.equipmentId)?.name ?? 'Article'} sub={`${name(c.userId)} · ${days > 0 ? `${days} j` : 'aujourd\'hui'}`} alert={days >= 3} />;
          })}
        </Column>
        <Column title="À recevoir / rendre" count={incoming.length} tone="text-warning-300">
          {incoming.slice(0, 8).map(i => <Row key={i.key} main={i.label} sub={i.when} alert={i.when.includes('RETARD')} />)}
        </Column>
      </div>
      <p className="text-sm text-gray-500">Mis à jour chaque minute. Plein écran : touche F11.</p>
    </div>
  );
};

export default WallScreen;
