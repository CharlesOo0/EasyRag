# Plan de déploiement Azure (#74) - notes de travail

Document de suivi, pas la doc finale. Une fois le déploiement réel en place,
le chemin qui a vraiment marché sera reporté dans `DEPLOYMENT.md` (voir le
scope de #74) et ce fichier pourra être supprimé ou archivé.

Contrairement aux autres tickets, celui-ci se fait en direct avec l'utilisateur
(création de ressources réelles, argent en jeu) - pas de PR classique tant que
ce n'est pas stabilisé.

## Décisions prises, avec le raisonnement

- **Une seule VM**, pas de services managés Azure (App Service / Container
  Apps + Postgres Flexible Server + Redis managé). Ollama a besoin d'un hôte
  toujours disponible avec beaucoup de RAM - mal adapté au scale-to-zero, et
  les services managés n'éliminent pas le besoin d'une VM pour Ollama, ils
  ajoutent juste des pièces autour. Une VM + `docker compose` est aussi la
  migration la plus directe depuis ce qui est déjà documenté/testé.
- **Redis retiré.** Sa seule utilité dans le code actuel est de partager les
  compteurs de throttle entre plusieurs workers gunicorn - mais l'app tourne
  déjà en `--workers 1` par design (le sémaphore `RAG_MAX_CONCURRENT_CHATS`
  est en mémoire Python, ne marcherait pas avec plusieurs workers). Avec un
  seul process, `LocMemCache` fait exactement le même travail que Redis, sans
  conteneur en plus. À faire : retirer le service `redis` de la config prod
  et ne pas définir `REDIS_URL`.
- **Réveil à la demande plutôt qu'allumage permanent.** Un "gardien" léger
  toujours actif (Azure Container Apps, même brique que le portfolio existant
  - `portfolio-app-rg`) reçoit les requêtes publiques, démarre la VM si elle
  est éteinte, répond une page d'attente le temps du démarrage (~1-3 min : boot
  OS + `docker compose up`, pas juste le rechargement du modèle), et éteint la
  VM après un délai d'inactivité (10-15 min sans requête).
- **VM Spot plutôt que pay-as-you-go**, une fois le pattern "attendre que ça
  démarre" déjà accepté par le produit - une éviction Spot se traite avec la
  même UX d'attente/retry que le réveil normal, sans logique supplémentaire.
  ~82% moins cher que le tarif à la demande.
- **Disque 32 Go (E4 LRS)**, pas 16 Go. Besoin réel estimé ~10-11 Go (image
  backend ~4 Go, modèle Ollama ~2 Go, autres images ~1,5 Go, données Postgres
  < 300 Mo, OS/Docker ~2-3 Go) - 16 Go laisserait trop peu de marge pour le
  cache de build Docker qui s'accumule dans le temps, pour ~1,50 $/mois
  d'écart seulement. Pas d'usage justifiant plus que 32 Go pour l'instant.
- **Domaine propre** (acheté par l'utilisateur) plutôt que le nom Azure par
  défaut - permet un vrai certificat TLS Let's Encrypt.

## Chiffres réels (API de pricing Azure, région France Central, vérifiés le
27/09/2026 - à revérifier si beaucoup de temps passe avant de provisionner)

| Poste | Coût |
|---|---|
| IP publique statique (Standard) | 3,65 $/mois (fixe, VM allumée ou pas) |
| Disque SSD standard 32 Go (E4 LRS) | 2,97 $/mois (fixe) |
| Gardien (Container App consumption) | ~0 $/mois (largement dans le quota gratuit) |
| VM D2s_v5 (2 vCPU/8 Go), à la demande | 0,112 $/h |
| VM D2s_v5 Spot | 0,0207 $/h (si le test de charge confirme que 8 Go suffit) |
| VM D4s_v5 (4 vCPU/16 Go), à la demande | 0,224 $/h |
| VM D4s_v5 Spot | 0,0414 $/h (repli si 8 Go ne suffit pas) |

Plancher fixe si personne ne visite jamais : **~6,6 $/mois**. Scénario réveil
épisodique réaliste (30-40h/mois) : **~10-20 $/mois** selon PAYG/Spot et taille
de VM - tout dépend du trafic réel, jamais mesuré, donc à vérifier une fois en
prod plutôt qu'à prendre pour acquis.

## Budget Azure

- **Fait** : budget "GlobalBudget" créé, 8 €/mois, alertes email à 20/50/80%
  vers didi831313@gmail.com. Vérifié via `az consumption budget list`.
- **À faire** : rattacher une Action Group au budget pour une vraie coupure
  automatique (pas juste un email) si le seuil est dépassé - pas encore fait,
  `contactGroups` est vide sur le budget actuel.
- **À vérifier** : si le compte "Azure for Students" a un plafond de dépense
  intégré par défaut (empêche tout dépassement puisqu'aucune carte n'est
  enregistrée) - pas confirmé avec certitude via CLI, à checker dans le
  portail (Cost Management + Billing -> vue d'ensemble de la souscription).

## Blocage rencontré (27/09/2026) - quota de calcul VM à 0

Tentative de provisionner la VM de test de charge (`easyrag-loadtest-rg`) :
échec systématique, aucune taille de VM testée n'a pu être créée, dans
aucune des 5 régions autorisées par la policy du compte (`francecentral`,
`norwayeast`, `germanywestcentral`, `polandcentral`, `switzerlandnorth`).

- `Standard_D2s_v5` en France Central -> `QuotaExceeded` explicite (limite
  actuelle : 0 coeur pour la famille Dsv5).
- `Standard_B2ms` (France Central, West Europe - hors policy donc refusé
  différemment, Germany West Central, Norway East) -> `SkuNotAvailable /
  Capacity Restrictions` à chaque fois, message générique.
- Même `Standard_B1s` (la plus petite taille possible) échoue pareil en
  France Central.

Conclusion : ce n'est pas une pénurie ponctuelle de capacité datacenter
(improbable que B1s soit en rupture partout) - le compte "Azure for
Students" n'a actuellement **aucun quota de calcul VM accordé**, dans aucune
région autorisée. Rien n'a été facturé (aucune ressource partiellement créée
- vérifié via `az resource list`, groupe de ressources vide supprimé).

**Prochaine étape réelle** : demande d'augmentation de quota via le portail
Azure (Cost Management -> Quotas, ou le lien fourni dans l'erreur :
aka.ms/ProdportalCRP -> Usage + Quotas). À faire par l'utilisateur
directement (formulaire lié à son compte). Pas garanti que ce soit approuvé
rapidement, ou approuvé du tout, sur un compte étudiant gratuit - à voir une
fois la demande soumise.

## Blocage rencontré (27/09/2026, suite) - restriction de capacité générique après upgrade PAYG

Après upgrade réussi de "Azure for Students" vers Pay-As-You-Go (`quotaId`
passé à `PayAsYouGo_2014-09-01`, `spendingLimit: Off`, confirmé via l'API
ARM), et après enregistrement des providers `Microsoft.Compute` /
`Microsoft.Network` / `Microsoft.Storage` / `Microsoft.Quota` (aucun n'était
enregistré, ce qui bloquait aussi les lectures de quota) :

- Le quota (`az vm list-usage`) est bien débloqué à 10 vCPU sur presque
  toutes les familles, dans les 5 régions autorisées par la policy - sauf
  `Standard DSv5 Family` (toujours à 0). Une demande d'augmentation via
  l'API `Microsoft.Quota` a échoué avec `QuotaNotAvailableForResource` :
  cette famille précise est fermée par policy sur ce compte, pas de recours
  en libre-service.
- **Toute tentative de création de VM échoue avec `SkuNotAvailable /
  Capacity Restrictions`**, quelle que soit la taille (`Standard_B2ms`,
  `Standard_D2s_v3`, jusqu'à `Standard_B1s` - la plus petite taille
  possible) et quelle que soit la région parmi les 5 autorisées. B1s
  échouant partout élimine l'hypothèse d'une vraie pénurie de capacité
  datacenter (improbable que B1s soit indisponible dans 5 régions à la
  fois).
  **Correctif important** : cette même erreur sur `Standard_B1s` était déjà
  documentée dans le tout premier blocage (section précédente de ce
  document, testé avant tout changement d'aujourd'hui) - ce n'est donc PAS
  causé par l'upgrade PAYG ni par l'enregistrement des providers. La
  restriction préexiste, indépendante du type de souscription. Cause encore
  inconnue (compte, tenant de facturation UTBM, pays associé ?) - hypothèse
  "retenue anti-fraude post-upgrade" écartée, contredite par les faits.
- Aucune ressource facturable créée par ces tentatives (échecs en
  pré-validation ARM, avant provisioning du disque/NIC/IP) - `az resource
  list` sur `easyrag-loadtest-rg` est vide. Groupe de ressources vide laissé
  en place pour la prochaine tentative.

**Deux souscriptions actives découvertes sur le compte** (à garder en tête,
source de confusion sinon) :
- `Azure for Students` (`8ac0a59e-...`) : celle utilisée ci-dessus, bien en
  PAYG maintenant.
- `Azure subscription 1` (`6df093a4-...`) : souscription **distincte**,
  créée séparément pendant la même démarche d'upgrade, quotaId
  `FreeTrial_2014-09-01`, et actuellement **`ReadOnlyDisabledSubscription`**
  (désactivée en écriture côté ARM malgré un état "Actif" affiché dans le
  portail) - inutilisable en l'état, cause non identifiée.

**Comparaison DigitalOcean écartée** : tarif proche (48 $/mois pour l'équi-
valent 4 vCPU/8 Go), mais modèle de facturation incompatible avec le pattern
réveil/extinction du plan - chez DO un droplet éteint reste facturé en
entier, seule la destruction complète arrête la facturation. Azure reste la
bonne cible malgré les blocages actuels.

**Prochaine étape réelle** : contacter le support Azure (portail -> Aide +
support -> nouvelle demande, catégorie facturation/abonnement) au sujet de
la restriction de capacité générique - présente sur le compte depuis avant
l'upgrade, donc pas liée au changement de plan - et vérifier en parallèle
pourquoi `Azure subscription 1` est désactivée. Rien d'autre ne peut avancer
côté provisioning tant que l'un des deux n'est pas résolu.

## Test de charge réel (27-28/09/2026) - résultat

Réalisé sur `Standard_D2ps_v6` (2 vCPU/8 Go, ARM64, Spot, France Central) -
le blocage de capacité générique documenté plus haut n'affectait pas cette
taille précise, testée avec succès via le portail par l'utilisateur puis
reproduite en CLI. Stack déployée sans Redis (LocMemCache, conforme à la
décision plus haut) ni frontend (hors scope du test). Base de données
pré-vectorisée transférée depuis le poste local (`pg_dump`/`pg_restore`,
6333 chunks) pour éviter de refaire l'ingestion sur la VM - `ingest_corpus`
confirmé idempotent (`0 created, 0 updated, 195 unchanged`).

- **RAM : non-problème.** Pic mesuré sous charge (4 requêtes simultanées) :
  ~4,5 Go / 7,7 Go utilisés (Ollama ~3,1 Go, backend ~0,77 Go, Postgres
  ~80 Mo). Grosse marge, aucun swap. 8 Go est confortable, presque
  surdimensionné côté mémoire seule.
- **CPU : le vrai facteur limitant, pas anticipé comme tel.** Sur 4
  requêtes vraiment simultanées, Ollama a saturé les 2 vCPU en continu
  (~200%) et **2 des 4 requêtes ont dépassé le timeout de lecture de 120s**
  côté backend (`OllamaError: Read timed out`) - échec net, pas juste un
  ralentissement. Une requête seule répond correctement en ~3,7s (~6-7
  tokens/s de génération, CPU pur).
- **Décision appliquée** : `RAG_MAX_CONCURRENT_CHATS` baissé de 4 à 2
  (`core/settings.py`, `.env.example`) pour matcher la capacité réelle
  mesurée sur 2 vCPU, plutôt que de laisser des requêtes échouer
  silencieusement au-delà. Passer à 4 vCPU (B4ms/D4ps_v6) reste une option
  si la limite à 2 s'avère trop stricte en usage réel, mais pas retenu par
  défaut - pas de gain mesuré qui le justifie pour l'instant.
- VM de test détruite immédiatement après (`easyrag-loadtest-rg` supprimé),
  aucune ressource restante, facturation arrêtée.

## Ce qui reste à faire, dans l'ordre

- [x] Demander une augmentation de quota VM - fait, mais refusée
      (`QuotaNotAvailableForResource` sur DSv5, définitif) ; sans objet
      pour B-series qui a déjà 10 vCPU de quota.
- [x] ~~Bloquant : restriction de capacité générique~~ - **infirmé** : la
      restriction n'est finalement pas générique au compte. `Standard_D2ps_v6`
      (ARM64, voir test de charge ci-dessous) a été créée sans problème en
      France Central, alors que B2ms/D2s_v3/B1s y échouent toujours à ce
      jour. C'est donc une restriction par famille de SKU (anciennes
      générations x86 + B-series), pas un blocage du compte entier -
      corrige l'hypothèse notée plus haut le 27/09.
- [x] Confirmer si "Azure for Students" a un plafond de dépense intégré -
      non : passé en PAYG, `spendingLimit: Off` confirmé via l'API.
- [ ] Rattacher une Action Group au budget existant
- [x] **Test de charge réel** - fait sur `Standard_D2ps_v6` (voir section
      dédiée ci-dessus) : RAM ok (~4,5/7,7 Go), CPU limitant (2/4 requêtes
      simultanées en timeout) -> `RAG_MAX_CONCURRENT_CHATS` baissé à 2.
- [ ] Choisir la taille de VM cible pour la prod entre `D2ps_v6` (ARM,
      Spot dispo, le moins cher de loin, mais nécessite de valider le build
      arm64 des images en conditions réelles - fait une fois pour le test,
      pas encore éprouvé sur la durée) et `B2ms`/`D2s_v5` classiques
      (x86, si un jour débloqués - quota DSv5 fermé, capacité B2ms à
      revérifier périodiquement).
- [x] Code du "gardien" écrit (`guardian/`, FastAPI) : réveil/extinction de
      la VM, page d'attente, détection d'éviction Spot, plafond d'heures
      dur (refus, pas juste alerte), flag budget avec expiration
      automatique au changement de mois. Logique de décision (`guard_logic.py`)
      testée unitairement (44 tests, cas limites de plafond/rollover
      mensuel/concurrence couverts) - voir `guardian/README.md` pour les
      contraintes de déploiement (1 seule réplique, identité managée).
      **Pas encore vérifié contre de vrais Azure Table Storage/Compute** -
      seulement contre des doublures en mémoire.
      `GUARDIAN_MAX_MONTHLY_HOURS` **tranché à 40h** (28/09/2026) - au tarif
      Spot ARM (0,01515 $/h, `D2ps_v6`), l'écart de coût entre 10h et 40h
      est ~0,15 $/mois (plancher fixe IP+disque ~6,6 $ qui domine largement) :
      le plafond n'est donc plus un levier de coût, juste une marge de
      sécurité contre un usage anormal. ~7,23 $/mois (~6,35 €) au pire cas
      (plafond atteint chaque mois). Valeur posée dans `guardian/.env.example`.
- [ ] Déployer le gardien (Container App, identité managée + rôles RBAC,
      compte de stockage pour l'état) et le tester en conditions réelles
      contre la VM `D2ps_v6`.
- [ ] Côté front, consommer le contrat de réponse du gardien
      (`guardian/README.md` § "Contrat de réponse") : messages dédiés pour
      démarrage en cours, éviction Spot, plafond atteint - distinct du 429
      de `RAG_MAX_CONCURRENT_CHATS` qui existe déjà côté backend.
- [ ] Rattacher l'Action Group du budget existant au webhook
      `POST /internal/budget-alert` du gardien (actuellement `contactGroups`
      vide, alerte email seule).
- [ ] Adapter `docker-compose.yml` pour la prod : retirer `redis`, config finale
      (`SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
      `CSRF_TRUSTED_ORIGINS`, `USE_X_FORWARDED_PROTO`, `TRUSTED_PROXY_COUNT`)
- [ ] Acheter/configurer le domaine, pointer le DNS
- [ ] TLS (Let's Encrypt via le reverse-proxy, ex. Caddy) devant l'app
- [ ] Déployer pour de vrai, vérifier `/chat` et `/corpus` en bout en bout sur
      l'URL publique
- [ ] Suivre le tout premier boot complet (ingestion du corpus, pull du modèle
      Ollama) jusqu'au bout, comme `docker compose logs -f bootstrap` en local
- [ ] Adapter `docs/DEPLOYMENT.md` avec le chemin Azure réel (pas hypothétique)
