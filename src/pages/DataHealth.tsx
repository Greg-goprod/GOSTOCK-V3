import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';

interface Check {
  id: string;
  title: string;
  why: string;
  to: string;
  items: string[];
}

// « Rouleau  Ø 12 » et « rouleau ø12 » : même article pour la détection des doublons
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const duplicates = <T,>(list: T[], key: (item: T) => string | null | undefined, label: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.values()].filter(g => g.length > 1).map(g => g.map(label).join('  ·  '));
};

// Santé des données : ce qui manque ou se répète, avant de lancer les équipes
const DataHealth: React.FC = () => {
  const { equipment, users, vehicles, consumableStock } = useApp();
  const [extra, setExtra] = useState<{ id: string; ean: string | null; serial_number: string | null }[]>([]);
  const [badgeIds, setBadgeIds] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('equipment').select('id, ean, serial_number').then(({ data }) => setExtra(data || []));
    supabase.from('user_badges').select('user_id').then(({ data, error }) => setBadgeIds(error ? null : new Set((data || []).map(b => b.user_id))));
  }, []);

  const checks = useMemo<Check[]>(() => {
    const live = equipment.filter(e => e.status !== 'retired');
    const tools = live.filter(e => e.itemType !== 'consumable');
    const consumables = live.filter(e => e.itemType === 'consumable');
    const activeUsers = users.filter(u => u.active !== false);
    const name = (id: string) => live.find(e => e.id === id)?.name ?? '';
    const today = new Date().toISOString().slice(0, 10);
    return [
      { id: 'dup-name', title: 'Articles en double (même nom)', why: 'Le stock et les coûts se dispersent sur deux fiches.', to: '/equipment',
        items: duplicates(live, e => normalize(e.name), e => `${e.name}${e.articleNumber ? ` (${e.articleNumber})` : ''}`) },
      { id: 'dup-serial', title: 'Numéros de série en double', why: 'Un scan tombe sur la mauvaise fiche.', to: '/equipment',
        items: duplicates(extra, e => e.serial_number?.trim().toUpperCase(), e => `${name(e.id)} · ${e.serial_number}`) },
      { id: 'dup-ean', title: 'Codes EAN en double', why: 'Le scan du code-barres fabricant devient ambigu.', to: '/equipment',
        items: duplicates(extra, e => e.ean?.trim(), e => `${name(e.id)} · ${e.ean}`) },
      { id: 'no-price', title: 'Articles sans prix d\'achat', why: 'Valeur du stock, pertes et amortissement faux.', to: '/equipment',
        items: live.filter(e => !e.purchasePrice).map(e => e.name) },
      { id: 'no-rate', title: 'Outils sans tarif par jour', why: 'Les jours d\'outils ne comptent pas dans les coûts de chantier.', to: '/equipment',
        items: tools.filter(e => !e.dailyRate).map(e => e.name) },
      { id: 'no-photo', title: 'Articles sans photo', why: 'Plus difficile à reconnaître pour les collaborateurs.', to: '/equipment',
        items: live.filter(e => !e.imageUrl).map(e => e.name) },
      { id: 'no-bought', title: 'Outils sans date d\'achat', why: 'Amortissement compté depuis la création de la fiche.', to: '/equipment',
        items: tools.filter(e => (e.purchasePrice ?? 0) > 0 && !e.purchaseDate).map(e => e.name) },
      { id: 'no-threshold', title: 'Consommables sans seuil', why: 'Pas d\'alerte de stock bas ni de commande proposée.', to: '/consommables',
        items: consumables.filter(e => !consumableStock.some(s => s.equipmentId === e.id && s.minQuantity > 0)).map(e => e.name) },
      { id: 'no-badge', title: 'Personnes sans badge', why: 'Impossible de les servir au comptoir par scan.', to: '/badges',
        items: badgeIds ? activeUsers.filter(u => !badgeIds.has(u.id)).map(u => `${u.first_name} ${u.last_name}`) : [] },
      { id: 'no-license', title: 'Personnes sans permis renseigné', why: 'Toute réservation de véhicule leur est refusée.', to: '/users',
        items: vehicles.length ? activeUsers.filter(u => !u.licenseCategories?.length).map(u => `${u.first_name} ${u.last_name}`) : [] },
      { id: 'never', title: 'Personnes jamais connectées', why: 'Elles ne voient ni leurs demandes ni leurs avis.', to: '/users',
        items: activeUsers.filter(u => !u.linked).map(u => `${u.first_name} ${u.last_name} · ${u.email}`) },
      { id: 'temp-no-end', title: 'Intérimaires sans date de fin d\'accès', why: 'Leur accès ne se coupe pas tout seul.', to: '/users',
        items: activeUsers.filter(u => u.personKind && u.personKind !== 'employee' && !u.accessUntil).map(u => `${u.first_name} ${u.last_name}`) },
      { id: 'vehicle-dates', title: 'Véhicules sans date d\'expertise ou de service', why: 'Pas de rappel avant l\'échéance.', to: '/vehicules',
        items: vehicles.filter(v => v.status !== 'retired' && (!v.inspectionDate || !v.nextServiceDate)).map(v => `${v.name} · ${v.plate}`) },
      { id: 'warranty-past', title: 'Garanties échues encore notées', why: 'Information, rien à corriger.', to: '/atelier',
        items: tools.filter(e => e.warrantyUntil && e.warrantyUntil < today).map(e => e.name) },
    ];
  }, [equipment, users, vehicles, consumableStock, extra, badgeIds]);

  const issues = checks.filter(c => c.items.length && c.id !== 'warranty-past');
  const score = Math.round(((checks.length - 1 - issues.length) / (checks.length - 1)) * 100);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="mx-page-title">Santé des données</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Ce qui manque ou se répète. Une base propre, ce sont des coûts justes et des alertes utiles.</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-4">
        <span className={`font-mono text-4xl font-bold ${score >= 80 ? 'text-tone-success' : score >= 50 ? 'text-tone-warning' : 'text-tone-danger'}`}>{score} %</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{issues.length ? `${issues.length} point${issues.length > 1 ? 's' : ''} à reprendre` : 'Tout est en ordre.'}</span>
      </div>
      {/* Accordéon séparé de la charte (#s-accordion) : un contrôle par élément */}
      <ul>
        {checks.map(c => {
          const ok = c.items.length === 0;
          const isOpen = open === c.id && !ok;
          return (
            <li key={c.id} className={`mx-acc ${isOpen ? 'is-open' : ''}`}>
              <button type="button" aria-expanded={isOpen} disabled={ok} onClick={() => setOpen(open === c.id ? null : c.id)}
                className="mx-acc-head disabled:cursor-default">
                <span className="mx-acc-icon" aria-hidden="true">
                  {ok ? <CheckCircle2 size={18} className="text-tone-success" style={{ color: 'var(--mx-tone-text-success)' }} /> : <AlertTriangle size={18} />}
                </span>
                <span className="mx-acc-title">
                  <span className={`block ${ok ? 'text-gray-500 dark:text-gray-400 font-semibold' : ''}`}>{c.title}</span>
                  {!ok && <span className="block text-xs font-normal text-gray-600 dark:text-gray-400">{c.why}</span>}
                </span>
                <span className={`font-mono text-sm ${ok ? 'text-gray-400' : 'font-bold text-tone-warning'}`}>{c.items.length}</span>
                {!ok && <ChevronDown size={18} className="mx-acc-chevron" aria-hidden="true" />}
              </button>
              {isOpen && (
                <div className="mx-acc-body space-y-2">
                  <ul className="text-sm text-gray-800 dark:text-gray-200 max-h-64 overflow-y-auto space-y-0.5">
                    {c.items.slice(0, 200).map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                  <Link to={c.to} className="mx-btn mx-btn-secondary inline-flex items-center px-3.5 py-1.5 text-[12.5px]">Corriger →</Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DataHealth;
