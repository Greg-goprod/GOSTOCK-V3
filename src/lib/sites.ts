import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Chantiers proposés à la saisie : d'abord les fiches chantier ouvertes, puis les noms déjà saisis
// (demandes et sorties de consommables) ; même orthographe d'une sortie à l'autre, pour que les coûts
// se regroupent bien par chantier. Les chantiers clôturés ne sont plus proposés.
// « registered » : le nom a une fiche chantier (sinon le matériel n'est rattaché à aucun chantier).
export interface SiteSuggestion {
  name: string;
  registered: boolean;
}

export function useSiteSuggestions() {
  const [sites, setSites] = useState<SiteSuggestion[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('sites').select('name, status').order('name'),
      supabase.from('requests').select('destination').not('destination', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabase.from('stock_movements').select('destination').not('destination', 'is', null).order('created_at', { ascending: false }).limit(300),
    ]).then(([registered, requests, movements]) => {
      const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
      const closed = new Set((registered.data || []).filter(s => s.status === 'closed').map(s => key(s.name)));
      const open = (registered.data || []).filter(s => s.status !== 'closed').map(s => (s.name as string).trim().replace(/\s+/g, ' '));
      const seen = new Map<string, string>();
      for (const row of [...(requests.data || []), ...(movements.data || [])]) {
        const value = (row.destination as string).trim().replace(/\s+/g, ' ');
        const k = key(value);
        if (value && !closed.has(k) && !open.some(name => key(name) === k) && !seen.has(k)) seen.set(k, value);
      }
      setSites([
        ...open.map(name => ({ name, registered: true })),
        ...[...seen.values()].sort((a, b) => a.localeCompare(b, 'fr')).map(name => ({ name, registered: false })),
      ]);
    });
  }, []);

  return sites;
}
