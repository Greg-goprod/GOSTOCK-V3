import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowLeftRight, CalendarRange, ClipboardList, Contact, Gauge, Hand, HardHat, Inbox, ListChecks, PackageOpen,
  Plus, ScanBarcode, ScanLine, Search, Settings, Tags, Truck, Undo2, Users, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/roles';
import { canAccess } from '../lib/access';
import { supabase } from '../lib/supabase';
import { REQUEST_STATUS, formatPeriod } from '../lib/requests';
import { RequestOverview } from '../types';
import Today from './Today';
import PageTitle from '../components/common/PageTitle';

interface Action {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  count?: number;
  tone?: 'warn' | 'bad';
  // Action principale du rôle : tuile large, en couleur d'accent
  primary?: boolean;
  state?: unknown;
}

// Tuile d'action (carte module de la charte) : icône sur fond accent, libellé, compteur
const ActionTile: React.FC<{ action: Action }> = ({ action }) => {
  const navigate = useNavigate();
  const { icon: Icon } = action;
  return (
    <button
      type="button"
      onClick={() => navigate(action.to, action.state ? { state: action.state } : undefined)}
      className={`group mx-card mx-card-hover text-left p-4 flex items-start gap-3 min-h-[92px] ${action.primary ? 'mx-tile-primary sm:col-span-2 !bg-primary-600 !border-primary-600 text-white' : ''}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${action.primary ? 'bg-white/20 text-white' : 'bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300'}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-bold tracking-[-0.02em] ${action.primary ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{action.label}</span>
        <span className={`block text-[12.5px] mt-0.5 ${action.primary ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>{action.hint}</span>
      </span>
      {action.count !== undefined && action.count > 0 && (
        <span className={`shrink-0 font-mono text-[22px] font-bold tabular-nums ${
          action.primary ? 'text-white' : action.tone === 'bad' ? 'text-tone-danger' : action.tone === 'warn' ? 'text-tone-warning' : 'text-gray-900 dark:text-white'
        }`}>{action.count}</span>
      )}
    </button>
  );
};

// Accueil adapté au rôle : les gestes du quotidien en tête, puis le tableau du magasin ou « mon matériel »
const Home: React.FC = () => {
  const { profile, can } = useAuth();
  const { checkouts, consumableStock, equipment, loadingAppData } = useApp();
  const [requests, setRequests] = useState<RequestOverview[]>([]);
  const [transfersIn, setTransfersIn] = useState(0);

  useEffect(() => {
    supabase.from('requests_overview').select('*').in('status', ['requested', 'approved', 'ready', 'out']).order('start_at')
      .then(({ data }) => setRequests((data || []) as RequestOverview[]));
    if (can('scan') || can('manage_stock')) {
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('status', 'in_transit')
        .then(({ count }) => setTransfersIn(count ?? 0));
    }
  }, [can]);

  const role = profile?.role ?? 'user';
  const isStore = can('scan') || can('manage_stock');
  const isLead = can('approve');

  const toApprove = requests.filter(r => r.status === 'requested').length;
  const toPrepare = requests.filter(r => ['approved', 'ready'].includes(r.status)).length;
  const overdue = checkouts.filter(c => c.status === 'overdue' || (c.status === 'active' && c.dueDate && new Date(c.dueDate).getTime() < Date.now())).length;
  const dropped = checkouts.filter(c => c.status !== 'returned' && c.droppedAt).length;
  const lowStock = consumableStock.filter(s => s.minQuantity > 0 && s.quantity < s.minQuantity).length;
  const mine = useMemo(
    () => checkouts.filter(c => c.userId === profile?.id && (c.status === 'active' || c.status === 'overdue')),
    [checkouts, profile?.id],
  );
  const myRequests = requests.filter(r => r.requester_id === profile?.id);

  // Gestes par rôle, dans l'ordre d'usage ; filtrés ensuite par les droits réels
  const actions: Action[] = useMemo(() => {
    if (role === 'user') {
      return [
        { to: '/badge', label: 'Mon badge', hint: 'À présenter au magasin pour emprunter ou rendre', icon: Contact, primary: true },
        { to: '/demandes', label: 'Nouvelle demande', hint: 'Réserver des outils, consommables ou un véhicule', icon: Plus, state: { newRequest: true } },
        { to: '/demandes', label: 'Mon matériel', hint: 'Ce que j\'ai emprunté et quand le rendre', icon: PackageOpen, count: mine.length },
        { to: '/libre-service', label: 'Libre-service', hint: 'Prendre des consommables, déposer un outil', icon: Hand },
        { to: '/recherche', label: 'Recherche', hint: 'Qui a quoi, où, quel chantier', icon: Search },
      ];
    }
    const store: Action[] = [
      { to: '/scan', label: 'Scanner', hint: 'Identifier un outil, une personne, un bon', icon: ScanLine, primary: true },
      { to: '/comptoir', label: 'Comptoir', hint: 'Badge puis articles : sortie ou retour', icon: ScanBarcode },
      { to: '/demandes', label: 'Demandes à préparer', hint: 'Validées, à sortir aujourd\'hui ou demain', icon: Inbox, count: toPrepare },
      { to: '/checkouts', label: 'Retours en retard', hint: 'À relancer', icon: Undo2, count: overdue, tone: 'bad' },
      { to: '/comptoir', label: 'Boîte de retour', hint: 'Outils déposés hors horaires, à contrôler', icon: PackageOpen, count: dropped, tone: 'warn' },
      { to: '/transferts', label: 'Transferts à recevoir', hint: 'Matériel en route vers un dépôt', icon: ArrowLeftRight, count: transfersIn },
      { to: '/commande', label: 'À commander', hint: 'Consommables sous le seuil', icon: ClipboardList, count: lowStock, tone: 'warn' },
      { to: '/inventaire', label: 'Inventaire', hint: 'Comptage tournant de la semaine', icon: ListChecks },
      { to: '/etiquettes', label: 'Étiquettes', hint: 'Imprimer les QR des outils', icon: Tags },
    ];
    if (!isLead) return store;
    const lead: Action[] = [
      { to: '/demandes', label: 'Demandes à valider', hint: 'En attente de ta décision', icon: Inbox, count: toApprove, tone: 'warn', primary: true },
      { to: '/checkouts', label: 'Retours en retard', hint: 'À relancer', icon: Undo2, count: overdue, tone: 'bad' },
      { to: '/commande', label: 'À commander', hint: 'Consommables sous le seuil', icon: ClipboardList, count: lowStock, tone: 'warn' },
      { to: '/planning', label: 'Planning', hint: 'Outils et véhicules réservés, conflits', icon: CalendarRange },
      { to: '/chantiers', label: 'Chantiers', hint: 'Budget, matériel sur place, rapports', icon: HardHat },
      { to: '/vehicules', label: 'Véhicules', hint: 'Flotte, réservations, échéances', icon: Truck },
      { to: '/comptoir', label: 'Comptoir', hint: 'Sortir ou rentrer du matériel', icon: ScanBarcode },
      { to: '/pilotage', label: 'Pilotage', hint: 'Utilisation, retards, coûts', icon: Gauge },
    ];
    if (role === 'admin') {
      lead.push(
        { to: '/users', label: 'Personnes', hint: 'Accès, rôles, badges, départs', icon: Users },
        { to: '/settings', label: 'Paramètres', hint: 'Dépôts, seuils, sauvegarde, alertes', icon: Settings },
      );
    }
    return lead;
  }, [role, isLead, mine.length, toPrepare, overdue, dropped, transfersIn, lowStock, toApprove]);

  const visible = actions.filter(a => canAccess(a.to, can));
  const itemName = (id: string) => equipment.find(e => e.id === id)?.name ?? 'Article';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mx-section-label">{profile ? ROLE_LABELS[profile.role] : ''}</p>
          <PageTitle className="mt-2">{greeting}{profile ? `, ${profile.first_name}` : ''}</PageTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2 first-letter:uppercase">
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </header>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="mx-section-label mb-3">Actions rapides</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map(action => <ActionTile key={`${action.to}-${action.label}`} action={action} />)}
        </div>
      </section>

      {isStore || isLead ? (
        <section aria-labelledby="store-board">
          <h2 id="store-board" className="mx-section-label mb-3">Aujourd'hui au magasin</h2>
          <Today />
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="mx-card p-5" aria-labelledby="home-mine">
            <div className="flex justify-between items-baseline gap-2 mb-2">
              <h2 id="home-mine" className="text-[16px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white">{`Mon matériel (${mine.length})`}</h2>
              <Link to="/demandes" className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1 min-h-[44px] lg:min-h-[28px] px-2 -mr-2 rounded">Détail <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            {loadingAppData ? <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p> : mine.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Tu n'as rien en prêt.</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {mine.slice(0, 8).map(c => {
                  const late = c.dueDate && new Date(c.dueDate).getTime() < Date.now();
                  return (
                    <li key={c.id} className="flex justify-between gap-3 py-2 text-sm">
                      <span className="truncate text-gray-900 dark:text-gray-100">{itemName(c.equipmentId)}</span>
                      <span className={`shrink-0 font-mono ${late ? 'text-tone-danger font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                        {c.dueDate ? `à rendre le ${new Date(c.dueDate).toLocaleDateString('fr-CH')}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="mx-card p-5" aria-labelledby="home-requests">
            <div className="flex justify-between items-baseline gap-2 mb-2">
              <h2 id="home-requests" className="text-[16px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white">Mes demandes en cours</h2>
              <Link to="/demandes" className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-1 min-h-[44px] lg:min-h-[28px] px-2 -mr-2 rounded">Toutes <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            {myRequests.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Aucune demande en cours.</p> : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {myRequests.slice(0, 6).map(r => (
                  <li key={r.id} className="flex justify-between items-center gap-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.destination || r.number}</div>
                      <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{formatPeriod(r.start_at, r.end_at)}</div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${REQUEST_STATUS[r.status].className}`}>{REQUEST_STATUS[r.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Home;
