import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { CheckoutRecord, Equipment, User } from '../types';

interface ResultBlock {
  title: string;
  lines: { main: string; sub?: string; alert?: boolean }[];
}

interface SiteItem {
  site_id: string;
  kind: string;
  label: string;
  holder: string | null;
  due_at: string;
  late: boolean;
}

// Sans accents, minuscules, sans articles : « Où est la meule 230 ? » → « meule 230 »
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'mon', 'ma', 'mes', 'notre', 'nos', 'est', 'sont', 'a', 'au', 'aux', 'en', 'sur']);
const words = (s: string) => fold(s).replace(/[?!.,;:'’"]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const matchesAll = (text: string, terms: string[]) => {
  const hay = fold(text);
  return terms.length > 0 && terms.every(t => hay.includes(t));
};

const EXAMPLES = ['qui a la meule 230 ?', 'où est le laser', 'chantier Renens', 'en retard', 'stock gants', 'matériel de Marc'];

// Recherche en langage courant sur les données visibles : qui a quoi, où, sur quel chantier, en retard, en stock
const Search: React.FC = () => {
  const { equipment, checkouts, users, depots, consumableStock } = useApp();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const query = params.get('q') ?? '';
  // Recherche lancée depuis la recherche rapide (Ctrl+K) alors que la page est déjà ouverte
  useEffect(() => {
    setText(query);
  }, [query]);
  const [sites, setSites] = useState<{ id: string; name: string; status: string }[]>([]);
  const [siteItems, setSiteItems] = useState<SiteItem[]>([]);

  useEffect(() => {
    Promise.all([supabase.from('sites').select('id, name, status'), supabase.from('site_open_items').select('*')])
      .then(([s, i]) => { setSites(s.data || []); setSiteItems((i.data || []) as SiteItem[]); });
  }, []);

  const name = (u?: User) => (u ? `${u.first_name} ${u.last_name}` : 'Quelqu\'un');
  const active = checkouts.filter(c => c.status === 'active' || c.status === 'overdue');
  const depotName = (id?: string) => depots.find(d => d.id === id)?.name ?? depots.find(d => d.isDefault)?.name ?? 'dépôt';
  const siteOf = (c: CheckoutRecord) => c.notes?.split(' · ').find(p => !p.startsWith('Demande ') && !p.startsWith('retiré par'))?.trim();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-CH');

  const whereIs = (item: Equipment): ResultBlock => {
    const out = active.filter(c => c.equipmentId === item.id);
    const lines = out.map(c => ({
      main: `Chez ${name(users.find(u => u.id === c.userId))}`,
      sub: `depuis le ${fmt(c.checkoutDate)}${siteOf(c) ? ` · ${siteOf(c)}` : ''} · retour ${fmt(c.dueDate)}${c.droppedAt ? ' · déposé dans la boîte' : ''}`,
      alert: new Date(c.dueDate).getTime() < Date.now() && !c.droppedAt,
    }));
    const total = item.totalQuantity ?? 1;
    if (item.status === 'maintenance') lines.push({ main: 'En maintenance ou en réparation', sub: '', alert: false });
    if (out.length < total && item.status !== 'retired') {
      lines.push({ main: `${total - out.length} disponible${total - out.length > 1 ? 's' : ''} au ${depotName(item.depotId)}`, sub: item.location ?? '', alert: false });
    }
    return { title: `${item.name}${item.articleNumber ? ` · ${item.articleNumber}` : ''}`, lines };
  };

  const results = useMemo<ResultBlock[]>(() => {
    const q = fold(query.trim());
    if (!q) return [];
    const findItems = (terms: string[]) => equipment.filter(e => e.status !== 'retired' && matchesAll(`${e.name} ${e.articleNumber ?? ''} ${e.serialNumber ?? ''} ${e.shortTitle ?? ''}`, terms));
    const findPeople = (terms: string[]) => users.filter(u => matchesAll(`${u.first_name} ${u.last_name}`, terms));

    // « en retard »
    if (/\b(en )?retards?\b/.test(q)) {
      const late = active.filter(c => new Date(c.dueDate).getTime() < Date.now() && !c.droppedAt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return [{ title: `En retard (${late.length})`, lines: late.map(c => ({ main: equipment.find(e => e.id === c.equipmentId)?.name ?? 'Article', sub: `${name(users.find(u => u.id === c.userId))} · prévu le ${fmt(c.dueDate)}`, alert: true })) }];
    }

    // « chantier Renens », « qu'est-ce qui est sur le chantier Renens »
    const siteMatch = q.match(/chantier\s+(.+)/);
    if (siteMatch) {
      const terms = words(siteMatch[1]);
      const found = sites.filter(s => matchesAll(s.name.replace(/^chantier\s+/i, ''), terms) || matchesAll(s.name, terms));
      if (found.length) {
        return found.map(s => {
          const items = siteItems.filter(i => i.site_id === s.id);
          return { title: `${s.name}${s.status === 'closed' ? ' (clôturé)' : ''} · ${items.length} élément(s)`, lines: items.map(i => ({ main: `${i.kind === 'rental' ? 'Location · ' : ''}${i.label}`, sub: `${i.holder ?? ''} · retour ${fmt(i.due_at)}`, alert: i.late })) };
        });
      }
      // Chantier sans fiche : d'après le texte des sorties
      const loose = active.filter(c => matchesAll(c.notes ?? '', terms));
      return [{ title: `Sorties mentionnant « ${siteMatch[1]} » (${loose.length})`, lines: loose.map(c => ({ main: equipment.find(e => e.id === c.equipmentId)?.name ?? 'Article', sub: `${name(users.find(u => u.id === c.userId))} · retour ${fmt(c.dueDate)}` })) }];
    }

    // « stock gants », « combien de disques »
    const stockMatch = q.match(/^(stock|combien|reste)\s+(.+)/);
    if (stockMatch) {
      const items = findItems(words(stockMatch[2])).filter(e => e.itemType === 'consumable');
      return items.map(e => ({
        title: e.name,
        lines: depots.map(d => {
          const s = consumableStock.find(x => x.equipmentId === e.id && x.depotId === d.id);
          return { main: `${d.name} : ${s ? s.quantity.toLocaleString('fr-CH') : 0} ${e.unit ?? ''}`, sub: s && s.minQuantity ? `seuil ${s.minQuantity}` : '', alert: !!s && s.quantity <= s.minQuantity };
        }),
      }));
    }

    // « matériel de Marc », « qu'a Sarah »
    const personMatch = q.match(/(materiel|outils|qu'?a|que possede|ce qu'a)\s+(de\s+|d')?(.+)/);
    if (personMatch) {
      const people = findPeople(words(personMatch[3]));
      if (people.length) {
        return people.map(u => {
          const held = active.filter(c => c.userId === u.id);
          return { title: `${name(u)} · ${held.length} article(s)`, lines: held.map(c => ({ main: equipment.find(e => e.id === c.equipmentId)?.name ?? 'Article', sub: `depuis le ${fmt(c.checkoutDate)}${siteOf(c) ? ` · ${siteOf(c)}` : ''} · retour ${fmt(c.dueDate)}`, alert: new Date(c.dueDate).getTime() < Date.now() })) };
        });
      }
    }

    // « qui a la meule 230 », « où est le laser », ou simplement « meule 230 »
    const itemQuery = q.replace(/^(qui (a|possede|utilise)|ou (est|sont)|ou se trouve|trouver)\s+/, '');
    const items = findItems(words(itemQuery));
    const blocks = items.slice(0, 12).map(whereIs);
    // Recherche libre : aussi les personnes et les chantiers qui correspondent
    if (itemQuery === q) {
      for (const u of findPeople(words(q)).slice(0, 5)) {
        const held = active.filter(c => c.userId === u.id);
        blocks.push({ title: `${name(u)} · ${held.length} article(s)`, lines: held.slice(0, 10).map(c => ({ main: equipment.find(e => e.id === c.equipmentId)?.name ?? 'Article', sub: `retour ${fmt(c.dueDate)}` })) });
      }
      for (const s of sites.filter(x => matchesAll(x.name, words(q))).slice(0, 5)) {
        const n = siteItems.filter(i => i.site_id === s.id).length;
        blocks.push({ title: `Chantier ${s.name}`, lines: [{ main: `${n} élément(s) sur le chantier`, sub: 'Cherchez « chantier ' + s.name.replace(/^chantier\s+/i, '') + ' » pour le détail' }] });
      }
    }
    return blocks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, equipment, checkouts, users, sites, siteItems, consumableStock, depots]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setParams(text.trim() ? { q: text.trim() } : {});
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="mx-page-title">Recherche</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Posez la question comme vous la diriez au magasin.</p>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">Question</label>
        <input id="search-q" type="search" value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="qui a la meule 230 ?"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-100" />
        <button type="submit" aria-label="Chercher" className="min-w-[48px] rounded-md bg-primary-600 px-4 text-white"><SearchIcon size={20} /></button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map(ex => (
          <button key={ex} type="button" onClick={() => { setText(ex); setParams({ q: ex }); }}
            className="rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            {ex}
          </button>
        ))}
      </div>

      {query && results.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">Rien trouvé pour « {query} ». Essayez avec moins de mots, ou le numéro d'article.</p>}
      <div className="space-y-3">
        {results.map((block, i) => (
          <section key={`${block.title}-${i}`} className="rounded-lg bg-white dark:bg-gray-800 shadow p-4">
            <h2 className="font-bold text-gray-900 dark:text-white">{block.title}</h2>
            {block.lines.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">Rien en cours.</p> : (
              <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                {block.lines.map((line, j) => (
                  <li key={j} className="py-1.5">
                    <p className={line.alert ? 'font-semibold text-danger-700 dark:text-danger-300' : 'text-gray-900 dark:text-gray-100'}>{line.main}</p>
                    {line.sub && <p className="text-xs text-gray-600 dark:text-gray-400">{line.sub}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default Search;
