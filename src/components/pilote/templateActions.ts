import toast from 'react-hot-toast';
import { promptAction } from '../../lib/confirm';
import { piloteError, saveAsTemplate, type CpProject } from '../../lib/pilote';

// « Enregistrer comme modèle » : demande un nom, copie le projet en modèle (sans équipe ni assignation) ; renvoie vrai si le modèle est créé
export async function saveProjectAsTemplate(project: CpProject): Promise<boolean> {
  const name = (await promptAction('Nom du modèle', `Modèle ${project.name}`))?.trim();
  if (!name) return false;
  try {
    await saveAsTemplate(project.id, name);
    toast.success('Modèle enregistré : retrouve-le dans « Modèles »');
    return true;
  } catch (error) {
    toast.error(piloteError(error));
    return false;
  }
}
