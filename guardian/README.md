# Gardien

Reverse-proxy qui réveille/éteint la VM cible à la demande, refuse le réveil
au-delà du plafond d'heures/budget, et détecte les évictions Spot. Voir
`docs/azure-deployment-plan.md` (racine du repo) pour le contexte/raisonnement
complet - ce fichier ne couvre que la mise en route de ce service précis.

## Contraintes de déploiement (non négociables, pas juste des préférences)

- **Exactement 1 réplique** (`minReplicas=1`, `maxReplicas=1` sur la Container
  App). Le verrou en mémoire et l'état mis en cache dans `app/main.py` ne sont
  une source de vérité valable qu'avec une seule instance - plusieurs
  répliques créeraient chacune leur propre verrou, cassant la protection
  contre le double démarrage.
- Le `Dockerfile` lance uvicorn avec `--workers 1` pour la même raison - ne
  pas changer ça sans revoir `app/main.py`.
- **Identité managée** (system-assigned) sur la Container App, avec le rôle
  `Virtual Machine Contributor` scopé au resource group de la VM (pas plus
  large) - pas de clé/secret stocké.
- Cette même identité a besoin d'un accès en écriture à la table de stockage
  (`Storage Table Data Contributor` sur le compte de stockage).

## Variables d'environnement

Voir `.env.example`. Seule `GUARDIAN_MAX_MONTHLY_HOURS` n'a pas de valeur par
défaut sensée - c'est une décision produit à trancher explicitement, pas une
valeur technique à deviner.

## Brancher le budget

L'Action Group du budget Azure existant doit appeler
`POST /internal/budget-alert?token=<GUARDIAN_BUDGET_WEBHOOK_TOKEN>` comme
action webhook. Le flag posé est automatiquement ignoré le mois suivant
(voir `guard_logic.budget_flag_active`) - pas de réinitialisation manuelle à
prévoir.

## Contrat de réponse pour le front

- Chemins sous `/api/` (appels JS/fetch) : `503` + JSON
  `{"status": "waking_up" | "refused", "reason": "cold_start" | "evicted" |
  "hour_cap_reached" | "budget_exceeded", "retry_after"?: 5}`.
- Tout le reste (navigation classique) : `503` + page HTML équivalente.

## Tests

```bash
cd guardian
pip install -r requirements.txt pytest
python -m pytest tests/ -v
```

`tests/test_guard_logic.py` couvre la logique de décision pure (plafond
d'heures, rollover mensuel, budget) sans aucune dépendance Azure.
`tests/test_main.py` exerce le flux de requêtes complet (réveil, refus,
extinction pour inactivité, détection d'éviction) avec un `VmControl` et un
`StateStore` factices - toujours sans appel réseau réel.
