# PILOTE — suite : UI-7 (discussion + documents) et UI-8 (dupliquer un projet)

Proposition du 2026-11-04. **Rien n'est codé** : les choix de la section « À décider » changent la base de données et les droits.
Principe repris des étapes précédentes : une étape = une migration testée + un écran + des tests e2e ; l'étape suivante ne démarre pas tant que la précédente n'est pas validée sur la vraie base.

## UI-7 — la fiche en sections (projet et élément)

Aujourd'hui la fiche d'un élément a : propriétés, description, détails (rangé sous, liste à cocher, dépendances). On ajoute deux sections, **les mêmes pour un projet et pour un élément** :

| Section | Contenu |
|---|---|
| Discussion | fil de messages de la fiche (texte), auteur et heure, modifier/supprimer ses messages |
| Documents | « mini-Dropbox » : déposer des fichiers (glisser-déposer), liste avec nom, taille, qui, quand ; télécharger ; supprimer |

### 7a — Discussion
- **Base** : table `cp_comments` (entreprise, projet, élément facultatif, auteur, texte ≤ 4 000 caractères, créé/modifié le). Mêmes garde-fous que le reste : isolation par entreprise, module `cp.projects` requis, projet et élément contrôlés par la base, journal d'audit.
- **Droits proposés** : lecture = toute personne qui voit le projet ; écriture = l'équipe du projet et les responsables (`cp.projects:update`) ; modifier ou supprimer = son propre message (les responsables peuvent supprimer n'importe lequel).
- **Notifications** (on réutilise celles de l'étape 2) : nouveau message → l'équipe du projet (ou les assignés de l'élément), regroupés sur 10 minutes par personne et par fiche, jamais pour son propre message ; choix par personne dans les préférences existantes (app / e-mail / push).
- **Écran** : section « Discussion » dans la fiche, la plus récente en bas, zone de saisie (Ctrl+Entrée envoie). Pas de pièce jointe dans le message (les fichiers vont dans « Documents »). Mise à jour à l'ouverture et à l'envoi ; le temps réel viendra après si utile.
- **Tests** : batterie SQL (droits par rôle, isolation entre entreprises, projet/élément incohérents refusés, notifications regroupées), puis e2e.

### 7b — Documents
- **Base** : table `cp_documents` (entreprise, projet, élément facultatif, nom, chemin, taille, type, déposé par, date) + **bucket de stockage privé** `cp-documents`, rangé par entreprise ; les droits du stockage reprennent ceux de la table.
- **Limites proposées** : 25 Mo par fichier ; extensions courantes (PDF, images, Office, texte, zip) ; pas d'exécutables ; téléchargement par lien signé de 60 secondes (jamais de lien public).
- **Droits proposés** : lecture = toute personne qui voit le projet ; dépôt = l'équipe et les responsables ; suppression = celui qui l'a déposé et les responsables.
- **Écran** : zone de dépôt (le composant `MxDropzone` de la charte existe déjà), liste, téléchargement, suppression avec confirmation.
- **Inclus dans la sauvegarde** : la table (liste des fichiers) oui ; **les fichiers eux-mêmes restent dans le stockage Supabase** (comme les photos et PV).

### 7c — la fiche en sections + lien direct
- Fiche en sections repliables : Description, Liste à cocher, Dépendances, Discussion, Documents ; compteurs sur les titres (« Discussion (3) », « Documents (2) »).
- Lien direct `?item=<id>` ou `?project=<id>` : ouvre la fiche ; les notifications de discussion et d'assignation y mènent. Menu « … » de la fiche : copier le lien, supprimer.

## UI-8 — dupliquer un projet (premier « modèle »)

- **Fonction en base** `cp_duplicate_project(projet, nouveau nom, nouveau début, options)` : copie en **une seule requête** (la leçon de la migration 54 : 200 éléments doivent se copier en moins d'une seconde, sans passer par une boucle de l'application).
- **Ce qui est copié** : le projet, ses phases / tâches / jalons / sous-tâches (même arborescence), leurs dépendances, leur liste à cocher (remise à « non fait »). Les dates sont décalées de l'écart entre l'ancien et le nouveau début. **Jamais copiés** : discussion, documents, état d'avancement (la copie repart de « Pas commencé »).
- **Options** (cases à cocher dans la fenêtre « Dupliquer ») : copier l'équipe (oui par défaut), copier les assignations (non par défaut), garder les dates ou les décaler.
- **Pas de rafale d'avis** : la copie de l'équipe et des assignations ne doit pas envoyer de notifications « tu as été ajouté / assigné » à tout le monde ; la fonction les coupe pour sa transaction, et un seul avis « projet copié » peut être envoyé à l'équipe si on le souhaite.
- **Écran** : « Dupliquer… » dans le menu « … » de la fiche du projet et des cartes/lignes de la liste ; fenêtre avec le nom (« Copie de … »), le nouveau début et les options ; à la fin, ouverture du nouveau projet.
- **Point d'attention** : un décalage qui n'est pas un multiple de 7 jours déplace les week-ends ; la fenêtre le signale (« les week-ends changent de place ») plutôt que de le corriger en silence.
- **Plus tard** : marquer un projet comme « modèle », répétition annuelle.

## À décider (par Greg) avant UI-7

1. **Qui peut écrire** (discussion et documents) : (A) toute personne qui voit le projet ; (B) l'équipe du projet et les responsables. *Recommandé : B* — la notion d'équipe existe déjà, et les documents sont plus sensibles qu'un tableau de dates.
2. **Fichiers** : 25 Mo par fichier, types courants, pas d'exécutables : d'accord ? un plafond total par entreprise (1 Go ?) maintenant ou plus tard ?
3. **Vocabulaire** : « Équipe » / « Assignés » ou « Intervenants » (et « intervenant externe sans compte » : hors périmètre pour l'instant) ?
4. **Notifications de discussion** : actives par défaut pour tous, e-mail désactivé par défaut (comme « dates modifiées ») ?

## Ordre proposé
UI-8 d'abord (petite, une migration, aucune question ouverte) → 7a discussion → 7b documents → 7c fiche en sections et liens directs.
