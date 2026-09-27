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

## Ce qui reste à faire, dans l'ordre

- [ ] Confirmer si "Azure for Students" a un plafond de dépense intégré (portail)
- [ ] Rattacher une Action Group au budget existant
- [ ] **Test de charge réel** : provisionner une VM D2s_v5 temporaire, déployer
      la stack (sans Redis), envoyer 4 requêtes de chat simultanées, observer
      la RAM réelle (`free -h`, `docker stats`) - objectif : remplacer
      l'estimation par une mesure. Si ça sature -> repli sur D4s_v5, sans
      changement significatif du coût final vu le modèle "payé à l'heure".
- [ ] Une fois la taille de VM confirmée : construire le "gardien" (Container
      App) - démarrage/extinction de la VM, page d'attente, plafond d'heures
      codé en dur (30-40h/mois de marge, recalculé sur une vraie hypothèse de
      trafic recruteur - pas les 150h lancés en l'air au départ)
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
