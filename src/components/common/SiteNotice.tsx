import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

// Sous le champ « Chantier ou service » : prévient quand le nom saisi ne correspond à aucune fiche
// chantier ouverte. Le matériel n'apparaît alors ni sur une fiche chantier ni sur la carte.
const SiteNotice: React.FC<{ value: string }> = ({ value }) => {
  const [names, setNames] = useState<Set<string> | null>(null);

  useEffect(() => {
    supabase.from('sites').select('name, status').then(({ data }) => {
      setNames(new Set((data || []).filter(s => s.status !== 'closed').map(s => key(s.name as string))));
    });
  }, []);

  if (!names || !value.trim() || names.has(key(value))) return null;
  return (
    <p className="mt-1 flex items-start gap-1.5 text-[length:calc(12.5px*var(--mx-scale,1))] text-tone-warning">
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>Aucune fiche chantier à ce nom : le matériel ne sera rattaché à aucun chantier ni visible sur la carte. Choisis un chantier de la liste ou crée sa fiche dans « Chantiers ».</span>
    </p>
  );
};

export default SiteNotice;
