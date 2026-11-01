// Entreprise active de la personne connectée (module multi-entreprise).
// Les fichiers sont rangés dans un dossier portant l'identifiant de l'entreprise : les règles d'accès du stockage
// comparent ce dossier à l'entreprise active (migration 38). Les anciens fichiers, sans dossier, restent lisibles
// par l'entreprise historique.
let activeOrganizationId: string | null = null;

export const setActiveOrganizationId = (id: string | null) => {
  activeOrganizationId = id;
};

export const getActiveOrganizationId = () => activeOrganizationId;

// Début de chemin d'un nouveau fichier : « <entreprise>/ », vide si l'entreprise n'est pas connue
export const organizationFolder = () => (activeOrganizationId ? `${activeOrganizationId}/` : '');
