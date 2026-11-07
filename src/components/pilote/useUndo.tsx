import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { piloteError } from '../../lib/pilote';

// Annuler la dernière action (gestes du Gantt, changements d'état du Tableau) : une pile propre à la vue, 20 actions au plus ; chaque action
// apparaît dans une notification avec un bouton « Annuler », et Ctrl+Z défait la dernière. `onUndone` recharge les données.
export function useUndo(onUndone: () => Promise<void> | void) {
  const stack = useRef<{ label: string; undo: () => Promise<void> }[]>([]);
  const undoLast = useCallback(async () => {
    const action = stack.current.pop();
    if (!action) { toast('Rien à annuler'); return; }
    try { await action.undo(); toast.success(`Annulé : ${action.label}`); } catch (e) { toast.error(piloteError(e)); }
    await onUndone();
  }, [onUndone]);
  const push = useCallback((label: string, undo: () => Promise<void>) => {
    stack.current = [...stack.current.slice(-19), { label, undo }];
    toast(t => (
      <span className="flex items-center gap-3">
        <span>{label}</span>
        <button type="button" onClick={() => { toast.dismiss(t.id); void undoLast(); }} className="rounded border border-gray-300 px-2 py-0.5 text-xs font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">Annuler</button>
      </span>
    ), { duration: 8000 });
  }, [undoLast]);
  return { push, undoLast };
}
