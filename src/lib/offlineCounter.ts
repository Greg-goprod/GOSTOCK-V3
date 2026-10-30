import { supabase } from './supabase';
import { errorMessage } from './requests';
import type { Kit } from './kits';

// Comptoir sans réseau (sous-sol, chantier) : copie locale des données utiles au scan, et file
// des validations envoyées dès que le réseau revient. Chaque étape réussie est retirée de la file :
// un renvoi ne refait jamais un retour ou une sortie déjà enregistrés.

const SNAPSHOT_KEY = 'gomat-counter-snapshot';
const QUEUE_KEY = 'gomat-counter-queue';

export interface CounterSnapshot {
  savedAt: string;
  users: { id: string; first_name: string; last_name: string; department: string; active?: boolean }[];
  badges: Record<string, string>;
  equipment: { id: string; name: string; itemType?: string; unit?: string; articleNumber?: string; serialNumber?: string; availableQuantity?: number; status: string }[];
  instances: { id: string; equipmentId: string; qrCode: string }[];
  held: { id: string; equipmentId: string; userId: string; instanceId?: string; kitId?: string; dueDate: string; status: string }[];
  kits: Kit[];
}

export interface ReturnStep {
  checkoutId: string;
  label: string;
  condition: string;
  notes: string | null;
  photos: string[];
}

export interface ToolStep {
  equipment_id: string;
  instance_id?: string;
  quantity?: number;
  kit_id?: string;
}

export interface CounterOperation {
  id: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  pickedUpBy: string | null;
  returns: ReturnStep[];
  tools: ToolStep[];
  toolLabels: string[];
  consumables: { equipment_id: string; quantity: number; label: string }[];
  due: string;
  destination: string | null;
  depotId: string;
  // Un bon déjà créé pour cette opération (les consommables y sont rattachés)
  noteId?: string | null;
  error?: string;
}

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage plein ou indisponible : le comptoir reste utilisable en ligne
  }
};

export const loadSnapshot = () => read<CounterSnapshot | null>(SNAPSHOT_KEY, null);
export const saveSnapshot = (snapshot: CounterSnapshot) => write(SNAPSHOT_KEY, snapshot);

export const loadQueue = () => read<CounterOperation[]>(QUEUE_KEY, []);
const saveQueue = (queue: CounterOperation[]) => write(QUEUE_KEY, queue);

export const enqueue = (op: CounterOperation) => saveQueue([...loadQueue().filter(o => o.id !== op.id), op]);
export const dropQueued = (id: string) => saveQueue(loadQueue().filter(o => o.id !== id));

// Coupure réseau (et non refus de la base) : l'opération peut attendre dans la file
export const isNetworkError = (error: unknown) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = errorMessage(error);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message);
};

class NetworkDown extends Error {}

// Envoie une opération du comptoir ; enregistre chaque étape faite dans « op » (et dans la file si elle y est)
// « done » reçoit les étapes faites au fur et à mesure (utile pour annoncer un arrêt en cours de route)
export async function submitOperation(op: CounterOperation, persist = false, done: string[] = []): Promise<string[]> {
  const save = () => { if (persist) enqueue(op); };
  const call = async <T,>(promise: PromiseLike<{ data: T; error: unknown }>) => {
    const { data, error } = await promise;
    if (error) throw isNetworkError(error) ? new NetworkDown(errorMessage(error)) : error;
    return data;
  };

  while (op.returns.length) {
    const step = op.returns[0];
    await call(supabase.rpc('return_with_check', {
      p_checkout_id: step.checkoutId,
      p_condition: step.condition,
      p_notes: step.notes,
      p_photos: step.photos,
    }));
    op.returns.shift();
    done.push(`retour ${step.label}`);
    save();
  }

  if (op.tools.length) {
    const note = await call<{ id: string; note_number: string } | null>(supabase.rpc('create_checkout', {
      p_user_id: op.ownerId,
      p_due_date: new Date(op.due).toISOString(),
      p_items: op.tools,
      p_notes: [op.destination, op.pickedUpBy ? `retiré par ${op.pickedUpBy}` : ''].filter(Boolean).join(' · ') || null,
    }));
    op.noteId = note?.id ?? null;
    op.tools = [];
    op.toolLabels = [];
    done.push(`bon ${note?.note_number ?? ''}`.trim());
    save();
  }

  while (op.consumables.length) {
    const line = op.consumables[0];
    await call(supabase.rpc('consume_stock', {
      p_equipment_id: line.equipment_id,
      p_depot_id: op.depotId,
      p_quantity: line.quantity,
      p_user_id: op.ownerId,
      p_destination: op.destination,
      p_notes: op.pickedUpBy ? `Sortie au comptoir, retirée par ${op.pickedUpBy}` : 'Sortie au comptoir',
      p_delivery_note_id: op.noteId ?? null,
    }));
    op.consumables.shift();
    done.push(line.label);
    save();
  }

  return done;
}

export { NetworkDown };

// Envoie la file dans l'ordre ; une opération refusée par la base garde son message et n'arrête pas les autres
export async function flushQueue(): Promise<{ sent: number; failed: number; offline: boolean }> {
  let sent = 0;
  let failed = 0;
  for (const op of loadQueue()) {
    try {
      await submitOperation(op, true);
      dropQueued(op.id);
      sent++;
    } catch (error) {
      if (error instanceof NetworkDown) return { sent, failed, offline: true };
      enqueue({ ...op, error: errorMessage(error) });
      failed++;
    }
  }
  return { sent, failed, offline: false };
}
