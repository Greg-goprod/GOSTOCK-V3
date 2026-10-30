// Structure de l'aide : un article par page ou fonction, découpé en tâches (« Sortir un outil »,
// « Rendre un kit »…), chaque tâche en étapes précises, avec le résultat attendu et les blocages courants.

export type HelpCategory =
  | 'demarrage' | 'magasin' | 'materiel' | 'stock' | 'vehicules' | 'chantiers' | 'personnes' | 'pilotage' | 'reglages';

export interface HelpStep {
  text: string;
  shot?: string;      // capture (public/aide/<nom>.jpg)
}

export interface HelpProblem {
  if: string;         // ce qui se passe
  then: string;       // quoi faire
}

export interface HelpTask {
  id: string;
  title: string;      // « Sortir un outil »
  who?: string;       // qui peut le faire
  steps: HelpStep[];
  result?: string;    // ce que tu dois voir à la fin
  problems?: HelpProblem[];
}

export interface HelpArticle {
  id: string;
  category: HelpCategory;
  title: string;
  summary: string;
  route?: string;     // page ouverte par « Ouvrir la page »
  routes?: string[];  // pages où le « ? » de l'en-tête ouvre cet article
  where?: string;     // où trouver la page dans le menu
  tasks: HelpTask[];
  tips?: string[];
}

export interface FaqItem {
  q: string;
  a: string;
  article?: string;
}
