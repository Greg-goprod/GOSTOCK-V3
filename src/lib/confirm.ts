// Confirmations et saisies courtes dans un drawer de la charte, à la place des boîtes du navigateur.
// confirmAction('Supprimer … ?') → Promise<boolean> ; promptAction('Quantité :', '3') → Promise<string | null>

export interface DialogRequest {
  id: number;
  kind: 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
  danger: boolean;
  resolve: (value: boolean | string | null) => void;
}

type Listener = (requests: DialogRequest[]) => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const publish = () => listeners.forEach(l => l(queue));

export function subscribeDialogs(listener: Listener) {
  listeners.add(listener);
  listener(queue);
  return () => {
    listeners.delete(listener);
  };
}

export function settleDialog(id: number, value: boolean | string | null) {
  const request = queue.find(r => r.id === id);
  queue = queue.filter(r => r.id !== id);
  publish();
  request?.resolve(value);
}

// Actions qui détruisent ou abandonnent quelque chose : bouton rouge
const DESTRUCTIVE = /^(supprimer|annuler|abandonner|retirer|créer un nouveau badge|clôturer)/i;

export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => {
    queue = [...queue, { id: nextId++, kind: 'confirm', message, danger: DESTRUCTIVE.test(message.trim()), resolve: v => resolve(v === true) }];
    publish();
  });
}

export function promptAction(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise(resolve => {
    queue = [...queue, { id: nextId++, kind: 'prompt', message, defaultValue, danger: false, resolve: v => resolve(typeof v === 'string' ? v : null) }];
    publish();
  });
}
