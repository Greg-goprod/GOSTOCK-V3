# ChantierPilot dans GO-Mat — audit et plan (document à valider, aucun code écrit)

Statut : **proposition à valider**. Rien n'est construit tant que tu n'as pas répondu aux points de la section 10.
Périmètre : **GO-Mat uniquement** (projet Supabase `xxzcaxizqndvhnzchqkp`). Mannyx n'est lu qu'en code, jamais modifié, jamais sa base.

---

## 1. Ce que tu m'as répondu (résumé fidèle)

| Sujet | Décision |
|---|---|
| Où construire | Uniquement dans GO-Mat. Une éventuelle fusion avec Mannyx se décidera plus tard. |
| Clients | **Multi-entreprise (multi-tenant) comme Mannyx**. |
| Métier | **Montages évènementiels** (scènes, structures, salons, concerts…). |
| Portails | Prestataires et traiteurs, **configurables selon les informations à leur donner**. |
| Repas | Cuisine interne **et** traiteur. Bon = badge QR + bon QR imprimé. Soit une série de bons (un par repas), soit un bon unique valable pour tous les repas planifiés. |
| Facturation | **GO-Mat émet lui-même les factures.** Les exports vers d'autres plateformes restent (Excel, CSV). |
| Temps de travail | Pas au départ, mais doit pouvoir devenir une option. |
| Ouvriers de prestataires | Dans « Personnes », sans compte (géré par le chef d'équipe), mais aussi individuellement, rattachés à une entreprise. |
| Langues | FR, DE, IT, EN. **Pas de PT/ES.** |
| Allergies | Enregistrées : consentement, chiffrement, accès limité. |
| Hôtel | Liste de chambres (rooming list) envoyée **par e-mail à l'hôtel**. Un module hôtel existe dans Mannyx : à regarder. |
| Volume | Nuitées/mois non estimables. |
| Ordre | **Un module après l'autre, en commençant par le planning de chantier.** |

---

## 2. Où en est GO-Mat aujourd'hui (constats vérifiés dans le code)

**Déjà utilisable comme base**
- `sites` (fiche chantier) : nom, client, adresse, responsable, dates début/fin, budget, ouvert/clôturé, notes. Les demandes, bons de sortie et mouvements de stock y sont reliés (`site_id`). Vues `site_summary` / `site_open_items`.
- `kits`, `rentals` (matériel loué), `trainings` (formations obligatoires), véhicules, prolongation d'emprunt, notifications, journal d'audit, aide intégrée, traduction FR/DE/IT/EN, charte MX (cartes, onglets, rail).
- Table `organizations` et colonne `organization_id` sur une vingtaine de tables.

**Limites à connaître avant de parler multi-entreprise**
1. `default_organization_id()` renvoie **une constante** : GO-Mat est aujourd'hui **mono-entreprise**. La colonne existe, mais rien ne l'impose.
2. Les politiques RLS **ne filtrent pas par entreprise**. Deux entreprises dans la même base se verraient.
3. `equipment` et `users` n'ont **pas** de `organization_id`.
4. Les chantiers ne connaissent ni jours, ni horaires, ni zones, ni équipes : c'est une fiche, pas un planning.
5. Pas de notion de prestataire (société externe) ni d'ouvrier externe.
6. Pas de facturation (BEXIO ne sert qu aux exports comptables, pas à l émission).

**Conclusion** : le multi-entreprise n'est pas un module à ajouter, c'est un **chantier de fondation** à faire en premier (module 0). Sans lui, tout ce qu'on construit ensuite devra être refait.

---

## 3. Ce que fait Mannyx (lecture du code, référence uniquement)

- Racine multi-entreprise : table `companies`, `company_id` + RLS d'isolation **sur toutes les tables**.
- Spec 021 « Prestataires » : prestataires, ouvriers de prestataire (lien optionnel vers le personnel), **planning d'interventions** (frise horaire glisser-déposer, pas de 5 min, récurrence, échéances), **configuration du chantier** (dates, plage horaire, option 24 h/24), **bons repas** (un bon par ouvrier et par type de repas, code unique, marqué utilisé au scan), **besoins d'hôtel** liés aux réservations.
- Paramétrage de production : politique d'hôtel (standard/luxe/budget/mixte), format de rooming list (Excel/CSV/PDF/JSON), heures d'arrivée/départ par défaut.
- Dans Mannyx tout est borné par `company_id` **et** `event_id` (un évènement = un cadre de travail).

**Ce qu'on reprend comme idée** : le modèle prestataire → ouvriers → interventions, la configuration de période/horaires, les bons repas, le besoin d'hôtel, la rooming list.
**Ce qu'on ne copie pas** : le code (autre base, autre convention). On réécrit proprement dans GO-Mat, avec les mêmes concepts pour faciliter une fusion future.

---

## 4. Architecture proposée

### 4.1 Multi-entreprise (module 0 — fondation)
- Chaque donnée métier porte `organization_id` ; **chaque politique RLS** le compare à l'entreprise de l'utilisateur connecté (fonction `current_organization_id()` lue depuis son profil).
- Ajouter `organization_id` à `equipment`, `users` et toutes les tables qui n'en ont pas, avec reprise de l'existant sur l'entreprise actuelle (aucune perte).
- Un utilisateur appartient à **une** entreprise (comme Mannyx). Un super-administrateur de plateforme (toi) crée les entreprises.
- Les fonctions SECURITY DEFINER existantes (create_request, create_checkout, return_with_check, extend_*…) doivent toutes être relues : c'est le gros du risque (voir section 8).
- Tests d'isolation automatisés : une entreprise B ne doit rien voir ni modifier de A (lecture, écriture, RPC, stockage, notifications).
- **Activation par module** : table `organization_modules` (entreprise × module activé). Le menu n'affiche que les modules activés.

### 4.2 Montage évènementiel : le vocabulaire
- **Chantier** (existant, étendu) = un projet : une scène, un salon… avec période de montage, d'exploitation, de démontage.
- **Phases** : montage / exploitation / démontage, chacune avec ses dates.
- **Zones** (hall, scène, backstage, parking…) : on planifie par zone.
- **Prestataires** (sociétés externes) → **équipes** → **ouvriers**.
- **Interventions** : un prestataire (ou une équipe interne) fait une tâche, dans une zone, sur un créneau.

### 4.3 Personnes (ouvriers de prestataires)
Table « Personnes » existante, étendue :
- type : interne / prestataire ; rattachement à une société ;
- **sans compte** (cas normal) : géré par le chef d'équipe via le portail ; **avec compte** possible plus tard ;
- badge QR par personne ;
- données sensibles (allergies) **séparées** dans une table dédiée (voir 4.7).

### 4.4 Portails configurables
Un portail = une vue limitée, accessible par lien/compte, pour un prestataire ou un traiteur.
- Gabarit de portail par entreprise : on coche les blocs à montrer — planning de ses interventions, liste de ses ouvriers, accès/badges, repas, hôtel, documents, facturation, consignes de sécurité.
- Un prestataire ne voit **que** son périmètre (son chantier, son planning, ses ouvriers).
- Le traiteur voit : effectifs par repas et par jour, régimes/allergies **agrégés** (jamais le nom sans droit), horaires, lieu de service.
- Pas de saisie libre vers la base : tout passe par des fonctions contrôlées.

### 4.5 Repas
- Sources : **cuisine interne** ou **traiteur** (par repas).
- Plan de repas par chantier : jours × types de repas (petit-déjeuner, midi, soir, nuit) × lieu.
- **Deux modes de bon, au choix par chantier ou par prestataire** :
  - **Série** : un bon QR par repas planifié et par personne ;
  - **Bon unique** : un seul QR valable pour tous les repas planifiés, qui décompte à chaque scan (un seul repas par créneau).
- Support : **badge QR** de la personne (le scan identifie la personne) **ou** bon imprimé (PDF avec QR).
- Scan au passage (téléphone ou lecteur) : refuse hors créneau, double passage, personne non prévue ; journal des passages.
- Statistiques : prévus / servis / restants par jour et par source (utile pour la facture traiteur).

### 4.6 Facturation émise par GO-Mat
- Clients, devis (option), factures, avoirs, numérotation continue, TVA suisse, conditions de paiement, rappels.
- **Facture QR suisse** (QR-bill) et PDF ; envoi par e-mail.
- Lignes issues de GO-Mat : location de matériel, consommables, repas, nuitées, prestations.
- Exports conservés : Excel, CSV, et l'export comptable existant.
- **Point d'attention légal** : numérotation sans trou, immutabilité d'une facture émise (on corrige par avoir), conservation 10 ans. À valider avec ton comptable.

### 4.7 Allergies et données sensibles
- Table séparée `person_health` : allergies/régimes, **consentement horodaté** (qui, quand, finalité), possibilité de retrait.
- **Chiffrement** des champs (extension de chiffrement côté base), clés non lisibles par l'application cliente.
- **Accès limité** : rôle « restauration/santé » uniquement ; le traiteur ne reçoit que des **effectifs par régime**, pas des noms, sauf besoin de sécurité alimentaire explicite (décision à confirmer).
- Journal de **chaque lecture**. Durée de conservation limitée, purge après le chantier.
- Conformité : LPD suisse / RGPD (données de santé = catégorie sensible).

### 4.8 Hôtel et rooming list
- Besoin d'hôtel par personne : dates d'arrivée/départ, type de chambre, partage.
- Fiche hôtel (nom, e-mail du contact réception, tarifs, politique standard/budget…).
- **Rooming list** générée (PDF/Excel/CSV) et **envoyée par e-mail à l'hôtel** depuis GO-Mat ; historique des envois, version, modifications.
- À faire en amont : comparer avec le module hôtel de Mannyx (champs, formats) — je le ferai en lecture seule quand on y arrivera.
- L'envoi d'e-mail passe par la configuration SMTP que **tu** saisis (je ne vois jamais les secrets).

### 4.9 Temps de travail (option future)
- Prévu dans le modèle (une intervention peut avoir des heures réelles), **non construit**. Module activable plus tard.

### 4.10 Langues
- FR, DE, IT, EN uniquement (système de traduction actuel). Les portails externes suivent la langue choisie par l'utilisateur ou le prestataire.

---

## 5. Feuille de route (un module après l'autre)

| # | Module | Contenu | Dépend de |
|---|---|---|---|
| 0 | **Fondation multi-entreprise** | `organization_id` partout, RLS, `current_organization_id()`, activation par module, tests d'isolation, console d'administration des entreprises | — |
| 1 | **Planning de chantier** | phases, zones, prestataires, équipes, interventions, frise glisser-déposer, config période/horaires/24 h, conflits, vue jour/semaine | 0 |
| 2 | Personnes externes et badges | ouvriers rattachés à une société, badge QR, chef d'équipe | 0, 1 |
| 3 | Portails configurables | blocs activables, accès par lien/compte | 1, 2 |
| 4 | Repas | plan de repas, bons (série / unique), scan, statistiques, portail traiteur | 2, 3 |
| 5 | Allergies | consentement, chiffrement, accès limité, agrégats traiteur | 2, 4 |
| 6 | Hôtel et rooming list | besoins, hôtels, génération et envoi e-mail | 2 |
| 7 | Facturation | clients, factures, avoirs, QR-bill, exports | 1, 4, 6 |
| 8 | Temps de travail (option) | heures réelles, pointage | 1, 2 |

**Module 1 en détail (le premier visible)**
- Écran « Planning » dans le chantier : frise horaire par zone ou par prestataire, créneaux au pas de 5/15 min, glisser-déposer, récurrence, copie d'un jour.
- Configuration : dates, heures de début/fin de journée, option 24 h/24, jours bloqués.
- Contrôles : chevauchement d'une même équipe, hors période, matériel non disponible (lien avec les réservations de GO-Mat), formation requise non valide.
- Lien avec l'existant : le matériel et les véhicules d'un chantier apparaissent dans le planning ; les sorties, retours et prolongations restent ceux de GO-Mat.
- Vues cartes et frise comme le reste de l'application ; aide intégrée et traductions livrées avec.

---

## 6. Sécurité et conformité (exigences non négociables)
- Isolation entreprise par RLS **et** vérifiée par tests automatisés avant chaque mise en ligne d'un module.
- Aucun secret (SMTP, clés, jetons) ne transite par moi ; configuration par toi dans l'interface/Supabase.
- Allergies : consentement, chiffrement, accès restreint, journal de lecture, purge.
- Portails externes : liens à durée limitée, périmètre minimal, aucune écriture directe en table.
- Sauvegarde et migration réversibles pour le module 0 (c'est le seul qui touche aux données existantes).

---

## 7. Tests prévus
- Module 0 : batterie d'isolation (2 entreprises × lecture/écriture/RPC/stockage), régression de toute la batterie existante (e2e-complet, e2e-emprunts).
- Chaque module : tests base locale (comme pour la prolongation), puis parcours automatisés exécutés par ton Claude local, avec preuves (hash de commit, rapport daté).

---

## 8. Risques
| Risque | Gravité | Réponse |
|---|---|---|
| Fuite de données entre entreprises | Critique | RLS systématique + tests d'isolation bloquants |
| Régression sur l'existant en passant en multi-entreprise | Élevée | module 0 isolé, migration réversible, rejouer toute la batterie |
| Facturation légale (numérotation, TVA, QR-bill) | Élevée | validation par ton comptable avant mise en service |
| Données de santé | Élevée | consentement, chiffrement, accès restreint, purge |
| Périmètre trop large | Moyenne | un module à la fois, validation à chaque étape |
| Envoi d'e-mails (hôtel) sans SMTP configuré | Faible | message clair, file d'attente, historique |

---

## 9. Ce que cet audit ne couvre pas encore
- Estimation de charge par module (je la donne après ta validation du module 0/1).
- Lecture détaillée du module hôtel de Mannyx (au moment du module 6).
- Modèle tarifaire/abonnement des entreprises clientes (hors périmètre technique pour l'instant).

---

## 10. Décisions à valider avant de commencer

1. **Module 0 d'abord** (fondation multi-entreprise) puis **module 1** (planning) : d'accord avec cet ordre ? (Alternative : planning d'abord en mono-entreprise, multi-entreprise après — plus rapide à voir, mais refonte coûteuse ensuite. Je déconseille.)
2. **Une entreprise par utilisateur** (comme Mannyx), ou un utilisateur pouvant appartenir à plusieurs entreprises (consultants) ?
3. **Entreprise existante** : toutes les données actuelles de GO-Mat appartiennent à une seule entreprise (la tienne) ? Quel nom ?
4. **Qui crée les entreprises** : seulement toi (super-admin), ou inscription libre ?
5. **Planning** : frise par **zone**, par **prestataire**, ou les deux vues dès le départ ?
6. **Pas de planification** : 5 min (comme Mannyx) ou 15 min plus lisible ?
7. **Traiteur et allergies** : le traiteur reçoit-il des **effectifs par régime** uniquement, ou aussi les **noms** pour les cas graves ?
8. **Facturation** : tes factures actuelles sont émises avec quel outil, et ton comptable valide-t-il la numérotation/TVA/QR-bill avant mise en service ?
9. **Volumes** (à titre d'ordre de grandeur) : nombre d'entreprises clientes visées dans 12 mois, nombre d'utilisateurs par entreprise.
10. **Mannyx** : tu confirmes qu'aucune donnée n'est partagée entre les deux produits pour l'instant ?

Dès que tu valides (ou corriges) ces 10 points, je commence par le module 0 : migration réversible, politiques RLS, tests d'isolation en base locale, **sans toucher à tes données réelles avant ton feu vert**.
