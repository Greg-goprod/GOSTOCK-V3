import toast from 'react-hot-toast';
import { confirmAction } from '../../lib/confirm';
import { clearBaseline, piloteError, setBaseline, type CpProject } from '../../lib/pilote';

// « Figer la ligne de base » : photo des dates du projet et de ses éléments, qui remplace la précédente ; renvoie vrai si c'est fait
export async function freezeBaseline(project: CpProject): Promise<boolean> {
  if (!(await confirmAction(`Figer la ligne de base du projet « ${project.name} » ? Les dates actuelles deviennent le plan de référence et remplacent la ligne de base précédente.`))) return false;
  try {
    const n = await setBaseline(project.id);
    toast.success(`Ligne de base figée (${n} date${n > 1 ? 's' : ''})`);
    return true;
  } catch (e) { toast.error(piloteError(e)); return false; }
}

export async function removeBaseline(project: CpProject): Promise<boolean> {
  if (!(await confirmAction(`Effacer la ligne de base du projet « ${project.name} » ?`))) return false;
  try {
    await clearBaseline(project.id);
    toast.success('Ligne de base effacée');
    return true;
  } catch (e) { toast.error(piloteError(e)); return false; }
}
