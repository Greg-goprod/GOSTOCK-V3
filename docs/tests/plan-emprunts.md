# Plan : cycle de vie d'un emprunt (`scripts/e2e-emprunts.cjs`)

Le script joue le magasinier, le responsable et le collaborateur sur de vrais outils préfixés **TEST-EMPRUNT**, puis nettoie.

| Groupe | Scénarios |
|---|---|
| **E1 Sortie** | sortie de 2 outils sur 3 ; le collaborateur les voit ; la disponibilité baisse ; trop d'exemplaires, quantité 0 ou négative, consommable, sortie créée par un collaborateur : refusés |
| **E2 Retour** | un collaborateur ne peut pas enregistrer un retour ; état inventé refusé ; retour complet (disponibilité rétablie, bon « rendu ») ; double retour refusé |
| **E3 Retour partiel** | bon de 3 outils, 1 rendu : bon « partiel », 2 encore chez la personne et visibles par elle, disponibilité 1 ; visible dans l'écran Sorties |
| **E4 États au retour** | incomplet (contrôle enregistré) ; à réparer (maintenance, outil impossible à ressortir) ; cassé (incident à décider + maintenance) ; décision du responsable avec coût, collaborateur sans droit |
| **E5 Retard** | sortie échue ; passage en « en retard » ; l'outil reste indisponible (1 sur 2) ; visible dans « qui a quoi » et « Mon matériel » ; la personne peut-elle encore commander ? ; alerte créée ? ; retour tardif |
| **E6 Perte et vol** | perte déclarée (sortie « perdue », incident à décider) ; retour impossible sur une sortie perdue ; double déclaration ; décision « assurance » ; objet retrouvé (sortie rétablie) ; vol ; le collaborateur déclare sa propre perte, pas celle d'un autre ; écran « Pertes et casse » |
| **E7 Prolongation** | le collaborateur ne peut pas repousser la date ; une fonction de prolongation existe-t-elle (aujourd'hui : non) ; modification directe par le magasin ; une réservation à venir bloque-t-elle ? |
| **E8 Via une demande** | demande de 2 outils → prête → sortie → rendu d'un seul : la demande reste « sortie » → rendu du second : clôturée ; un perdu + un rendu : état de la demande |
| **E9 Interface** | « Mon matériel » avec « Signaler » côté collaborateur ; accueil magasin |
