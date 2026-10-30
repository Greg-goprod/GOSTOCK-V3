# GO-Mat — Backlog

Travaux commencés mais pas terminés, et dettes connues. Mis à jour le 30.10.2026.

## En cours (non terminé)

### Notifications par e-mail — ✅ en service depuis le 30.10

**Choix du 30.10 :** relais SMTP propre à GO-Mat sur Fly.io (`smtp-relay/`, copie isolée de celui de Mannyx avec
sa propre clé, limité à `mail.infomaniak.com` et au domaine d'expédition), compte d'envoi Infomaniak dédié
(`noreply@…`). Codes de connexion : même compte saisi dans Supabase → Authentication → SMTP Settings.
Planification : `docs/sql/planification-envoi.sql` (appliquée sur GO-MAT le 30.10).
Essais réussis le 30.10 : e-mail de test (bouton « Tester ») et code de connexion (8 chiffres), expéditeur
« Mannyx <noreply@gc-entertainment.ch> ». Le texte des alertes dit encore « GO-Mat » (à adapter à l'intégration Mannyx).
Reste : notifications téléphone (clés VAPID) et SMS (Twilio) si souhaités ; redéployer `send-notification-emails`
pour que la sauvegarde mensuelle inclue `rental_inspections`.

Fait :
- Destinataires par type d'alerte et par dépôt (Paramètres → Notifications par e-mail)
- Fonction Edge `send-notification-emails` déployée sur GO-MAT (relais SMTP Mannyx `go-prod-smtp-relay.fly.dev`)
- Migration `20261029000007_notifications_email.sql` (file d'envoi, réservation sans double envoi, 3 essais)

Reste à faire :
1. *(Facultatif depuis le 29.10)* Appliquer sur GO-MAT la signature `mark_notification_email(uuid, text, boolean)` :
   le `DROP FUNCTION mark_notification_email(uuid, text)` attend une confirmation dans Supabase. La fonction
   Edge sait désormais utiliser l'ancienne signature ; la nouvelle évite seulement un renvoi en double quand
   un destinataire sur plusieurs échoue.
2. **Secrets de la fonction Edge** (saisis par le propriétaire dans Supabase, jamais dans le code) :
   `SMTP_RELAY_API_KEY` (= `API_SECRET_KEY` du relais Fly.io, même valeur que dans Mannyx),
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` ;
   facultatifs `SMTP_FROM_NAME`, `APP_URL`.
3. **Planification pg_cron** toutes les 5 minutes (SQL en fin de migration 00007). Le même passage crée
   les relances de retour, les échéances d'entretien et le rapport mensuel.
4. Essai réel avec le bouton « Tester », puis une vraie alerte de stock bas.

### Connexion — réglages Supabase à faire par le propriétaire

La connexion (e-mail + code) et les rôles sont en place (migrations 00008 et 00009 appliquées sur GO-MAT).
À régler dans le tableau de bord Supabase (Authentication), sans quoi l'envoi des codes reste limité :
1. **URL Configuration** : Site URL = adresse de l'app (en local `http://localhost:5174`), et l'ajouter
   aux Redirect URLs (le lien de l'e-mail y renvoie).
2. **Email Templates → Magic Link** : ajouter `{{ .Token }}` pour que l'e-mail affiche le code à 6 chiffres
   (sans cela, seul le lien fonctionne).
3. **SMTP Settings** : le serveur d'envoi par défaut de Supabase n'écrit qu'aux membres de l'équipe du
   projet et quelques fois par heure. Saisir le compte SMTP (le même que pour les alertes) avant
   d'inviter les collaborateurs.

Conseiller de sécurité : les avertissements « SECURITY DEFINER exécutable par authenticated » restants
sont voulus (whoami, fonctions app_* utilisées par les règles RLS, create_request, disponibilités,
recalculs) ; les fonctions de déclencheurs ne sont plus appelables directement.

## Ajouts du 29.10 (lots 1 à 6) — points d'attention

- Photos et PV dans le compartiment privé Supabase Storage « fichiers » (10 Mo par fichier).
- Les permis ne sont renseignés pour personne : **toute réservation de véhicule est refusée** tant que
  le permis du demandeur n'est pas saisi dans « Personnes ».
- Les contrôles OIBT « bloquants » refusent la sortie d'un outil dès l'échéance.
- Avis personnels (demande validée / refusée / prête, à rendre demain, en retard) : visibles dans
  « Mes demandes » ; envoyés par e-mail à la personne dès que l'envoi est configuré.
- Appli installable (PWA) : le service worker n'est actif qu'en production (`npm run build`), pas avec
  `npm run dev`.
- Conseiller de sécurité : 39 avertissements « SECURITY DEFINER » voulus depuis le lot 7 (chaque fonction vérifie les
  droits elle-même).

## Ajouts du 30.10 (lot 7) — points d'attention

- **Chantiers** : une sortie est rattachée à la fiche chantier par son nom (texte « Chantier ou service »).
  Créer la fiche après coup rattache l'historique portant ce nom. Un chantier clôturé refuse les nouvelles
  sorties (les retours restent possibles).
- **Formations** : dès qu'un outil a une « Formation obligatoire », il ne sort plus (comptoir, bon, demande)
  pour une personne sans formation valable jusqu'à la date de retour. Saisir les attestations **avant**
  d'activer l'exigence sur les outils.
- **Kits** : seuls les outils (pas les consommables). Au retour d'un kit, ce qui est retiré du panier reste
  au nom de la personne.
- **Comptoir hors ligne** : la copie locale (personnes, codes des badges, articles, emprunts en cours) est
  gardée dans le navigateur de l'appareil du comptoir. Hors ligne, pas de photo au retour ni de recherche par
  code EAN. Si le réseau coupe juste après l'enregistrement d'une sortie mais avant la réponse, la sortie
  peut être renvoyée en double (outil sans exemplaire numéroté) : à vérifier dans « Sorties ».
- Nouvelles alertes à cocher pour les destinataires e-mail : « Locations à rendre / en retard »,
  « Formations à renouveler ».

## Ajouts du 30.10 (lots 8 à 13) — points d'attention

- **Notifications sur le téléphone (Web Push)** — à activer par le propriétaire :
  1. Générer une paire de clés : `npx web-push generate-vapid-keys` (sur son PC).
  2. Supabase → Edge Functions → Secrets : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
     `VAPID_SUBJECT` (ex. `mailto:magasin@entreprise.ch`).
  3. `.env` de l'application (et Netlify) : `VITE_VAPID_PUBLIC_KEY` = la clé **publique**.
  4. Planifier la fonction `send-notification-emails` (pg_cron, SQL en fin de migration 00007) : elle
     envoie désormais les notifications même sans SMTP, et crée les échéances (EPI, garanties, batteries…).
  Sur iPhone, il faut d'abord installer GO-Mat sur l'écran d'accueil (iOS 16.4+).
- **Intérimaires** : après la date « accès jusqu'au », plus de connexion, de badge ni d'emprunt.
- **Signature à la remise** : seuil par défaut 500 CHF (Paramètres) ; un outil peut aussi l'exiger.
- **Transferts** : un outil en route ne peut pas sortir ; il n'est rattaché au dépôt d'arrivée qu'à la
  réception au scanner.
- **Libre-service** : seuls les consommables cochés (Consommables → Libre-service) ; la règle « seul le
  magasin scanne » reste vraie pour tout le reste.
- **Outil trouvé** : la page publique `/t/<code>` ne montre que le nom de l'entreprise, le téléphone et le
  message (Paramètres → Outil trouvé). Les étiquettes « outil trouvé » contiennent un lien ; le scanner
  du magasin les lit normalement.
- **Sauvegarde** : fichier JSON de toutes les tables, sans les photos (restent dans le stockage) ni les codes
  de badge. Automatique chaque mois (fonction d'envoi) dans le stockage privé « backups », 12 gardées.
  Restauration (Paramètres → Sauvegarde) : remet seulement les lignes absentes, n'écrase ni ne supprime
  rien. Une ligne refusée par une règle (ex. sortie vers un chantier clôturé) est signalée, pas forcée.
- **Export comptable** : comptes du plan PME suisse par défaut, à faire confirmer par la fiduciaire.
  Excel, fichier Abacus (`Datum;Beleg;Soll;Haben;Betrag;Text;KST`, UTF-8 ; le modèle d'import est à
  régler une fois dans Abacus) et envoi direct dans bexio (fonction `bexio-export`, secret
  `BEXIO_API_TOKEN`). L'API bexio n'a pas encore été essayée avec un vrai compte.
- **Caution** : montant, versée le, rendue le sur la fiche personne ; rappelée au départ.
- **SMS** : rappels personnels (retour demain, retard, demande prête) via Twilio (secrets
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) + réglage « SMS » dans Paramètres.
- **Carte** (`/carte`) : chantiers placés depuis l'adresse (OpenStreetMap/Nominatim) ou la position du
  téléphone ; pastille = matériel encore sur place. Les outils eux-mêmes n'ont pas de GPS.
- **Mise à jour du catalogue** : un nouveau fichier Makita (JSON) ou une liste de prix Excel est comparé
  avant import ; les produits absents du fichier ne sont pas supprimés.
- **Langues (FR/DE/IT/EN)** : traduction de l'écran à la volée (`src/i18n/translator.ts`) d'après les
  dictionnaires `src/i18n/{de,it,en}.json` (texte français → traduction, `{0}` pour les parties variables).
  Langue choisie dans le menu du profil, la page de connexion ou Paramètres, gardée sur l'appareil.
  Restent en français : messages générés par la base (notifications, e-mails, erreurs SQL), PDF/Excel
  exportés, et toute phrase ajoutée au code sans entrée dans les dictionnaires (à compléter à chaque ajout).
  Les données (noms d'articles, chantiers, personnes) ne sont jamais traduites.

## Charte Mannyx (MX) — 30.10

- Tokens `--mx-*` (src/styles/tokens-mx.css, repris de Mannyx) et police Geist (public/fonts).
  Les classes Tailwind gray/primary lisent des variables qui changent avec le thème
  (src/styles/gomat-mx.css) ; thème clair par défaut.
- Composants MX repris dans src/components/mx (drawer, sélecteurs date/heure, menus…).
  Toutes les fenêtres (`Modal`) s'ouvrent en drawer ; confirmations et saisies du navigateur
  remplacées par `confirmAction` / `promptAction` (src/lib/confirm.ts).
- Dates et heures : `DateInput`, `DateTimeInput`, `TimeInput` (même interface qu'un champ natif).
- Navigation : rail de 5 espaces + liste de l'espace (src/lib/navigation.ts), barre du bas sur
  téléphone, recherche rapide Ctrl+K.
- Reste à faire : tableaux et cartes au format exact du catalogue MX page par page.

## Rapport de tests Chrome (30.10) — corrections

Migration `20261030000024_corrections_tests_chrome.sql` appliquée sur GO-MAT.
- Corrigés : P10 (exemplaire attaché à chaque sortie, sorties existantes réparées), P9 (restauration sans
  doublon ni déclencheur), P8 (préparation enregistrée en base), P12 (caution comptée dans le solde de
  départ), P1 (QR de badge = vrai code), P2 (badge d'une personne créée dans la session), P13 (personnes
  parties exclues de « Pour qui »), P6 (outil avec historique : retrait du service au lieu de supprimer),
  P14 (boutons toujours visibles), P11 (« Ce champ est obligatoire » sous les dates), P17 (jours hors mois
  estompés), P15 (bulle de la carte), P4 (création annulée si les exemplaires échouent), P3 (plus de 401
  au démarrage), P16 (motif de l'erreur de scan), P18 (avertissement si le chantier n'a pas de fiche).
- **P7** (retour d'un kit par scan) : non reproduit — en base, le retour d'un kit fonctionne. À rejouer.
- Données « TEST » des essais laissées en base (à supprimer sur demande).

## Locations dans le stock et états des lieux (lot 16, 30.10)

- Migration `20261030000025_locations_etats_des_lieux.sql` : **à appliquer sur GO-MAT** (en attente de
  confirmation dans Supabase).
- Une location a un type : véhicule, outil / engin, ou « autre » (coût seulement, comme avant ; les
  locations existantes restent « autre »).
- Réception chez le loueur : état des lieux (vues photo obligatoires, km / carburant ou compteur d'heures,
  dégâts déjà présents, accessoires, signatures) ; l'objet entre alors dans la flotte ou le matériel, avec la
  pastille « Loué jusqu'au … ». Réservable et sortable seulement jusqu'à la fin du contrat (contrôlé en base).
- Restitution : refusée tant que l'objet est sorti, en route ou prévu dans une demande ouverte ; l'objet est
  ensuite retiré du stock (historique gardé) et la location clôturée. PV imprimable (réception seule, ou
  réception et restitution côte à côte).
- Photos dans le stockage privé « fichiers », dossier `etats-des-lieux`.
- Migration `20261030000026_permis_machines_suisse.sql` (**à appliquer aussi**) : permis machines suisses
  (cariste CFST 6518, nacelles IPAF 1a/1b/3a/3b, grutier A/B selon OGrues, grue de chargement, machinistes…)
  rangés dans « Permis et formations » avec le même blocage à la sortie et à la réservation ; un engin loué peut
  exiger un permis machine. Permis de conduire : toutes les catégories suisses, avec les équivalences
  (B → B1/F/G/M, CE → C1E/BE, DE → D1E/BE, F → G/M…). Dénominations à faire valider par la sécurité / Suva.

## Dettes techniques

- **Vite 5 → 8** : failles limitées au serveur de développement ; saut majeur (Node ≥ 20.19).
- **ESLint** : 68 `any` explicites (surtout `AppContext.tsx`). Les 11 avertissements de dépendances de hooks
  ont été relus le 29.10 : chargements à l'ouverture, sans donnée périmée ; laissés tels quels.
- **Import Excel** : n'accepte plus que le format `.xlsx` (exceljs ne lit pas l'ancien `.xls`).
- **Renumérotation** : la scie `GOMAT-20261029-0001` garde l'ancien format de numéro.

## À venir

- Multi-organisation (intégration Mannyx) : `organization_id` est présent sur les nouvelles tables, mais
  les règles RLS ne filtrent pas encore par organisation (une seule organisation aujourd'hui).
- Envoi des e-mails de connexion via le relais Mannyx (hook « Send Email » de Supabase Auth), si on ne
  veut pas saisir le SMTP dans Supabase.
