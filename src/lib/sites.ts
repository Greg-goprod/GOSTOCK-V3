import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Chantiers déjà saisis (demandes et sorties de consommables) : même orthographe d'une sortie à l'autre,
// pour que les coûts se regroupent bien par chantier
export function useSiteSuggestions() {
  const [sites, setSites] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('requests').select('destination').not('destination', 'is', null).order('created_at', { ascending: false }).limit(300),
      supabase.from('stock_movements').select('destination').not('destination', 'is', null).order('created_at', { ascending: false }).limit(300),
    ]).then(([requests, movements]) => {
      const seen = new Map<string, string>();
      for (const row of [...(requests.data || []), ...(movements.data || [])]) {
        const value = (row.destination as string).trim().replace(/\s+/g, ' ');
        if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
      }
      setSites([...seen.values()].sort((a, b) => a.localeCompare(b, 'fr')));
    });
  }, []);

  return sites;
}
