# Rapport de tests — Lot 16 et contre-tests

- **Date** : 30 octobre 2026, de 13:05 à 14:30 (heure de Zurich)
- **Version testée** : `772601c` « Consignes de test du lot 16 et contre-tests du rapport Chrome » (avec `e19a1cb` locations et états des lieux, `8912fb2` permis machines suisses), migrations `00025` et `00026` déjà appliquées.
- **Montage** : dossier séparé `GOMAT-essai` (`git worktree`, détaché sur `origin/claude/loving-thompson-6zfo06`), `.env` copié, `npm ci`, Vite sur le port 5190. Navigateur de prévisualisation intégré, piloté par script ; session de connexion reprise du port 5175 (même compte Administrateur GO-Mat).
- **Base** : GO-MAT uniquement (`xxzcaxizqndvhnzchqkp`).
- **Règles suivies** : données préfixées « TEST » ; rien d'autre supprimé ni modifié ; code de l'application non modifié.
- **Consignes** : `docs/tests/consignes-lot16.md` (branche `claude/loving-thompson-6zfo06`).

---

## 0. Contre-test des corrections — version `4a4fa16`

- **Date** : 30 octobre 2026, de 14:55 à 16:05 (heure de Zurich)
- **Version** : `4a4fa16` « Corrections du rapport de tests du lot 16 » (`GOMAT-essai` mis à jour par `git fetch` puis `checkout` de `FETCH_HEAD`, Vite redémarré sur le port 5190). Nouvelle migration `00027_message_permis` : **appliquée sur GO-MAT** (le nouveau message de L8 sort de la base).
- **Session** : expirée au redémarrage ; reconnexion par l'utilisateur.

### Verdict

**P5, le dernier blocage, est corrigé.** R1 à R3 et L1 à L12 sont corrigés. Les rôles se comportent comme prévu (menus, pages et refus côté base). Un défaut **majeur de confidentialité** est apparu avec les rôles (N4 : un Collaborateur lit les données personnelles de tout le monde), plus trois défauts mineurs (N1 à N3). Seul P15 reste en attente : il faut le panneau du navigateur affiché.

### Résultats

| Point | Résultat | Preuve |
|---|---|---|
| **P5** formulaire | ✅ | « Nouvelle demande » ouverte et remplie : 15 retours d'onglet en 25 s, aucun écran « Chargement… », même champ, valeur « TEST P5 formulaire » conservée. Code servi : `SIGNED_IN` de la même personne traité en arrière-plan. |
| **P5** panier du comptoir | ✅ | Badge et article scannés : après 16 retours d'onglet en 20 s, la personne et « Panier (1) · Retour · TEST Perceuse comptoir » sont conservés. |
| **R2** formulaire d'outil | ✅ | Création : « Suivant » visible dès l'ouverture (976 px pour un écran de 1018 px) ; « URL de l'image » non masqué ; section `max-height: none; overflow: visible`. Modification : « Suivant » à 976 px, « Modifier le matériel » à 573 px. |
| **R1** dialogues fermés | ✅ | « Confirmation », « Menu », « Filtres » fermés portent `aria-hidden` et `inert` ; le dialogue de confirmation est vidé après usage. |
| **R3** suggestions de chantier | ✅ | Les options sont distinguées : « Chantier » et « Sans fiche chantier ». |
| **P12** texte de confirmation | ✅ | « 1 point à régler avant le départ (dont la caution de 80.00 CHF à rembourser) » ; « Clôturer le départ quand même ? La caution de 80.00 CHF n'est pas remboursée. » ; « Annuler » laisse la personne active ; ensuite caution rendue et départ clôturé. |
| **P15** panneau affiché | ⏳ En attente | Le panneau de prévisualisation était masqué pendant le test (il passe visible quelques millisecondes toutes les 6 s) : la carte ne se recentre pas. À refaire panneau affiché. |
| **L1** listes après création | ✅ | « TEST L1 Alpha » et « TEST L1 Beta » créés, sans rechargement (page chargée 15 min plus tôt) : présents dans « Pour qui » et dans « Ajouter une personne » (attestation IPAF 3b). |
| **L2** outil loué rendu au comptoir | ✅ | Refus au scan : « « TEST Nacelle 3b » est rendu au loueur : il ne peut plus sortir » ; panier vide. |
| **L3** « Matériel » | ✅ | « TEST Nacelle 3b · Rendu au loueur ». |
| **L4** pastille après « + 7 jours » | ✅ | « TEST Utilitaire 2 · Loué jusqu'au 06.11 » → « Prolongée jusqu'au 13.11.2026 » → « Loué jusqu'au 13.11 », sans rechargement. |
| **L5** traductions des locations | ✅ | DE : « 250 CHF/Tag », « Fehlende Fotos: Gesamtansicht, Typenschild ». EN : « 250 CHF/day », « Missing photos: Overview, Rating plate ». |
| **L6** PV traduit | ✅ | DE : « Übernahme- und Rückgabeprotokoll … Vermieter … Betriebsstunden … Keine Schäden festgestellt … Internes Dokument, erstellt mit GO-Mat ». EN : « Pickup and return report … Rental company … Hour meter ». Restent en français les accessoires par défaut (« Clés ou badge »…), enregistrés en base comme texte (N3). *Note* : mon premier relevé semblait encore français, parce que mon interception capturait le HTML avant la traduction (`translateDocument`) ; corrigé en interceptant sur un vrai document. |
| **L7** noms des permis | ✅ | DE : « Hubarbeitsbühne – IPAF 1a (statisch, vertikal) », « Kranführer – Kategorie A (Turmdrehkran) ». EN : « Counterbalance forklift (forklift licence) ». |
| **L8** message de refus | ✅ | « « TEST Perceuse comptoir » exige le permis machine « Nacelle PEMP – IPAF 3b (mobile à flèche) » : TEST Badge Comptoir ne l'a pas (à saisir dans « Permis et formations ») ». Exigence posée temporairement par API sur l'outil TEST, puis retirée. |
| **L9** contrôles au plus tôt | ✅ | Permis machine : refus **au scan** (panier vide). Permis de véhicule : « TEST Permis B n'a pas le permis C1 requis » **dès le choix**. Restitution : « Encore prévu dans les demandes DEM2610-0007 : clôturez-les ou retirez-le d'abord » **au clic**, sans ouvrir l'état des lieux. |
| **L10** demande au-delà de la location | ✅ | « Location jusqu'au 13.11.2026 : retour dépassé » dès le choix des dates. |
| **L11** kilométrage vide | ✅ | Message de l'application : « Relevez le kilométrage » (plus d'infobulle native). |
| **L12** annulation d'une demande | ✅ | « Annuler la demande » présent pour « À valider » ; « Demande DEM2610-0003 annulée », statut `cancelled`. Pas de demande de confirmation. |

### Points jamais couverts auparavant

| Point | Résultat | Preuve |
|---|---|---|
| **Accès expiré** | ✅ | « TEST Accès Expiré », accès jusqu'au 29.10.2026 : fiche « Intérimaire · accès échu le 29.10.2026 » ; absent de « Pour qui » ; badge refusé au comptoir (« Erreur de scan : Badge inconnu, accès suspendu ou personne partie »). Voir N1 et N2. |
| **Hors ligne** (simulé : `navigator.onLine` à faux et événement `offline`) | ✅ | Bandeau « Hors ligne. Les scans continuent avec la copie locale du 30.10.26 15:13 ; chaque validation est gardée sur cet appareil et part toute seule au retour du réseau. » Scan du badge et de l'outil sur la copie locale, validation mise en file (« En attente d'envoi (1) »). Au retour du réseau : « 1 opération faite hors ligne envoyée », file vide, sortie créée en base avec son exemplaire. |
| **Caméra** | ✅ (partiel) | Le navigateur de test refuse l'accès : « Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur. » Le décodage d'un vrai QR n'est pas testable ici. Petit défaut : le bouton affiche « Arrêter la caméra » alors que l'accès est refusé (revient à « Scanner avec la caméra » après clic). |
| **Impressions** | ✅ | Badges : « Imprimer (9) », une carte et un QR par personne, impression lancée. Étiquettes : « Imprimer 1 étiquette ». Étiquette du kit : impression lancée. Rapport PDF du chantier : « Rapport matériel · TEST Chantier carte … TEST Nacelle 3b (TEST Loueur) 1 × 300,00 … Total matériel : CHF 300,00 » (« Période : du … au … » faute de dates sur le chantier). Liste de préparation : « Préparation DEM2610-0008 … ☐ TEST Article suppression GOMAT1-000002 1 × · Préparé par ». Solde de départ : « Solde de départ : TEST Badge Lot16 … Rien à rendre … Signature ». PV de location : voir L6. Impressions interceptées, sans imprimante réelle. |
| **Rôles Magasinier, Responsable, Collaborateur** | ✅ (voir ci-dessous) | Comptes créés par l'utilisateur dans Supabase (mot de passe, confirmés d'office) sur trois fiches TEST créées dans GO-Mat avec le rôle voulu ; liaison automatique à la première connexion. Tests sur un second serveur (port 5191) pour garder la session administrateur du port 5190. Voir N4 (confidentialité). |

### Rôles

Comptes : `test.magasinier@example.com`, `test.responsable@example.com`, `test.collaborateur@example.com` (mot de passe non reproduit ici). Connexion par « J'ai un mot de passe », déconnexion par le menu du compte : ✅ pour les trois.

| Contrôle | Magasinier | Responsable | Collaborateur |
|---|---|---|---|
| Droits du profil | `manage_stock`, `scan`, `view_all` | `all_depots`, `approve`, `manage_fleet`, `manage_people`, `manage_stock`, `scan`, `view_all` | aucun |
| Menus | Accueil, Scanner, Comptoir, Demandes ; Matériel (outils, kits, entretien, atelier, pertes, étiquettes) ; Chantiers (chantiers, carte, planning, locations) ; Personnes (permis et formations, EPI ; **pas** Personnes) ; Pilotage (statistiques, coûts) ; Véhicules ; Réglages (Santé des données) | idem + Personnes, Pilotage complet (pilotage, statistiques, coûts, comptabilité, journal) | Accueil (« Mes demandes »), Demandes, Libre-service, Mon badge, Recherche ; Matériel, Véhicules |
| Accès direct aux pages interdites | `/users`, `/settings`, `/journal`, `/comptabilite` → renvoi à l'accueil ✅ | `/settings` → renvoi ✅ ; `/users` ouvert (droit `manage_people`) ✅ | `/comptoir`, `/scan`, `/users`, `/settings`, `/checkouts`, `/locations`, `/formations`, `/kits` → renvoi ✅ |
| Scanner un badge (base) | autorisé ✅ | autorisé ✅ | refusé : « Seul le magasin peut scanner un badge » ✅ |
| Restauration de sauvegarde (base) | « Accès refusé » ✅ | « Accès refusé » ✅ | « Accès refusé » ✅ |
| Modifier une personne (base) | sans effet (0 ligne) ✅ | autorisé ✅ | sans effet (0 ligne) ✅ |
| Créer un véhicule (base) | refusé (RLS `vehicles_insert_rule`) ✅ | autorisé ✅ (bouton « Ajouter un véhicule » présent) | refusé (RLS) ✅ |
| Modifier le stock (base) | autorisé ✅ | autorisé ✅ | sans effet (0 ligne) ✅ |
| Valider une demande | pas de bouton ; base : « Seul un responsable peut valider ou refuser une demande » ✅ | « Demande DEM2610-0004 validée », décision au nom de « TEST Rôle Responsable » ✅ | — |
| Annuler une demande d'autrui | « Annuler la demande » proposé (voulu : annulation par le magasin) | proposé | — |
| Comptoir | sortie (bon DN2610-0011) et retour ✅ | — | interdit ✅ |
| Voir les sorties et demandes | toutes (`view_all`) ✅ | toutes ✅ | seulement les siennes (0 sortie, 1 demande) ✅ |
| Outils | — | — | lecture seule (« Exporter », « Code QR », « Historique ») ✅ |
| Faire une demande | — | — | à son nom, sans choix « Pour qui » ; DEM2610-0009 créée ✅ |

*Remarque* : les rubriques « Véhicules » et « Réglages » du Magasinier ont d'abord paru vides. Ce sont des rubriques à lien unique (`/vehicules`, en lecture seule, et « Santé des données ») qui naviguent directement au clic : pas de défaut.

### Nouveaux défauts

**N4 — MAJEUR (confidentialité) — Un Collaborateur peut lire les données personnelles de toutes les personnes**
- **Où** : API de la base (`/rest/v1/users`), avec le jeton d'un compte Collaborateur (aucun droit).
- **Ce que j'ai fait** : `GET users?select=*` connecté en `test.collaborateur@example.com`.
- **Attendu** : un Collaborateur ne voit que le nom des autres personnes (ou les champs nécessaires à l'affichage), pas leurs données personnelles.
- **Constaté** : 16 fiches lisibles, avec `email`, `phone`, `deposit_amount`, `deposit_paid_on`, `deposit_returned_on`, `license_categories`, `license_expires_on`, `access_until`, `left_on`, `role`, `permissions`, `person_kind`, `company`. Exemple : « TEST Intérimaire P12 » → caution de 80 CHF, départ le 30.10.2026 ; l'e-mail de l'administrateur est lisible. Les codes de badge (`user_badges`) sont en revanche bien limités au sien.
- **Proposition** : restreindre la lecture de `users` pour les personnes sans `view_all` ni `manage_people` (politique RLS plus une vue publique limitée à `id`, prénom, nom, service), ou des droits par colonne.

**N1 — MINEUR — Comptoir : « Pour le compte de » propose une personne à l'accès échu**
- **Page** : Comptoir, après le scan d'un badge.
- **Constaté** : la liste « Pour le compte de » contient « TEST Accès Expiré » (accès échu le 29.10.2026), alors que les personnes parties en sont exclues et que « Pour qui » (demandes) l'exclut aussi.
- **Attendu** : mêmes règles que « Pour qui ».

**N2 — MINEUR — Accès échu : motif générique et création sans avertissement**
- Au comptoir, le refus dit « Badge inconnu, accès suspendu ou personne partie », sans préciser « accès échu le 29.10.2026 ».
- La personne a pu être créée avec une date d'accès déjà passée, sans avertissement ; le message de création dit « connexion possible avec … ».
- La planche de badges propose aussi cette personne.

**N3 — MINEUR — Accessoires par défaut enregistrés en français**
- Les accessoires cochés à la réception (« Clés ou badge », « Chargeur ou câbles », « Notice d'utilisation ») sont stockés en texte et restent en français dans le PV allemand ou anglais. Les enregistrer par code (traduit à l'affichage) éviterait ce mélange.

### Données TEST ajoutées

| Type | Nom | État final |
|---|---|---|
| Personnes | TEST L1 Alpha, TEST L1 Beta | actives |
| Personne | TEST Intérimaire P12 (caution 80 CHF) | partie, caution rendue |
| Personne | TEST Accès Expiré (accès au 29.10.2026) | accès échu |
| Location véhicule | TEST Utilitaire 2 (TEST 456), réceptionnée, prolongée au 13.11 | en cours |
| Demandes | DEM2610-0003 annulée ; DEM2610-0007 (TEST Utilitaire 2, à valider) ; DEM2610-0008 (TEST Article suppression, à préparer) | — |
| Sortie | TEST Perceuse comptoir pour TEST Badge Comptoir (faite hors ligne, envoyée au retour du réseau) | active |
| Personnes et comptes | TEST Rôle Magasinier, TEST Rôle Responsable, TEST Rôle Collaborateur (comptes Supabase créés par l'utilisateur) | actifs |
| Véhicule | TEST Sonde véhicule (`TEST SONDE`, créé par la sonde du Responsable) | disponible |
| Modifications de sonde | TEST L1 Alpha : service « TEST sonde » (Responsable) ; TEST Article suppression : emplacement « TEST sonde » (Magasinier) | — |
| Demandes | DEM2610-0004 validée par le Responsable ; DEM2610-0009 (Collaborateur, 05.11 → 06.11) validée | — |
| Bon | DN2610-0011 (Magasinier, TEST Article suppression) | rendu |

---

## Préparation

La fusion inachevée de `GOSTOCK-V3` a été terminée comme demandé. `MERGE_HEAD` était vide (0 octet) : un `git commit --no-edit` aurait produit un commit sans second parent. J'ai d'abord vérifié que l'index correspondait exactement à la fusion d'`ef13bf3` dans `ff68435`, puis rétabli `MERGE_HEAD` sur `ef13bf3` avant le `git commit --no-edit`. Résultat : la fusion `38dca25`, à deux parents. Le message par défaut contenait les lignes de commentaire du modèle git ; il a été nettoyé avant l'envoi. La branche a ensuite été mise à jour depuis `origin/tests/rapport-chrome`.

---

## 1. Synthèse

### Verdict lot 16 : **fonctionnellement conforme**, avec des défauts mineurs et un défaut majeur de traduction

Toutes les règles métier demandées fonctionnent :
- photos et signature obligatoires à la réception ;
- permis IPAF 3b exigé au comptoir ;
- date de retour bornée par la fin de location ;
- restitution refusée si l'outil est sorti ou si une demande est ouverte ;
- kilométrage contrôlé à la restitution ;
- équivalences du permis B ;
- PV avec les deux états des lieux côte à côte.

Les défauts trouvés portent sur l'affichage (listes non rafraîchies, pastilles périmées), sur des contrôles qui arrivent tard, et sur les traductions (PV entièrement en français en DE et EN).

### Mise en production : **toujours NO-GO à cause de P5** (hors périmètre de ce lot)

P5 (revenir sur l'onglet démonte toute l'application) n'est pas encore corrigé. Il a gêné le test en continu : formulaires de location, dialogues de suppression et bulles de carte fermés en cours d'action. Le correctif proposé est dans `docs/tests/correctifs-P5-R2.md`.

### Chiffres

- **Points vérifiés** (lignes des tableaux de la section 2) : 40. ✅ 31, ⚠️ 6, ❌ 2, non mesurable 1.
- **Nouveaux défauts** : 12 (L1 à L12), soit 2 majeurs (L1, L6), 8 mineurs et 2 propositions d'amélioration (L9, L12).
- **Contre-tests** : 12 conformes sur 15 ; P12 partiellement relevé, P14 (R2) toujours non corrigé (attendu), P15 non mesurable dans ces conditions.

---

## 2. Résultats par scénario

### 2.1 Permis et formations

| Point | Résultat | Preuve |
|---|---|---|
| Deux groupes « Permis machines » (18) puis « Formations » | ✅ | 18 entrées comptées (cariste, télescopiques, échafaudage, gerbeur, grue de chargement, grutier A et B, 4 machinistes, mini-pelle, IPAF 1a, 1b, 3a, 3b, pont roulant). Le groupe « Formations » apparaît dès qu'une formation existe (créée : « TEST Travail en hauteur », 24 mois). |
| « Nouveau permis ou formation » propose le type | ✅ | Champ « Type » : « Permis machine (cariste, nacelle, grutier, machiniste…) » ou « Formation (travail en hauteur, premiers secours…) ». |
| TEST Cariste reçoit l'IPAF 3b, échéance à 5 ans | ✅ | « Vide : 60 mois après l'obtention » ; enregistré « obtenue le 30.10.2026, valable jusqu'au 30.10.2031 » (`expires_on = 2031-10-30`). La personne n'apparaissait dans la liste qu'après rechargement : voir L1. |
| Fiche personne : toutes les catégories suisses avec libellé | ✅ | A1, A, B1, B, BE, C1, C1E, C, CE, D1, D1E, D, DE, F, G, M, chacune avec son libellé. |
| Permis B seul : F et G oui, C1 et BE non | ✅ | « TEST Permis B » (`license_categories = ["B"]`). F : DEM2610-0003 envoyée ; G : DEM2610-0004 envoyée ; C1 : « TEST Permis B n'a pas le permis C1 requis » ; BE : « TEST Permis B n'a pas le permis BE requis ». Le contrôle n'a lieu qu'à l'envoi : voir L9. |

### 2.2 Location d'un outil ou engin

| Point | Résultat | Preuve |
|---|---|---|
| Nouvelle location « TEST Nacelle 3b », IPAF 3b exigé, ligne « Réception à faire chez le loueur » | ✅ | « 30.10.2026 → 02.11.2026 · TEST Chantier carte · TEST Cariste · 300 CHF/jour … Réception à faire chez le loueur ». |
| Réception refusée sans les 2 photos, puis sans signature | ✅ | « Photos manquantes : Vue d'ensemble, Plaque signalétique », puis « Signature de notre collaborateur manquante ». |
| Avec photos, dégât, accessoires et signature : OK, « Dans le stock » | ✅ | « TEST Nacelle 3b : réception enregistrée, l'outil est dans le stock ». Capture `L16-01`. |
| « Matériel » : « Loué jusqu'au … », `LOC-…`, sans prix par jour | ✅ | Carte « TEST Nacelle 3b · Loué jusqu'au 02.11 » ; `article_number = LOC-2A3955AA`, `daily_rate = null`. |
| Comptoir : refus sans IPAF 3b, accord pour TEST Cariste | ✅ | TEST Badge Comptoir : « Sortie refusée : « TEST Nacelle 3b » exige la formation « Nacelle PEMP – IPAF 3b (mobile à flèche) » : TEST Badge Comptoir ne l'a pas (à saisir dans « Formations ») » (voir L8 et L9). TEST Cariste : bon DN2610-0007. |
| Retour après la fin de location refusé | ✅ | « Location « TEST Nacelle 3b » jusqu'au 02.11.2026 : choisissez un retour avant cette date ou prolongez la location ». |
| Restitution refusée tant que l'outil est sorti, puis OK avec vignettes et dégâts rappelés | ✅ | « L'outil est encore sorti : enregistrez son retour au comptoir d'abord » (seulement à l'enregistrement : voir L9). Après le retour : vignettes « À la réception » à côté de chaque vue, et « Notés à la réception : Outil de travail : TEST rayure 10 cm sur la flèche ». Capture `L16-02`. |
| Après restitution : « Rendu le … », outil retiré, historique conservé | ⚠️ | « Rendu le 30.10.2026 », `status = retired`, 1 sortie conservée, plus proposé dans les demandes. Mais le comptoir l'accepte encore au scan (L2), et « Matériel » affiche toujours « Loué jusqu'au 02.11 » (L3). |
| PV : deux colonnes, photos côte à côte, signatures et heure | ✅ | « Réception · 30.10.26 13:56 » et « Restitution · 30.10.26 13:59 », relevés, dégâts, accessoires, signatures, grille « Vue / Réception / Restitution ». Capture `L16-03`. |
| Supprimer une location avec réception : refusé | ✅ | « Cette location a un état des lieux : elle ne peut plus être supprimée ». |

### 2.3 Location d'un véhicule

| Point | Résultat | Preuve |
|---|---|---|
| Réception refusée sans les 5 vues ni kilométrage, puis OK | ⚠️ | Sans kilométrage : infobulle native du navigateur « Veuillez renseigner ce champ. » (voir L11). Sans photos : « Photos manquantes : Avant, Arrière, Côté gauche, Côté droit, Compteur (km et carburant) ». Ensuite : « TEST Utilitaire : réception enregistrée, le véhicule est dans la flotte ». |
| « Véhicules » : « Loué jusqu'au … » | ✅ | « TEST Utilitaire · Loué jusqu'au 04.11 · TEST 123 · permis B ». |
| Demande : « loué jusqu'au … », refus au-delà, accord dans la période | ✅ | Choix : « TEST Utilitaire TEST 123 · loué jusqu'au 04.11.2026 ». Fin au 06.11 : « Location « TEST Utilitaire » jusqu'au 04.11.2026 : choisissez un retour avant cette date ou prolongez la location » (L10). Fin au 03.11 : DEM2610-0005 envoyée. |
| « + 7 jours » : la pastille suit | ⚠️ | « Prolongée jusqu'au 11.11.2026 », base et ligne à jour ; la page Véhicules affichait encore « 04.11 » jusqu'au rechargement (L4). |
| Restitution refusée si demande ouverte ; km inférieur refusé ; puis OK | ✅ | « Encore prévu dans les demandes DEM2610-0005 : clôturez-les ou retirez-le d'abord ». Après le refus de la demande (pas d'annulation possible, voir L12) : 45 000 km → « Le kilométrage ne peut pas être inférieur à celui de la réception (45 200 km) » ; 45 300 km → « restitution enregistrée, location clôturée », véhicule `retired`. |
| Location « Autre » : bouton « Rendu », sans état des lieux | ✅ | « TEST Benne » : boutons « + 7 jours » et « Rendu », pas de réception ; « Rendu au loueur le (JJ.MM.AAAA) » prérempli, puis « Location rendue ». |

### 2.4 Contre-tests du rapport précédent

| Point | Résultat | Preuve |
|---|---|---|
| P10 exemplaire attaché | ✅ | Kit : sortie `e70193ee` avec `instance_id`, exemplaire `checked-out`. Demande DEM2610-0006 : sortie `a4c4c625` avec le même `instance_id`. |
| P8 préparation conservée | ✅ | Scan, « Demande DEM2610-0006 prête », rechargement complet : « 1 / 1 préparé(s) », « Sortir » actif. |
| P7 retour d'un kit par scan | ✅ | « Retour · TEST Perceuse comptoir · TEST Kit perçage », puis « TEST Badge Comptoir : 1 retour » ; sortie `returned`, exemplaire `available`. |
| P2 badge d'une personne créée dans la session | ✅ | « TEST Badge Lot16 » reconnu au comptoir sans rechargement. |
| P12 caution au départ | ⚠️ | Déroulé conforme en base (`active=false`, caution rendue le 30.10.2026). Le texte de la confirmation n'a pas été relevé sur cette version (script interrompu) ; il l'avait été sur `d401aaf`. |
| P1 QR du badge sur la fiche | ✅ | `GOMAT-USER:c9b2355080f6e188b6`, identique à `user_badges`. |
| P13 personne partie absente de « Pour qui » | ✅ | « TEST Intérimaire Lot16 » (parti) absent. |
| P6 suppression d'un outil avec historique | ✅ | « … a un historique de 8 sortie(s) : il ne peut pas être supprimé. Le retirer du service à la place ? … » |
| P14 boutons du formulaire d'outil | ❌ | Inchangé (R2) : « Suivant » à 1215 px pour un écran de 1018 px ; « URL de l'image » masqué ; section `max-height: 1018px; overflow: hidden`. Correctif proposé dans `correctifs-P5-R2.md`. |
| P11 date obligatoire | ✅ | « Ce champ est obligatoire. » |
| P17 jours hors du mois estompés | ✅ | Jours hors du mois à l'opacité 0,4 (le sélecteur de test s'en sert pour viser les jours du mois). |
| P15 bulle de la carte | Non mesurable | Panneau masqué pendant la mesure : le recentrage de la carte ne s'exécute pas, puis la bulle disparaît (P5). Conforme sur `d401aaf`. |
| P18 chantier sans fiche | ✅ | « Aucune fiche chantier à ce nom : … ». |
| P3 console au démarrage | ✅ | Aucun avertissement ni erreur. |
| P9 restauration sans doublon | ✅ | Sauvegarde 9,1 Mo, 53 tables (dont `rental_inspections`), 0 erreur. Article TEST supprimé par l'interface puis restauré (même identifiant) ; comptes identiques (9 sorties, 4 locations, 4 états des lieux, 1 attestation), 0 QR en double. |

### 2.5 Langues

| Écran | DE | EN |
|---|---|---|
| Locations (liste) | ⚠️ « 250 CHF/jour » non traduit (L5) | ⚠️ idem |
| État des lieux (réception) | ✅ textes, zones et accessoires traduits ; ⚠️ message « Fehlende Fotos: Vue d'ensemble, Plaque signalétique » (L5) | ✅ ; ⚠️ « Missing photos: Vue d'ensemble, Plaque signalétique » |
| PV réception et restitution | ❌ entièrement en français (L6) | ❌ idem |
| Permis et formations | ✅ interface (« Schulungen und Maschinenausweise », « MASCHINENAUSWEISE ») ; noms des 18 permis en français (L7) | ✅ (« Training and machine permits », « MACHINE PERMITS ») ; idem L7 |
| Fiche personne, catégories de permis | ✅ (« BPersonenwagen (3,5 t) », « Temporärkraft ») | — |

---

## 3. Défauts

### L6 — MAJEUR — PV de réception et restitution entièrement en français en DE et EN
- **Page** : Locations → Historique → « Übernahme- und Rückgabeprotokoll » / « PV réception et restitution ».
- **Ce que j'ai fait** : interface en allemand, puis en anglais ; impression du PV de TEST Nacelle 3b (fenêtre interceptée).
- **Attendu** : un document dans la langue de l'interface (« sauf données saisies »).
- **Constaté** : en DE comme en EN, tout le PV reste en français : « PV de réception et de restitution », « Loueur : … · contrat … », « Location du … au … », « Réception · … », « Compteur d'heures », « Dégâts déjà présents à la réception », « Accessoires », « Signatures », « Restitution », « Aucun dégât constaté. », « Photos / Vue / Réception / Restitution », « Document interne établi avec GO-Mat… ».
- **Impact** : document remis à des loueurs germanophones.
- **Capture** : `captures/L16-03-pv-reception-restitution.jpg` (version française).

### L1 — MAJEUR — Personne créée : absente de certaines listes jusqu'au rechargement
- **Pages** : Permis et formations → « Ajouter une personne » (liste « Personne ») ; Demandes → « Pour qui ».
- **Ce que j'ai fait** : créé « TEST Cariste » puis « TEST Permis B » dans Personnes, puis ouvert ces listes sans recharger.
- **Attendu** : la nouvelle personne est proposée.
- **Constaté** : deux fois de suite, la personne n'apparaît qu'après rechargement complet. Un troisième essai (« TEST Badge Lot16 ») était correct : le défaut est intermittent. Même famille que P2, corrigé pour le comptoir seulement.
- **Impact** : impossible d'attribuer un permis ou de faire une demande juste après avoir créé la personne, sans recharger.

### L2 — MINEUR — Comptoir : un outil loué déjà rendu est accepté au scan
- **Page** : Comptoir.
- **Ce que j'ai fait** : scanné `LOC-2A3955AA` (TEST Nacelle 3b, restituée, `status = retired`).
- **Attendu** : refus au scan, avec le motif (« Location rendue au loueur le … » ou « Retiré du service »).
- **Constaté** : ajouté au panier (« Sortie : TEST Nacelle 3b ») ; à la validation : « Arrêt : Plus de stock disponible pour « TEST Nacelle 3b » ». Aucune sortie n'est créée, mais le motif est trompeur.

### L3 — MINEUR — « Matériel » : outil rendu toujours affiché « Loué jusqu'au … »
- **Page** : Matériel → Outils.
- **Constaté** : « TEST Nacelle 3b · Loué jusqu'au 02.11 · STOCK 1 · DISPONIBLE 0 », alors que la location est rendue et l'outil retiré. Attendu : « Rendu le 30.10 » ou « Retiré du service ».

### L4 — MINEUR — Pastille du véhicule non mise à jour après « + 7 jours »
- **Page** : Véhicules, après « + 7 jours » sur la location.
- **Constaté** : base (`rental_until = 2026-11-11`) et ligne de location à jour, mais la page Véhicules affiche « Loué jusqu'au 04.11 » jusqu'au rechargement complet.

### L5 — MINEUR — Traductions incomplètes dans les locations
- « 250 CHF/jour » reste en français dans la liste des locations en DE et EN (« CHF/Tag », « CHF/day »).
- Le message de photos manquantes est traduit, mais pas les noms des vues : « Fehlende Fotos: Vue d'ensemble, Plaque signalétique », « Missing photos: Vue d'ensemble, Plaque signalétique ». Même cas probable pour les vues des véhicules (« Avant, Arrière… »).

### L7 — MINEUR — Noms des 18 permis machines non traduits
- **Page** : Permis et formations (DE, EN).
- **Constaté** : « Chariot élévateur frontal (permis de cariste) », « Nacelle PEMP – IPAF 3b (mobile à flèche) »… et leurs descriptions restent en français. Ce sont des données de la migration (exception des consignes), mais elles sont livrées par l'application : prévoir des libellés traduits (ou une colonne par langue) pour les équipes germanophones.

### L8 — MINEUR — Message de refus : renvoi à « Formations »
- **Page** : Comptoir.
- **Constaté** : « … ne l'a pas (à saisir dans « Formations ») », alors que le menu s'appelle « Permis et formations ».

### L10 — MINEUR — Demande véhicule : « Libre sur la période » puis refus
- **Page** : Nouvelle demande, onglet Véhicule.
- **Constaté** : avec une fin au 06.11 (au-delà de la location au 04.11), la ligne indique « Libre sur la période », puis l'envoi est refusé (« Location … jusqu'au 04.11.2026… »). Attendu : « Location jusqu'au 04.11 » dès le choix des dates.

### L11 — MINEUR — Réception véhicule : kilométrage vide signalé par le navigateur
- **Constaté** : le refus vient de l'infobulle native (« Veuillez renseigner ce champ. »), pas d'un message de l'application comme pour les photos et la signature. Incohérent, et peu visible sur mobile.

### L9 — AMÉLIORATION — Contrôles qui arrivent tard
- Permis du véhicule (C1, BE) vérifié seulement à l'envoi de la demande, pas au choix du véhicule.
- Permis machine (IPAF 3b) vérifié seulement à la validation au comptoir, pas au scan de l'outil.
- Restitution « outil encore sorti » signalée seulement après avoir rempli tout l'état des lieux (photos, signatures). Proposition : vérifier à l'ouverture de la fenêtre, avant la saisie.

### L12 — AMÉLIORATION — Pas d'annulation d'une demande « À valider »
- **Page** : fiche d'une demande « À valider ».
- **Constaté** : seules les actions « Refuser » et « Valider » existent. Pour libérer le véhicule (restitution), il a fallu refuser la demande avec un motif. Proposition : une action « Annuler la demande » pour le demandeur ou le magasin.

### Rappels hors périmètre (non corrigés, attendus)
- **P5** : toujours présent ; c'est la cause des formulaires fermés pendant le test. Capture `captures/L16-04-chargement-retour-onglet.jpg`.
- **R2 (P14)** : toujours présent.
- **R1, R3** : non retestés.

---

## 4. Données TEST laissées en base

| Type | Nom | État final |
|---|---|---|
| Formation | TEST Travail en hauteur (24 mois) | sans titulaire |
| Attestation | TEST Cariste · Nacelle PEMP – IPAF 3b | valable jusqu'au 30.10.2031 |
| Personnes | TEST Cariste, TEST Permis B (permis B), TEST Badge Lot16 | actives |
| Personne | TEST Intérimaire Lot16 (caution 100 CHF) | partie, caution rendue |
| Véhicules | TEST Tracteur G, TEST Véhicule F, TEST Camion C1, TEST Remorque BE | disponibles |
| Véhicule loué | TEST Utilitaire (TEST 123) | restitué, retiré |
| Outil loué | TEST Nacelle 3b (`LOC-2A3955AA`) | restitué, retiré, 1 sortie en historique |
| Locations | TEST Nacelle 3b, TEST Utilitaire, TEST Benne (rendues) ; TEST Langue (en cours, réception à faire) | — |
| Demandes | DEM2610-0003, DEM2610-0004 (TEST Permis B, F et G) : à valider ; DEM2610-0005 : refusée ; DEM2610-0006 : sortie active (TEST Perceuse comptoir, exemplaire `GOMAT1-000001-001`) | — |
| Bons | DN2610-0007 (nacelle, rendu), DN2610-0008 (kit, rendu) | — |
| Outil | TEST Article suppression | supprimé par l'interface puis restauré (même identifiant) |

Aucun nettoyage n'a été fait. La location réelle « Manitou MT 625 · LOXAM » n'a pas été touchée.

## 5. Limites

- Tests pilotés par script dans le navigateur intégré : signatures dessinées par des événements de pointeur simulés, photos générées dans la page, impression interceptée (le PV a été lu, puis affiché une fois pour la capture).
- Le panneau de prévisualisation alterne visible et masqué toutes les 6 secondes environ. Avec P5, cela a fermé des formulaires en cours ; plusieurs saisies ont dû être refaites. Les mesures visuelles faites panneau masqué (P15) ne sont pas fiables.
- Un seul compte (administrateur) ; les rôles Magasinier, Responsable et Collaborateur ne sont pas couverts.
