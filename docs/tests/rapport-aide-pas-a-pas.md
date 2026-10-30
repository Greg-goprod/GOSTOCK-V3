# Aide GO-Mat suivie pas à pas : écarts entre le mode d'emploi et l'application

- **Version testée** : branche `claude/loving-thompson-6zfo06`, commit `236b4a8` (« Aide pas à pas complète et nouvelle page Aide »), servie en local (worktree GOMAT-essai). L'adresse go-stock.netlify.app n'est pas joignable depuis le navigateur de test ; le code `src` est le même.
- **Base** : GO-MAT (`xxzcaxizqndvhnzchqkp`). Seules des données préfixées « TEST » ont été créées ou modifiées. Rien d'autre n'a été supprimé.
- **Date** : 30.10.2026.
- **Comptes** :

  | Rôle | Compte | Utilisé pour |
  |---|---|---|
  | Magasinier | test.magasinier@example.com | comptoir, préparer et sortir une demande, départ et retour de véhicule, scanner, libre-service, inventaire, emplacements, kits, étiquettes, écran TV, hors ligne |
  | Responsable | test.responsable@example.com | valider une demande, ajouter un outil, ajouter une personne, départ d'une personne |
  | Collaborateur | test.collaborateur@example.com | faire une demande, paniers, annuler, déposer dans la boîte, Mon badge, mot de passe, menu téléphone |
  | Administrateur | session admin | démarrage, paramètres, santé des données, dépôts, transferts, chantiers, locations, entretien, atelier, pertes, EPI, permis, véhicules, commandes, coûts, comptabilité, journal, recherche, carte, planning |

  Les articles sans rôle indiqué ont été suivis avec le compte qui a accès à la page.
- **Méthode** :
  1. Les 39 articles, 107 tâches et 372 étapes ont été extraits de `src/help/content.ts`.
  2. Chaque libellé cité entre « » (706 au total) a été recherché dans le code de l'application. 12 sont introuvables ; ils sont signalés ci-dessous.
  3. Chaque tâche a été exécutée dans l'application avec le rôle indiqué. Les libellés réellement affichés (boutons, champs, titres de volets, messages) ont été relevés à chaque étape.
  4. Les 48 captures `public/aide/*.jpg` ont été comparées aux écrans réels.

**Légende** : ✅ conforme · ⚠️ écart de texte, d'ordre ou d'étape · ❌ résultat différent ou bug · ⏭ non exécuté (raison donnée)

---

## 1. Les écarts les plus importants

| # | Article › tâche › étape | Problème |
|---|---|---|
| E1 | véhicules › retour › é3-é4 | **Deux étapes manquent dans l'aide** : une photo au retour est obligatoire, même sans dégât, et le conducteur doit signer. Tant que ce n'est pas fait, « Valider le retour » reste grisé sans explication. |
| E2 | véhicules › départ › é3-é5 | « Valider la sortie » reste grisé sans message tant que la photo et la signature manquent. La signature s'appelle « Signature de *nom du conducteur* » et non « Signature du conducteur ». |
| E3 | outils › permis é3 et retirer é1 | **Le bouton « Enregistrer » n'existe pas.** Le volet « MODIFIER LE MATÉRIEL » demande « Suivant » (étape des QR) puis « Modifier le matériel ». Il manque donc une étape. |
| E4 | inventaire › compter é2 et é5 | « Masquer les quantités attendues » n'est pas une case à cocher. C'est le libellé que prend le bouton « Vérifier les écarts » une fois les quantités attendues affichées. « Clôturer » n'apparaît qu'après ce clic. Résultat : le stock n'est corrigé que pour les consommables ; pour les outils, l'écart est seulement signalé. |
| E5 | comptoir › rendre é4 et problème 1 | Un retour « Sale » **sans remarque ni photo est accepté**. Le message n'apparaît que pour Incomplet, À réparer et Cassé (`Counter.tsx` l. 388). L'aide dit « si ce n'est pas OK ». |
| E6 | comptoir › kit problème 1 | Le message « Kit « … » incomplet : *outil* : 0 sur 1 disponibles » s'affiche, **mais l'outil indisponible est quand même ajouté au panier** (`Counter.tsx` l. 272-273). L'aide dit que seul le reste est ajouté. |
| E7 | commandes › créer é3 | Un consommable **sans fournisseur** apparaît sur la feuille, sous « Sans fournisseur ». Mais « Créer les bons de commande » ne crée rien et affiche « Tout est déjà en commande », ce qui est faux. La fonction SQL exclut ces lignes (`supplier_id IS NOT NULL`, migration 12, l. 270). L'aide ne dit pas qu'un fournisseur est nécessaire. |
| E8 | coûts › coûts é2 (et comptoir › tiers) | Une sortie faite « pour le compte de » quelqu'un crée **une ligne de chantier fantôme** dans « Coûts » : « TEST Chantier carte · retiré par TEST Badge Comptoir ». La note « retiré par » est collée au nom du chantier. |
| E9 | sorties › voir é4 (et comptoir › sortir, résultat) | Le comptoir annonce « bon DN2610-0013 » et le volet s'intitule « Retour - Bon DN2610-0013 ». Mais la liste des Sorties affiche « Bon #Bon-8547a7 ». On ne retrouve pas le numéro annoncé. |
| E10 | demandes › créer problème 1 ; EPI › remettre problème 1 | Les messages de l'aide (« Choisissez la personne qui fait la demande », « Choisissez la taille ») n'apparaissent jamais. Le navigateur bloque avant, avec sa bulle « Sélectionnez un élément dans la liste ». |
| E11 | locations › créer problème 1 | Une date de retour avant le début ne produit pas « La date de retour précède le début de la location ». Le sélecteur refuse avec « Choisissez une date à partir du 30.10.2026 ». |
| E12 | locations (où) | L'article dit **Véhicules › Locations**. La page est dans le menu **Chantiers › Locations** (menu, fil d'Ariane et captures). |
| E13 | messages non traduits | Le scanner affiche « Statut: checked-out » sur la fiche « Matériel identifié ». Mon badge affiche « New password should be different from the old password. » quand on enregistre le même mot de passe. |
| E14 | personnes › ajouter é5 (A2, toujours ouvert) | « Coche seulement la catégorie la plus haute » est vrai pour B (B couvre B1, F, G et M), mais faux pour les camions et les cars. Dans `license_covers` (migration 26), CE ne couvre que C1E et BE, sans C, C1 ni B ; C ne couvre que C1 ; D ne couvre que D1. |
| E15 | démarrage-admin › parcours | L'application compte **9 étapes** : 1 entreprise, 2 dépôts, 3 personnes, 4 matériel, 5 emplacements (facultatif), 6 étiquettes, 7 badges, 8 connexion et e-mails, 9 contrôle final. L'aide en décrit 7 et range emplacements et étiquettes dans « Le matériel ». L'étape 8 affiche un texte technique destiné au développeur : « Dans Supabase : adresse du site, code dans l'e-mail de connexion, compte d'envoi (SMTP). Voir BACKLOG.md. » |
| E16 | listes de personnes | Les listes « Pour qui » (sortie de consommable), « Retiré par » (demande), « Personne responsable » (pertes) et « Personne » (EPI) proposent des personnes **désactivées ou expirées**, par exemple « TEST Accès Expiré » ou « TEST Aide Intérim » dont le départ est clôturé. Le comptoir, lui, les masque. |

---

## 2. Détail par article (article › tâche › n° d'étape › attendu / constaté)

### Se connecter (`connexion`) — tout le monde
| Tâche | Étape | Attendu (aide) | Constaté | |
|---|---|---|---|---|
| code | é2-é3 | « Adresse e-mail », bouton violet « Recevoir un code » | identique ; le bouton est rgb(90,70,214) | ✅ |
| code | é4-é6 | e-mail « Mannyx », 8 chiffres, « Code reçu », « Se connecter » | écran du code non revu ici, faute de boîte e-mail ; vu à la connexion initiale | ⏭ |
| code | problème 1 | « Renvoyer le code » | pendant 60 s, le lien s'appelle « Renvoyer (60 s) » ; il devient « Renvoyer le code » ensuite (`Login.tsx` l. 193) | ⚠️ |
| mot-de-passe | é2-é4 | « Mon mot de passe (facultatif) », « Nouveau mot de passe », « Répéter le mot de passe », « Enregistrer le mot de passe » | même texte ; les deux champs n'ont pas de libellé visible, le texte est dans le champ (« Nouveau mot de passe (8 caractères ou plus) ») | ✅ |
| mot-de-passe | résultat | « Mot de passe enregistré » | avec le mot de passe déjà utilisé : message anglais de Supabase (voir E13) | ❌ |
| mot-de-passe | é5 | « J'ai un mot de passe », e-mail et mot de passe, « Se connecter » | identique ; la connexion du magasinier et du collaborateur fonctionne et affiche « Bonsoir, TEST » | ✅ |
| installer | é2-é3 | libellés de Safari et Chrome | non testable dans l'aperçu (les libellés « Ajouter à l'écran d'accueil » et « Installer l'application » viennent du navigateur) | ⏭ |
| langue | é1 | rond aux initiales, liste Français / Deutsch / Italiano / English ; sous le logo sur la page de connexion | identique : menu « Compte de … » avec « Langue », et liste « Langue » sur la page de connexion | ✅ |
| langue | é2 | icône lune ou soleil | bouton « Passer en mode sombre » | ✅ |

### Se repérer (`navigation`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| menu | é1 | Accueil, Magasin, Matériel, Consommables, Véhicules, Chantiers, Personnes, Pilotage ; Réglages et Aide en bas | même liste, mais le menu affiche **« Consom. »** | ⚠️ |
| menu | é4 | fil d'Ariane « Magasin › Comptoir » | identique | ✅ |
| téléphone | é1-é2 | 4 pages et « Plus » | Collaborateur : « Accueil · Demandes · Mon badge · Recherche · Plus » ; Magasinier : « Accueil · Scanner · Comptoir · Demandes · Plus » | ✅ |
| recherche-rapide | é1 | Ctrl+K ou « Rechercher… » | bouton « Recherche rapide (Ctrl+K) » ; sur écran étroit, il n'y a que l'icône | ✅ |
| aide-page | é1-é2 | « ? » ouvre l'aide à droite | bouton « Aide de cette page », volet à droite | ✅ |

### Ta journée de magasinier (`demarrage-magasinier`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| matin | é1 | tuiles du haut, « Aujourd'hui au magasin » | identiques | ✅ |
| matin | é2 | « Demandes à préparer » | la tuile affiche **4** et dit « Validées, à sortir aujourd'hui ou demain ». Le bloc « Aujourd'hui au magasin » et la liste « À préparer (aujourd'hui et demain) » en comptent **3** (la 4e est pour le 05.11). Les compteurs ne concordent pas. | ❌ |
| matin | é3 | « Boîte de retour » avec un chiffre | tuile présente | ✅ |
| journée | é2 | « Écran TV du dépôt » | seulement dans le menu Magasin, pas en tuile | ✅ |
| semaine | é1-é3 | « Inventaire », « À commander », « Retours en retard » | tuiles présentes | ✅ |

### Ta journée de collaborateur (`demarrage-collaborateur`) — Collaborateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| base | é1-é4 | « Mon matériel », « Mon badge », « Nouvelle demande », « Libre-service » | tuiles présentes (« Mon matériel (1) … à rendre le 31.10.2026 ») | ✅ |

### Ton rôle de responsable (`demarrage-responsable`) — Responsable
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| base | é1 | « Demandes à valider », « Valider » / « Refuser » | tuile « Demandes à valider · En attente de votre décision » | ✅ |
| base | é2-é4 | Pilotage, Chantiers, Pertes et casse | présents | ✅ |

### Mettre GO-Mat en service (`demarrage-admin`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| parcours | é1 | « x / y faites » | « Mettre GO-Mat en service, étape par étape · 3 / 9 faites. » | ✅ |
| parcours | é2-é8 | 7 rubriques, dans l'ordre | 9 rubriques dans l'application (voir E15) | ⚠️ |
| parcours | é2 | nom de l'entreprise, puis « Enregistrer » | identique ; il y a aussi un lien « Série des numéros d'articles, logo → » | ✅ |
| parcours | é4 | « Modèle Excel » puis importer | « Modèle Excel » et un champ fichier | ✅ |
| parcours | é7 | « Connexion et e-mails » : choisir les destinataires | texte technique « Dans Supabase … Voir BACKLOG.md. » et lien « Destinataires des alertes → » | ❌ |
| parcours | é9 | cocher « Fait » | case « Fait » sur chaque étape | ✅ |

### Le comptoir (`comptoir`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| sortir | é1 | « Auto » sélectionné | identique (« Auto / Sortie / Retour ») | ✅ |
| sortir | problème 1 | « Scannez d'abord le badge de la personne » | identique, avec « Erreur de scan : Aucune personne » | ✅ |
| sortir | é3 | « choisissez la personne », taper, cliquer | lien identique ; le champ s'appelle « Nom ou service… » | ✅ |
| sortir | é4 | « En sa possession » | « EN SA POSSESSION (COCHER POUR RENDRE) » | ✅ |
| sortir | é5 | « Panier », « Sortie · nom de l'outil » | « Panier (1) / Sortie · TEST Article suppression » | ✅ |
| sortir | é6 | « Un de plus » / « Un de moins » pour un lot | les boutons apparaissent aussi pour un outil à exemplaire unique | ⚠️ |
| sortir | é7 | « Retour prévu », « Ce soir », « Demain », « Vendredi », « + 1 semaine », date et heure | identique | ✅ |
| sortir | é8 | « Chantier ou service », les noms marqués « Chantier » | liste de suggestions : « Chantier » ou « Sans fiche chantier » | ✅ |
| sortir | résultat | message vert avec le numéro du bon | « TEST Badge Comptoir : bon DN2610-0012 » ; ce numéro est introuvable dans Sorties (E9) | ⚠️ |
| sortir | problèmes 2-4 | outil refusé, « Signature à la remise », « Plus de stock disponible » | non reproduits (aucun outil TEST de valeur ou retiré) | ⏭ |
| rendre | é2 | un outil déjà détenu part en « Retour » en mode Auto ; on peut aussi cocher la ligne | les deux fonctionnent (« Retour : … ») | ✅ |
| rendre | é3 | « OK », « Sale », « Incomplet », « À réparer », « Cassé » | identique | ✅ |
| rendre | é4 | remarque ou photo si ce n'est pas « OK » | champ « Ce qui ne va pas… » (« Ce qui manque… » pour Incomplet), « Photos / Ajouter » ; **Sale passe sans remarque** (E5) | ❌ |
| rendre | problème 1 | message pour un retour non conforme | identique pour Incomplet | ✅ |
| rendre | résultat | « x retour(s) » ; À réparer → maintenance | « TEST Badge Comptoir : 1 retour (dont 1 en maintenance) » | ✅ |
| rendre | problème 2 | « X n'a pas … » | « TEST n'a pas « TEST Article suppression » » (prénom seulement) | ✅ |
| kit | é2-é3 | le QR du kit ajoute tout le contenu | fonctionne avec le code `GOMAT-KIT:68AA6303` | ✅ |
| kit | problème 1 | « Kit … incomplet » ; le reste est ajouté | message identique, mais l'outil indisponible est ajouté aussi (E6) | ❌ |
| tiers | é2 | « Pour le compte de » | liste déroulante « POUR LE COMPTE DE » (« … (lui-même) ») | ✅ |
| tiers | résultat | au nom du collègue ; le bon indique « retiré par » | « TEST Badge Lot16 : bon DN2610-0013 » ; notes du bon : « TEST Chantier carte · retiré par TEST Badge Comptoir » ; effet secondaire dans Coûts (E8) | ⚠️ |
| consommables | é2-é4 | « Un de plus », « Dépôt des consommables », chantier, « Valider » | identique ; le chantier n'est pas obligatoire → « TEST Badge Comptoir : 1 consommable » | ✅ |
| consommables | problème 1 | « Un consommable ne se rend pas » | « Un consommable ne se rend pas : il est décompté à la sortie » | ✅ |
| boîte | é1 | carte « Boîte de retour » | « Boîte de retour (1) · TEST Rôle Collaborateur · TEST Article suppression · déposé le 30.10.26 18:56 » | ✅ |
| boîte | é2 | « Contrôler », vérifier l'état, « Valider » | « Contrôler » choisit seulement la personne : **il faut encore cocher l'outil** dans « En sa possession » (étape manquante). Ensuite « 1 retour ». | ⚠️ |
| hors-ligne | é1-é3 | bandeau « Hors ligne », « En attente d'envoi », « Envoyer maintenant » | identique : « Hors ligne. Les scans continuent avec la copie locale… », « En attente d'envoi (1) », « Envoyer maintenant », puis « 1 opération faite hors ligne envoyée » au retour du réseau | ✅ |
| annuler | é1 | « Vider » ; la croix de la fiche change de personne | « Vider » ; bouton « Changer de personne » | ✅ |

### Les demandes (`demandes`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer (Collaborateur) | é1-é2 | « Nouvelle demande » ; « Pour qui » déjà rempli | identique ; le champ est grisé | ✅ |
| créer | é4 | « Du », « Au », « Dépôt » | identique | ✅ |
| créer | é5 | onglets, « Rechercher… », « + » de la ligne | la ligne entière est cliquable, avec une icône « + » | ✅ |
| créer | é6 | « 3 disponibles sur la période », « Libre sur la période », problème en rouge | outil déjà sorti : « 0 disponible sur la période » en rouge ; consommable : « 42 paire en stock au dépôt » ; véhicule : « … n'a pas le permis F requis (permis non renseigné dans « Personnes ») » | ✅ |
| créer | é7 | quantités, « Remarque », « Envoyer la demande » | « Remarque (facultatif) » est placée **avant** les onglets, pas après | ⚠️ |
| créer | résultat | numéro + « Validée » ou « À valider » | « Demande DEM2610-0010 validée automatiquement » | ✅ |
| créer | problème 1 (admin, sans personne) | « Choisissez la personne qui fait la demande » | bulle du navigateur « Sélectionnez un élément dans la liste » (E10) | ❌ |
| créer | problème 2 | « La fin doit être après le début » | identique | ✅ |
| créer | problème 3 | « Un seul véhicule par demande » | identique ; et « Une demande avec véhicule est toujours validée par un responsable. » (A4 : c'est désormais dit à l'écran) | ✅ |
| panier | é1 | « Enregistrer comme panier » | fenêtre « Saisie » / « Nom du panier (ex. Kit carottage, Mon lundi) : » → « Panier « TEST Panier aide » enregistré » | ✅ |
| panier | é2 | « Mes paniers » | liste « Mes paniers / — Charger un panier — » | ✅ |
| panier | é3 | « Refaire cette demande » | bouton présent dans le volet | ✅ |
| valider (Responsable) | é1-é3 | filtre « À valider », « Validation requise : … », « Remarque (obligatoire si refus) », « Refuser », « Valider » | identique (« Validation requise : véhicule ») ; « Refuser » sans motif → « Indiquez la raison du refus » | ✅ |
| valider | résultat | passe dans « À préparer » | « Demande DEM2610-0007 validée », compteur À préparer de 3 à 4 | ✅ |
| préparer (Magasinier) | é1 | « Contenu », « 0 / x préparé(s) » | « 0 / 1 préparé(s) » | ✅ |
| préparer | é2 | « Liste de préparation » | présent | ✅ |
| préparer | é3 | « Scannez ou saisissez un code… », « x exemplaire(s) scanné(s) » | « Scannez ou saisissez un code... » → « 1 exemplaire(s) scanné(s) », « TEST Article suppression préparé » | ✅ |
| préparer | é4 | « Marquer prête » | « Demande DEM2610-0008 prête », le volet se ferme. « Sortir » est déjà actif avant « Marquer prête » : l'étape est facultative en pratique. | ⚠️ |
| préparer | problème 1 | « Remettre en préparation » | présent sur une demande prête | ✅ |
| sortir | é2 | « Retiré par » | liste présente ; elle contient des personnes expirées (E16) | ⚠️ |
| sortir | é4 | « Sortir » ; véhicule : « Sortir : état des lieux » … « Valider la sortie » | « Demande DEM2610-0008 sortie » ; le parcours véhicule est décrit sous « véhicules › départ » (A1 corrigé) | ✅ |
| sortir | problème 1 | « Tous les articles doivent être préparés avant la sortie » | texte présent sous le bouton | ✅ |
| annuler | é1 | « Annuler ma demande » / « Annuler la demande » | « Demande DEM2610-0010 annulée » ; « Annuler la demande » visible côté magasin | ✅ |

### Les sorties (`sorties`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| voir | é2-é3 | « Rechercher par équipement ou utilisateur… », « Grille » / « Liste » | identique (avec « ... ») | ✅ |
| voir | é4 | « Détails / retour » ouvre le bon ; bouton « Retourner » | volet « Retour - Bon DN2610-0013 » : il faut cocher « Retourner cet équipement » puis cliquer « Confirmer le retour ». **Il n'y a pas de bouton « Retourner ».** → « Équipement retourné » | ⚠️ |
| voir | — | — | la liste affiche « Bon #Bon-xxxxxx » au lieu du n° DN (E9). Boutons non cités : « Mettre à jour les statuts », « Nouvelle sortie », « Équipements ». | ❌ |

### Le scanner (`scanner`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| identifier | é1 | « Scanner avec la caméra » | présent | ✅ |
| identifier | é2 | ou taper le code dans le champ | code article et code d'exemplaire : OK. **N° de bon tapé (« DN2610-0013 »)** → « Aucun élément trouvé pour le code scanné: DN2610-0013 » | ⚠️ |
| identifier | é3 | « Matériel identifié », « Emprunt identifié »… | identiques ; mais « Statut: checked-out » (E13) | ❌ |
| identifier | é4 | « Retourner le matériel » | présent sur un emprunt | ✅ |

### Libre-service (`libre-service`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| prendre | (avant é1) | — | **étape manquante** : rien n'est pris tant que l'article n'est pas coché dans « Consommables › Libre-service ». L'écran dit « Aucun consommable n'est encore en libre-service (fiche de l'article, côté magasin). » mais l'article Consommables n'explique pas ce réglage. | ⚠️ |
| prendre | é2-é4 | « Armoire du dépôt », « Un de plus », « Pour le chantier », « Je prends » | identique → « Pris en libre-service : c'est noté à votre nom » | ✅ |
| prendre | problème 1 | « Pas libre-service » | « Erreur de scan : Pas libre-service » + « « TEST Gants aide » n'est pas en libre-service : passez au magasin ». Le même message s'affiche pour un **outil** scanné dans l'onglet « Prendre », ce qui induit en erreur. | ⚠️ |
| déposer (Collaborateur) | é1 | partie boîte de retour, scanner | onglet « Rendre (1) » ; scanner ou cocher la ligne. Si rien n'est emprunté : « Vous n'avez rien à rendre. » et aucun champ. | ✅ |
| déposer | é2-é3 | « Remarque pour le magasin », « Déposé dans la boîte » | identique → « 1 outil déposé : le magasin contrôlera l'état » | ✅ |
| déposer | problème 1 | « Pas emprunté » | non reproduit (un code inconnu donne « Code inconnu : … ») | ⏭ |

### Transferts (`transferts`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| envoyer | é1 | « Nouveau transfert » | **absent tant qu'il n'y a qu'un dépôt** (« Un seul dépôt : créez-en un autre dans Paramètres pour transférer du matériel. »). Le problème « Un seul dépôt » de l'aide renvoie à Consommables › Dépôts ou Paramètres. | ⚠️ |
| envoyer | é2-é4 | « Depuis », « Vers », « Ajouter : nom ou numéro… », « Quantité », « Remarque », « Envoyer » | identique ; la quantité n'a pas de libellé → « Transfert TRF2610-0001 en route vers TEST Dépôt aide » | ✅ |
| recevoir | é1-é2 | « Réceptionner », scanner ou quantité « Reçu » | volet « Réception TRF2610-0001 » ; « Reçu » est un **bouton** (tout reçu), pas une quantité | ⚠️ |
| recevoir | é3 + résultat | « Clôturer la réception » → « Tout est arrivé : transfert réceptionné. » | le message s'affiche dès que tout est reçu, et le bouton « Clôturer la réception » **disparaît** : la clôture est automatique | ⚠️ |

### Emplacements (`emplacements`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer | é2 | « Code », « Description », « Ajouter l'emplacement » | identique (bouton icône « + ») → « Emplacement créé » | ✅ |
| créer | é3 | bouton « Créer une série », « Préfixe », le nombre (1 à 200), « Créer » | « Créer une série » est un **titre**, pas un bouton ; les champs sont « Préfixe », « De », « À » (une plage), puis « Créer » | ⚠️ |
| ranger | é1-é2 | « Rangement des articles », « Nom ou numéro… », liste | identique | ✅ |

### Inventaire (`inventaire`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| compter | é1 | « Dépôt », « Nombre d'articles », « Lancer l'inventaire » | identique ; avec un seul dépôt, il n'y a pas de choix | ✅ |
| compter | é2 | case « Masquer les quantités attendues » cochée | voir E4 | ❌ |
| compter | é3-é5 | « Vérifier les écarts », motifs, « Clôturer » | « Clôturer » n'apparaît qu'en mode vérification, puis confirmation → « Inventaire clôturé : 0 écart appliqué ou signalé » | ⚠️ |
| compter | résultat | stock corrigé ; « Derniers inventaires » | « Derniers inventaires · 30.10.2026 · 3 articles · sans écart » ; les outils ne sont pas corrigés, seulement signalés | ⚠️ |

Note : un inventaire du 30.10 16:18 était resté ouvert. Il a été clôturé en saisissant exactement les quantités attendues : le stock n'a pas bougé.

### Écran TV (`ecran-tv`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| afficher | é2-é4 | choix du dépôt, « Plein écran », l'adresse retient le dépôt | identique (`/ecran?depot=…`) | ✅ |
| afficher | résultat | 4 colonnes | identique. « À préparer » ne compte que les demandes **du jour**, alors que l'accueil compte « aujourd'hui et demain » : 0 sur la TV, 3 sur l'accueil. | ⚠️ |

### Outils (`outils`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| trouver | é2-é4 | recherche, « Filtres », « Grille » / « Liste », « Disponible » sur « Stock total », « Statut » | identique en vue Liste (« STOCK TOTAL », « DISPONIBLE », « STATUT ») ; en Grille : « STOCK / DISPONIBLE » | ✅ |
| ajouter (Responsable) | é2 | « Depuis le catalogue : » | « Remplir depuis le catalogue » | ⚠️ |
| ajouter | é5 | valeur ; « Coût imputé au chantier par jour de sortie » | les champs s'appellent « Prix d'achat (CHF) » et « Tarif interne par jour (CHF) » ; la phrase citée est le texte d'aide sous le champ | ⚠️ |
| ajouter | é6-é8 | « Quantité disponible », « Suivant », choix du QR, « Créer le matériel » | identique → « Matériel ajouté avec succès (2 pièces) » | ✅ |
| ajouter | — | — | champs non cités : « Statut », « Permis machine ou formation obligatoire », « Achat, garantie, amortissement », « Batterie… », « Emplacement », « Description », « URL de l'image » | ⚠️ |
| permis | é2 | exemple « Nacelle PEMP (IPAF) » | la liste propose « Nacelle PEMP – IPAF 1a / 1b / 3a / 3b (…) » | ⚠️ |
| permis | é3 | « Enregistrer » | voir E3 | ❌ |
| historique | é1-é2 | icône d'historique | « Historique de … » → « Historique · … », « Aucun événement pour l'instant. » | ✅ |
| retirer | é1 | « Statut » « Retiré du service », « Enregistrer » | statut OK, mais le bouton final est « Modifier le matériel » (E3) → « Matériel modifié avec succès » | ⚠️ |
| retirer | é2 | poubelle « Supprimer l'équipement » | « Supprimer *nom* » → fenêtre « Supprimer l'équipement » → « Équipement supprimé avec succès » | ✅ |
| importer | é1-é5 | « Importer », « Télécharger le modèle Excel »… | volet « Import Excel - Matériel » présent ; import non lancé (il aurait créé des articles sans le préfixe TEST) | ⏭ |

### Kits (`kits`) — Magasinier
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer | é2 | « Nom », « Dépôt » | identique ; « Dépôt » est vide (« — ») par défaut ; champ « Remarque » non cité | ✅ |
| créer | é3 | « Ajouter un outil : nom ou numéro… », « Exemplaire » / « N'importe lequel » | identique | ✅ |
| créer | é4-é5 + résultat | « Enregistrer », imprimer le QR, « Kit enregistré » | identique ; bouton « Imprimer l'étiquette de … » | ✅ |
| créer | problème 1 | « Ajoutez au moins un outil au kit » | identique | ✅ |

### Étiquettes (`etiquettes`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| imprimer | é2 | « Format » (ex. Brother 62 mm) | « Rouleau Brother DK-22205 (62 × 29 mm, une par page) » | ✅ |
| imprimer | é3 | « Rechercher un article… », « Tous » / « Aucun » pour tout cocher | « Tous » existe seulement **par article**, pour ses exemplaires ; **il n'y a pas de bouton « Aucun »** ni de sélection globale | ⚠️ |
| imprimer | é4-é5 | « Commencer à la position », « Imprimer » | présents ; impression non lancée | ✅ |

### Entretien (`entretien`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| plan | é3 | « Révision », « Contrôle électrique OIBT », « Intitulé » | « Entretien / révision », « Contrôle électrique (OIBT) » | ⚠️ |
| plan | é2 | « Rechercher un outil » | liste de cases sous « Outils concernés » | ✅ |
| plan | é4-é6 | intervalles, « Dernière intervention », « Bloquer les sorties une fois échu », « Créer » | identique → « 1 plan créé » | ✅ |
| plan | problèmes 1-2 | messages | identiques | ✅ |
| fait | é1-é3 | « Fait », « Date », « Technicien / entreprise », « Conforme » / « Non conforme », « Remarque », « Enregistrer » | « Conforme / effectué » ; « Coût (CHF) » et photo non cités → « TEST Révision aide enregistré » | ✅ |
| fait | résultat | « Historique » | présent (avec « Suspendre ») | ✅ |

### Atelier (`atelier`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| envoyer | é2 | « Outil », « Exemplaire », « Réparateur » (fournisseur ou « Autre réparateur ») | une liste **« Fournisseur »** (avec « Autre réparateur ») **et** un champ « Réparateur » | ⚠️ |
| envoyer | é3 | ordre « Panne », « Retour prévu », « N° de dossier » | à l'écran : « Retour prévu », « N° de dossier », « Panne » | ⚠️ |
| envoyer | é4 | « Envoyer » | « TEST Perceuse comptoir envoyé chez TEST Réparateur » | ✅ |
| retour | é1-é3 | « Revenu », « Revenu le », coût, « Remarque », « Remettre en service » | identique → « TEST Perceuse comptoir de retour » | ✅ |
| retour | problème | « Annuler l'envoi » | dans le volet « Revenu », pas sur la ligne | ✅ |
| garanties | é1-é2 | onglets « Garanties », « Batteries » | présents | ✅ |

### Pertes et casse (`pertes`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| déclarer | é2 | « Article », « Type d'incident », « Emprunt concerné », « Personne responsable » | le type est un choix « Perte / Vol / Casse » **sans libellé** ; « Emprunt concerné » n'apparaît qu'après le choix d'un article emprunté | ✅ |
| déclarer | é4 | « Enregistrer » | le bouton s'appelle **« Déclarer »** → « Casse déclarée » | ⚠️ |
| déclarer | — | — | la liste « Article » propose encore « TEST Chariot aide », pourtant rendu au loueur | ⚠️ |
| décider | é1-é3 | « Décider », « Suite à donner », choix, « Remarque », « Enregistrer » | volet « Suite à donner », liste « Décision » (6 choix identiques), « Coût retenu (CHF) » → « Décision enregistrée » | ✅ |

### Consommables (`consommables`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer (Magasinier) | é2-é4 | « Nom », « Unité », « Fournisseur », « Référence fournisseur », « Dépôt », **« Stock initial »**, seuil, « Créer » | « Quantité en stock » au lieu de « Stock initial » ; « Prix d'achat unitaire (CHF) » et « Remplir depuis le catalogue » non cités → « TEST Gants aide ajouté » | ⚠️ |
| sortir | é2-é4 | « Sortir », volet « Sortie de consommable », « Dépôt », « Quantité », « Pour qui », « Chantier ou service », « Note (facultatif) », « Enregistrer » | identique → « Sortie enregistrée : 2 paire » ; « Pour qui » propose des personnes inactives (E16) | ✅ |
| réception | é2 | quantité « et le prix si demandé » | volet « Réception de stock » **sans prix** (Dépôt, Quantité, Note) | ⚠️ |
| corriger | é1-é2 | « Inventaire », quantité, « Enregistrer » → « Inventaire enregistré » | identique (« Quantité comptée (paire) ») | ✅ |
| transfert | é1-é2 | « Transfert », « Depuis le dépôt », « Vers le dépôt » | bouton « Transfert » (sur écran étroit, icône « Transférer entre dépôts »), volet « Transfert entre dépôts » | ✅ |
| seuil | é1-é2 | « Seuil minimum », « Seuils proposés », « Appliquer » | identique (« Appliquer » par ligne, « Tout appliquer (n) ») → « Seuil enregistré » | ✅ |
| dépôts | é2 | « Nouveau dépôt », « Ajouter », « Définir par défaut » | identique (+ « Adresse (facultatif) ») → « Dépôt « TEST Dépôt aide » ajouté » ; **aucun moyen de renommer un dépôt**, alors que la tâche s'appelle « Créer ou renommer un dépôt » | ⚠️ |
| dépôts | problème 1 | « Un dépôt porte déjà ce nom » | identique | ✅ |

### Commandes fournisseurs (`commandes`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer | é1-é2 | « Feuille de commande », quantités « À commander » | identique (page `/commande`) | ✅ |
| créer | é3 + résultat | « Créer les bons de commande » → un bon par fournisseur en « Brouillon » | article sans fournisseur : rien n'est créé, message trompeur (E7) | ❌ |
| envoyer, recevoir | — | — | non exécutés : faute de bon créé ; l'envoi par e-mail partirait réellement chez un fournisseur | ⏭ |

### Véhicules (`vehicules`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| ajouter (Admin) | é2-é4 | « Nom », « Plaque », « Dépôt », « Permis », « Places », « Kilométrage actuel », échéances, « Enregistrer » | identique (+ « Prochain service (km) », « Remarques »). Le Magasinier n'a pas le bouton, ce qui est cohérent avec « qui ». | ✅ |
| réserver | é3-é4 | onglet « Véhicule », « + », « Envoyer la demande » | identique ; la phrase « Une demande avec véhicule est toujours validée par un responsable. » manque dans l'aide | ⚠️ |
| départ (Magasinier) | é1-é2 | « Sortir : état des lieux », kilométrage, carburant | « Kilométrage (dernier relevé : 12 000 km) », carburant de 1/8 à Plein | ✅ |
| départ | é3 | dégâts + au moins une photo | « Dégâts constatés (facultatif) », « Photos du véhicule au départ (au moins une : chaque côté si possible) » | ✅ |
| départ | é4-é5 | « Signature du conducteur », « Valider la sortie » | voir E2 → « Demande DEM2610-0007 sortie » | ⚠️ |
| retour | é1-é3 | « Retour », « Photos au départ : comparez avec l'état actuel », « Kilométrage au retour » | identique (+ « Départ : 12 050 km, carburant 8/8 · conducteur … ») | ✅ |
| retour | é3-é4 | nouveaux dégâts avec photo, « Valider le retour » | voir E1 → « TEST Utilitaire 2 rendu · 70 km parcourus » | ❌ |
| carnet | é1-é3 | « Carnet de bord », « Trajets », « Consommation moyenne », « Carburant ce mois », « Ajouter un plein », « Date », « Kilométrage », « Litres », « Ticket », « Enregistrer » | identique ; « Montant (CHF) » et « Plein complet (sert au calcul de la consommation) » ne sont pas cités | ✅ |

### Locations (`locations`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| (où) | — | Véhicules › Locations | Chantiers › Locations (E12) | ❌ |
| créer | é2 | « Véhicule », « Outil ou engin », « Autre » | « Autre (coût seulement) » | ✅ |
| créer | é3-é5 | description, « Loueur », « N° de contrat », « Plaque » / « Quantité », « Permis nécessaire » / « Permis machine exigé », « Début », « À rendre le », prix, « Chantier », « Coût prévu » | identique ; la description s'appelle « Matériel » (outil) ou « Véhicule » ; « Prix par jour (CHF, par unité) », « Forfait », « Responsable (reçoit le rappel) », « Dépôt (pour les alertes) », « Contrat (photo ou PDF) » non cités ; « Coût prévu : 400 CHF » | ✅ |
| créer | résultat | « Réception à faire chez le loueur » | identique | ✅ |
| créer | problème 1 | « La date de retour précède le début de la location » | voir E11 | ❌ |
| réception | é2-é7 | « Relevés », « Photos », « Dégâts déjà présents », « Ajouter un dégât », « Accessoires remis », « Signatures », « Enregistrer la réception » | identique (« Compteur d'heures (si l'engin en a un) », « Vue d'ensemble * », « Plaque signalétique * ») ; sans photo → « Photos manquantes : Vue d'ensemble, Plaque signalétique » (message non cité) | ✅ |
| réception | problème 1 | « Signature de notre collaborateur manquante » | identique | ✅ |
| réception | résultat | « Dans le stock » avec « Loué jusqu'au … » | « TEST Chariot aide : réception enregistrée, l'outil est dans le stock » ; dans Outils : « Loué jusqu'au 13.11 » | ✅ |
| prolonger | é1 | « + 7 jours » | « Prolongée jusqu'au 13.11.2026 » | ✅ |
| restitution | é3-é4 | « Nouveaux dégâts », « Enregistrer la restitution » | identique (« Notés à la réception : aucun dégât. ») → « restitution enregistrée, location clôturée » | ✅ |
| restitution | é5 + résultat | « PV réception et restitution » ; « Rendu » | identique, mais la location **passe dans l'onglet « Historique »** (« Rendu le 30.10.2026 »), ce que l'aide ne dit pas ; avant restitution, le bouton s'appelle « PV de réception » | ⚠️ |

### Exemple : louer un chariot télescopique (`location-engin`)
| Étape | Attendu | Constaté | |
|---|---|---|---|
| é1-é6 | même parcours que Locations (type « Outil ou engin ») | vérifié par la location « TEST Chariot aide » (permis « Chariot élévateur télescopique ») | ✅ |
| é7 | « Nouvelle demande », onglet « Outils », chercher « Manitou » | « Manitou » n'est qu'un exemple. Une location « Manitou MT 625 » existe déjà en base, en type « Coût seulement », donc absente du stock. | ✅ |
| problème 2 | « Formations et permis » | le menu dit **« Permis et formations »** et la page s'intitule « Formations et permis machines » | ⚠️ |

### Chantiers (`chantiers`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| créer | é2-é4 | « Nom du chantier », « Client », « Responsable », « Adresse », « Début », « Fin prévue », budget, « Enregistrer » | identique (+ « Depuis l'adresse », « Ma position (sur place) », « Remarques ») | ✅ |
| créer | résultat + problèmes 1-2 | 3 messages | identiques | ✅ |
| suivre | é1 | « Part du budget dépensée », « Dépensé », « budget dépassé » | barre avec le libellé d'accessibilité « Part du budget dépensée », « Dépensé 0 CHF / budget 1 000 CHF » | ✅ |
| suivre | é2 | « Déplie la carte » | rien à déplier : tout est déjà affiché sur la carte | ⚠️ |
| rapport, copier | é1 | « Rapport PDF », « Préparer un chantier semblable » | présents (impression non lancée) | ✅ |
| clôturer | é1-é2 + résultat | « Clôturer », « Clôturés », « Rouvrir » | « Chantier clôturé : plus aucune sortie possible », puis « Chantier rouvert » | ✅ |

### Carte (`carte`) et Planning (`planning`)
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| carte › lire | é3 + problème | « Chantiers clôturés aussi », « Pas encore sur la carte », « Ma position » | présents | ✅ |
| planning › lire | é1-é2 | « Semaine précédente » / « Semaine suivante » / « Aujourd'hui », « Outils » / « Véhicules », filtre par chantier | identique (flèches nommées « Semaine précédente » et « Semaine suivante », « Filtrer par chantier », « Conflits seulement ») | ✅ |

### Personnes (`personnes`) — Responsable
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| ajouter | é2 | « Prénom », « Nom », e-mail, « Téléphone », « Service » | identique (« E-mail (sert à se connecter) ») | ✅ |
| ajouter | é3 | 4 rôles, dont Administrateur | le Responsable ne voit que 3 rôles, sans « Administrateur ». Bloc « Droits » (6 cases) non cité. | ⚠️ |
| ajouter | é4 | « Dépôts » (aucun coché = tous) | avec un seul dépôt : une case « Tous les dépôts » | ✅ |
| ajouter | é5 | « coche seulement la catégorie la plus haute » | voir E14 | ❌ |
| ajouter | résultat | « Jamais connecté » | affiché pour un collaborateur ; **pas affiché** sur la fiche d'un intérimaire, remplacé par « Intérimaire (agence) · caution · jusqu'au » | ⚠️ |
| intérimaire | é1-é3 | « Type », « Entreprise », date de fin d'accès, caution, « Versée le » | identique : « Accès jusqu'au » devient obligatoire (« Ce champ est obligatoire. »), « Caution (CHF, facultatif) », « Versée le », « Rendue le » → « TEST ajouté(e) : connexion possible avec … » | ✅ |
| badge | é1-é2 | icône QR ; « Imprimer les badges », « Tout cocher » | « QR code » ; « IMPRIMER LES BADGES » est un lien vers /badges (« Imprimer », « Tout cocher », « Tout décocher ») | ✅ |
| bloquer | é1 | « Accès actif », « Enregistrer » | présent | ✅ |
| départ | é1-é4 | « Départ », « Rendu », « Imprimer la liste », « Date de départ », « Caution rendue », « Tout est réglé : le départ peut être clôturé », « Clôturer le départ » | identique → « … départ enregistré, accès et badge désactivés » et « Caution de 200.00 CHF rendue … » | ✅ |

### Mon badge (`badge`) — Collaborateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| présenter | é1-é2 | QR à montrer | identique | ✅ |
| perdu | é1-é2 + résultat | « Badge perdu : nouveau code », « Imprimer ma carte », « Nouveau badge créé » | identique ; confirmation « Créer un nouveau badge ? L'ancien (…) ne fonctionnera plus. » | ✅ |
| notifications | é1-é2 | « Installer GO-Mat sur ce téléphone », activer les notifications | aucun bouton. L'écran dit « Notifications sur le téléphone : pas encore activées par l'administrateur. » Le prérequis côté administrateur n'est pas expliqué. | ⚠️ |

### Permis et formations (`permis`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| ajouter-personne | é1 | « Formations et permis machines » | titre de page identique ; le menu dit « Permis et formations » | ✅ |
| ajouter-personne | é2-é4 | « Ajouter une personne », « Personne », « Obtenue le », « Valable jusqu'au » (vide si sans échéance), « Attestation », « Enregistrer » | identique ; « Valable jusqu'au » est **calculé automatiquement** d'après la validité de la formation (30.10.2028). La personne est ajoutée **sans aucun message de confirmation**. | ⚠️ |
| ajouter-personne | problème 1 | « Cette personne a déjà cette formation… » | inatteignable : la personne déjà titulaire est retirée de la liste. Sur la ligne : « Modifier pour … » et « Retirer à … ». | ⚠️ |
| nouveau | é1-é2 | « Nouveau permis ou formation », « Type », « Nom », « Enregistrer » | identique (+ « Validité (mois) », « Remarque ») | ✅ |

### EPI (`epi`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| remettre | é1 | cliquer « Remettre un EPI » | c'est un **titre de section** : le formulaire est déjà affiché. Sans type d'EPI : « Créez d'abord les types d'EPI (à droite). » | ⚠️ |
| remettre | é2-é4 | « Personne », type, « Taille », « Quantité », « Pris dans le stock de », signature, « Remettre » | « Taille » n'apparaît qu'une fois le type choisi ; « Pris dans le stock de » est absent si le type ne décompte pas le stock ; signature « Signature de … (facultatif) » → « TEST Gilet aide remis à TEST Badge Comptoir » | ⚠️ |
| remettre | problème 1 | « Choisissez la taille » | bloqué sans ce message (E10) | ❌ |
| types | é1-é2 | « Ajouter », nom, durée de vie, à rendre au départ, « Enregistrer » | volet « Nouveau type d'EPI » : « Nom », « Tailles (séparées par des virgules) », « Renouvellement (mois) », « Décompter du stock (facultatif) », « À rendre au départ… » | ✅ |
| renouveler | é1 | « Renouveler » | liste « À renouveler dans les 30 jours » présente ; aucun EPI TEST n'arrive à échéance | ⏭ |

### Pilotage, Recherche, Coûts, Journal
| Article › tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| pilotage › lire | é2-é4 | « Retours en retard », « Jamais sortis depuis 90 jours », « Valeur du stock » | présents | ✅ |
| pilotage › lire | é5 | « Détail et export → » sur chaque carte | **une seule carte** l'a (Coûts par chantier) | ⚠️ |
| recherche › chercher | é2-é3 | « Question », exemples, « Chercher » | identique ; exemples affichés : « qui a la meule 230 ? », « où est le laser », « chantier Renens »… ; « qui a TEST Article suppression ? » → « Chez TEST Rôle Collaborateur … déposé dans la boîte » | ✅ |
| coûts › coûts | é1-é3 | « Mois », tableau « Par chantier », « Détail », « Exporter Excel » | identique ; ligne fantôme (E8) | ❌ |
| coûts › coûts | problème | « Certains consommables n'ont pas de prix d'achat » | message affiché ici : « Certains outils n'ont pas de tarif interne par jour (…). Ils comptent pour 0. » ; celui de l'aide n'a pas été vu | ⚠️ |
| coûts › compta (Admin) | é1-é3 | « Année », « Comptes de l'export », « Enregistrer les comptes », « Export Excel », « Fichier Abacus », « Envoyer dans bexio » | identique ; problème « Aucun outil avec un prix d'achat » identique. Le compte « Outillage, machines (crédit) » apparaît deux fois. | ✅ |
| journal › chercher | é2-é3 | filtre « Type », « Tout le monde », « Plus ancien » | le filtre de type n'a pas de libellé (« Tout » par défaut) ; « Tout le monde », « Plus ancien » présents | ✅ |

### Paramètres (`parametres`) et Santé des données (`sante-donnees`) — Administrateur
| Tâche | Étape | Attendu | Constaté | |
|---|---|---|---|---|
| système | é2 | « Entreprise », **« URL du logo de l'entreprise »**, « Série de numérotation des articles », « Sauver » | « Logo de l'entreprise (URL) » ; « Signature à la remise à partir de (CHF) » non cité | ⚠️ |
| système | é3 | « Seuil de validation des demandes » | présent | ✅ |
| alertes | é2-é5 | « Nom », « E-mail », « Dépôt », « Alertes reçues », « Ajouter le destinataire », « Tester » | identique ; sans alerte cochée → « Choisissez au moins un type d'alerte ». Aucun destinataire réel ajouté, pour ne pas envoyer d'e-mail. | ✅ |
| listes | é1-é3 | sections, « Ajouter », « Modifier », « Supprimer », « Ajouter sous-groupe » | identique (« Groupes d'équipements », « Ajouter groupe ») | ✅ |
| catalogue | é1-é4 | « Fournisseur », fichier, « Liste des changements », « Importer le catalogue » | section présente ; import non lancé (il toucherait des prix réels) | ⏭ |
| sauvegarde | é2-é3 | « Télécharger la sauvegarde complète », « Restaurer… », « Remettre les lignes manquantes » | les deux premiers sont présents (« Restaurer depuis une sauvegarde ») ; restauration déjà testée dans `rapport-chrome.md`, non refaite | ⏭ |
| outil-trouvé | é1-é2 | « Téléphone », **« Message affiché à qui trouve un outil »**, « Enregistrer » | le champ s'appelle « Message » (section « OUTIL TROUVÉ (PAGE PUBLIQUE) ») | ⚠️ |
| remise à zéro | é2 | « Zone d'administration », « Remettre à zéro le système » | présents, **non exécuté** (action irréversible) | ⏭ |
| santé › corriger | é2 | chaque ligne dit ce qui manque | identique | ✅ |
| santé › corriger | é3 | « Corriger → » | n'apparaît **qu'après avoir déplié la ligne** : il manque l'étape « clique sur la ligne » | ⚠️ |

---

## 3. Captures de l'Aide qui ne correspondent pas

Les 48 captures montrent bien l'interface actuelle, avec des données de démonstration (Marc Dubois, Sarah Perret). Celles-ci posent problème :

| Capture | Étape illustrée | Écart |
|---|---|---|
| `comptoir-1` | comptoir › sortir é1 « vérifie que Auto est sélectionné » | les repères orange 1 et 2 pointent le champ de scan et « choisissez la personne », **pas le bouton « Auto »** |
| `comptoir-2` | comptoir › sortir é5 « Panier, Sortie · nom de l'outil » | les repères pointent « Auto » (1) et « Valider » (2), pas la ligne du panier ; le panier mélange un retour et une sortie |
| `sorties-1` | sorties › voir é1 | liste **vide** (« Aucun bon de sortie trouvé ») : on ne voit ni « Détails / retour » ni retard en rouge ; le champ de recherche est tronqué |
| `emplacements-1` | emplacements › créer é1 | la liste de droite contient des lignes au nom générique « Article · consommable », et « Gants nitrile L » y est classé « outil » : données de démonstration incohérentes |
| `outils-1` | outils › trouver é1 | vue Grille : on ne voit pas les colonnes « Stock total » et « Statut » citées à l'étape 4 |
| `entretien-1` | entretien › plan é1 | page vide (« Rien à faire ») : n'illustre ni un plan ni ses états |
| `location-engin-2` | location-engin é4 « la ligne affiche Réception à faire… et le bouton Réception » | aucune ligne d'engin : le repère 1 montre une location « Coût seulement » (échafaudage) et le repère 2 le bouton Réception d'un **fourgon** |
| `locations-1`, `location-engin-1/2` | article locations | le fil d'Ariane affiche « Chantiers › Locations » alors que l'article dit « Véhicules › Locations » (E12) |
| `chantiers-1` | chantiers › créer é1 « Nouveau chantier » | le repère pointe **« Rapport PDF »**, pas « Nouveau chantier » |
| `carte-1` | carte › lire é1 | **fond de carte absent** (zone grise) ; la pastille rouge n'a pas de chiffre alors que l'aide dit « le chiffre est le matériel encore sur place » |
| `parametres-1` | parametres › système é1 « déplie Paramètres système » | c'est la section « Notifications par e-mail et SMS » qui est dépliée ; « Paramètres système » est replié |
| `pilotage-1` | pilotage › lire | « Valeur du stock : 0 CHF » alors que `comptabilite-1` donne 2 232.82 CHF de valeur d'outils ; « Pertes et casse 2026 : 240 CHF » alors que `pertes-1` montre « 1 · CHF 0,00 » : captures incohérentes entre elles |
| `couts-1` | coûts › coûts é1 « choisis le Mois » | le sélecteur affiche **« October 2026 »** (champ natif en anglais) |
| `journal-1` | journal › chercher é1 | journal vide (« Aucune entrée. ») : n'illustre ni « Création / Modification », ni l'avant → après, ni « Plus ancien » |
| `demarrage-1` | demarrage-admin › parcours é1 | le champ fichier natif affiche « Choose File / No file chosen » en anglais |
| `badge-1` | badge (et la tâche « notifications ») | la capture montre « Notifications sur le téléphone : pas encore activées par l'administrateur. », ce qui contredit la tâche « Recevoir les notifications » |
| `epi-1` | epi › remettre é1 « clique sur Remettre un EPI » | « Remettre un EPI » est un titre de section ; pas de champ « Taille » ni de signature visibles |

Les 29 autres captures correspondent aux écrans réels : connexion-1/2, accueil-magasinier, accueil-collaborateur, demandes-1/2/3, scanner-1, libre-service-1, transferts-1, inventaire-1, ecran-tv-1, outils-2, kits-1, etiquettes-1, atelier-1, pertes-1, consommables-1/2, commande-1, vehicules-1/2, locations-2, planning-1, personnes-1/2, permis-1, comptabilite-1, donnees-1. (`locations-1` et `location-engin-1` sont justes, à part le fil d'Ariane signalé plus haut.)

---

## 4. Libellés de l'Aide introuvables dans le code (contrôle automatique)

Sur 706 libellés cités, 12 n'existent nulle part dans le code. Ce sont surtout des exemples ou des gabarits :

| Article › tâche › étape | Libellé de l'aide | Réalité |
|---|---|---|
| connexion › installer › é3 | « Ajouter à l'écran d'accueil » | libellé du navigateur : normal |
| demarrage-admin › parcours › é1 | « x / y faites » | gabarit : « 3 / 9 faites » ✅ |
| comptoir › sortir › é5 | « Sortie · nom de l'outil » | gabarit ✅ |
| comptoir › rendre › résultat | « x retour(s) » | « *Nom* : 1 retour (dont 1 en maintenance) » |
| comptoir › kit › problème 1 | « Kit … incomplet » | « Kit « *nom* » incomplet : … » ✅ |
| demandes › créer › é6 | « 3 disponibles sur la période » | « 0 disponible sur la période » ✅ |
| demandes › préparer › é1, é3 | « 0 / x préparé(s) », « x exemplaire(s) scanné(s) » | gabarits ✅ |
| outils › ajouter › résultat | « Imprimer les étiquettes QR » | titre d'un article de l'aide (renvoi), pas un bouton |
| location-engin › exemple › é7 | « Manitou » | exemple |
| recherche › chercher › é2 | « qui a la perceuse ? », « matériel sur le chantier Gare » | exemples ; l'écran propose d'autres exemples (« qui a la meule 230 ? », « chantier Renens »…) |

---

## 5. Données de test laissées en base

Toutes sont préfixées « TEST » :

- **Outils, kit et consommable** : outil « TEST Aide perceuse » (créé puis supprimé), kit « TEST Kit aide », consommable « TEST Gants aide » (libre-service activé, seuil 10, 2 paires au « TEST Dépôt aide »).
- **Lieux** : dépôt « TEST Dépôt aide », emplacement « TEST-01 », chantier « TEST Chantier aide ».
- **Flux** : transfert TRF2610-0001, location « TEST Chariot aide » (rendue), plan d'entretien « TEST Révision aide », incident « Casse · TEST Perceuse comptoir » (décision : Retrouvé), réparation chez « TEST Réparateur » (revenue).
- **Personnes** : intérimaire « TEST Aide Intérim » (départ clôturé), type d'EPI « TEST Gilet aide » remis à TEST Badge Comptoir, formation « TEST Travail en hauteur » donnée à TEST Badge Comptoir.
- **Demandes** : DEM2610-0007 et DEM2610-0008 sorties ; DEM2610-0010 annulée ; panier « TEST Panier aide ».
- **Badges et dépôts** : le badge de TEST Rôle Collaborateur a été régénéré ; « TEST Article suppression » a été déposé, contrôlé, puis rendu.

Aucune donnée réelle (sans préfixe TEST) n'a été modifiée. L'inventaire resté ouvert depuis 16:18 a été clôturé avec des comptages égaux aux quantités attendues : il n'y a aucun écart et le stock est inchangé.
