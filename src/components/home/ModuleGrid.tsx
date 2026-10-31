import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MxModuleCard, type MxModuleCardMetric } from '../mx/MxModuleCard';
import { useNavSpaces } from '../../lib/useNavSpaces';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// Accueil comme le tableau de bord de Mannyx : une carte par module accessible, avec 3 chiffres.
// Pour un collaborateur, la carte Magasin montre ses propres chiffres (son matériel, ses demandes).
const ModuleGrid: React.FC<{ toApprove: number; toPrepare: number; myRequests: number }> = ({ toApprove, toPrepare, myRequests }) => {
  const spaces = useNavSpaces();
  const { equipment, checkouts, consumableStock, vehicles, users, depots } = useApp();
  const { profile, can } = useAuth();
  const [openSites, setOpenSites] = useState<number | null>(null);
  const [openRentals, setOpenRentals] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('sites').select('id', { count: 'exact', head: true }).eq('status', 'open')
      .then(({ count }) => setOpenSites(count ?? 0));
    supabase.from('rentals').select('id', { count: 'exact', head: true }).is('returned_on', null)
      .then(({ count }) => setOpenRentals(count ?? 0));
  }, []);

  const now = Date.now();
  const active = checkouts.filter(c => c.status === 'active' || c.status === 'overdue');
  const late = active.filter(c => c.status === 'overdue' || (c.dueDate && new Date(c.dueDate).getTime() < now));
  const mine = active.filter(c => c.userId === profile?.id);
  const tools = equipment.filter(e => e.itemType !== 'consumable' && e.status !== 'retired');
  const consumables = equipment.filter(e => e.itemType === 'consumable');
  const low = consumableStock.filter(s => s.minQuantity > 0 && s.quantity < s.minQuantity).length;
  const staff = can('scan') || can('view_all') || can('approve');
  const metric = (id: string, label: string, value: number | null): MxModuleCardMetric => ({
    id, label, value: value === null ? '' : value.toLocaleString('fr-CH'), loading: value === null,
  });

  const metrics: Record<string, MxModuleCardMetric[]> = {
    store: staff
      ? [metric('prep', 'Demandes à préparer', toPrepare), metric('out', 'Outils sortis', active.length), metric('late', 'Retours en retard', late.length)]
      : [metric('mine', 'Mon matériel', mine.length), metric('req', 'Mes demandes en cours', myRequests), metric('late', 'En retard', mine.filter(c => late.includes(c)).length)],
    tools: [
      metric('tools', 'Outils', tools.length),
      metric('maint', 'En maintenance', tools.filter(e => e.status === 'maintenance').length),
      metric('out', 'Sortis', tools.filter(e => e.status === 'checked-out').length),
    ],
    supplies: [metric('items', 'Consommables', consumables.length), metric('low', 'Sous le seuil', low), metric('depots', 'Dépôts', depots.length)],
    fleet: [
      metric('fleet', 'Véhicules', vehicles.filter(v => v.status !== 'retired').length),
      metric('used', 'Sortis', vehicles.filter(v => v.status === 'in_use').length),
      metric('rentals', 'Locations en cours', openRentals),
    ],
    sites: [metric('sites', 'Chantiers en cours', openSites), metric('out', 'Outils sortis', active.length), metric('late', 'Retours en retard', late.length)],
    people: [
      metric('people', 'Personnes actives', users.filter(u => u.active !== false).length),
      metric('temp', 'Intérimaires', users.filter(u => u.personKind === 'temp' && u.active !== false).length),
      metric('never', 'Jamais connectées', users.filter(u => !u.linked && u.active !== false).length),
    ],
    steering: [metric('approve', 'Demandes à valider', toApprove), metric('late', 'Retours en retard', late.length), metric('low', 'Consommables sous le seuil', low)],
    settings: [metric('depots', 'Dépôts', depots.length), metric('people', 'Utilisateurs', users.length), metric('items', 'Articles', equipment.length)],
  };

  const cards = spaces.filter(s => metrics[s.id]);
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-[calc(16px*var(--mx-scale,1))]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(calc(260px * var(--mx-scale, 1)), 1fr))' }}>
      {cards.map(space => (
        <MxModuleCard
          key={space.id}
          icon={space.icon}
          title={space.label}
          metrics={metrics[space.id]}
          renderLink={linkProps => <Link to={space.links[0].to} {...linkProps} />}
        />
      ))}
    </div>
  );
};

export default ModuleGrid;
