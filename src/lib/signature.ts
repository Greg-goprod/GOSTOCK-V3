import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Equipment } from '../types';

// Seuil de prix (paramètre « signature_min_value ») au-delà duquel la remise d'un outil est signée
export function useSignatureRule() {
  const [minValue, setMinValue] = useState(500);

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('id', 'signature_min_value').maybeSingle()
      .then(({ data }) => { if (data?.value !== undefined) setMinValue(Number(data.value) || 0); });
  }, []);

  return (item: Equipment) =>
    item.itemType !== 'consumable' && (Boolean(item.requiresSignature) || (minValue > 0 && (item.purchasePrice ?? 0) >= minValue));
}
