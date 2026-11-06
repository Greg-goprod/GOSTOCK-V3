// Contenu du QR d'un kit : « GOMAT-KIT:<code> » (code de la table kits)
export const KIT_PREFIX = 'GOMAT-KIT:';

export const kitValue = (code: string) => `${KIT_PREFIX}${code}`;

export const isKitCode = (text: string) => text.trim().toUpperCase().startsWith(KIT_PREFIX);

export const kitCodeOf = (text: string) => text.trim().slice(KIT_PREFIX.length).trim().toUpperCase();

export interface KitItem {
  id?: string;
  equipment_id: string;
  instance_id: string | null;
  quantity: number;
}

export interface Kit {
  id: string;
  name: string;
  code: string;
  depot_id: string | null;
  description: string | null;
  active: boolean;
  kit_items: KitItem[];
}
