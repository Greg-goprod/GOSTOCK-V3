import { supabase } from './supabase';

// Ligne brute de la table equipment (snake_case)
export type EquipmentRow = Record<string, any>;

export interface ScannedEquipment {
  equipment: EquipmentRow;
  // Renseigné quand le code scanné est celui d'un exemplaire (QR individuel)
  instance?: { id: string; instance_number: number; qr_code: string; status: string };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Comparaison exacte insensible à la casse : on neutralise les jokers de ILIKE
const exactILike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Retrouve l'équipement correspondant à un code scanné, sans correspondance approximative :
 *  1. identifiant de l'équipement (contenu des QR codes d'équipement)
 *  2. QR code d'un exemplaire (ex. GOMAT-20261029-0001-001)
 *  3. numéro d'article, numéro de série, puis code-barres EAN du fabricant exacts
 */
export async function findEquipmentByCode(rawCode: string): Promise<ScannedEquipment | null> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const code = rawCode.trim();
  if (!code) return null;

  if (UUID_PATTERN.test(code)) {
    const { data, error } = await supabase.from('equipment').select('*').eq('id', code).maybeSingle();
    if (error) throw error;
    if (data) return { equipment: data };
  }

  const pattern = exactILike(code);

  const { data: instance, error: instanceError } = await supabase
    .from('equipment_instances')
    .select('id, instance_number, qr_code, status, equipment(*)')
    .ilike('qr_code', pattern)
    .limit(1)
    .maybeSingle();
  if (instanceError) throw instanceError;
  if (instance?.equipment) {
    const { equipment, ...instanceFields } = instance as unknown as ScannedEquipment['instance'] & { equipment: EquipmentRow };
    return { equipment, instance: instanceFields };
  }

  const labels: Record<string, string> = { article_number: "numéro d'article", serial_number: 'numéro de série', ean: 'code EAN' };
  for (const column of ['article_number', 'serial_number', 'ean']) {
    const { data, error } = await supabase.from('equipment').select('*').ilike(column, pattern).limit(2);
    if (error) throw error;
    // Un code partagé par plusieurs fiches ne doit pas choisir un équipement au hasard
    if (data && data.length === 1) return { equipment: data[0] };
    if (data && data.length > 1) {
      throw new Error(`Plusieurs équipements ont ce ${labels[column]} : ${code}`);
    }
  }

  return null;
}
