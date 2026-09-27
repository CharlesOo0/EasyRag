# Jeu de questions d'évaluation (#73)

Jeu de questions pour valider la qualité des réponses avant déploiement. Couvre
des pays variés (pas seulement Népal/Brésil/Norvège, utilisés partout ailleurs
dans le repo comme exemples de dev), des questions factuelles simples, des
questions hyper précises (une valeur exacte, vérifiable directement dans
`corpus/*.md`), des questions ambiguës, des questions hors corpus, et des
questions multi-pays.

`scripts/eval/run_eval.py` parse ce fichier : un titre `##` par catégorie, une
question par ligne `- `.

## Factuelles simples

- Quelle est la capitale de la Mongolie ?
- Quel est le régime politique du Bhoutan ?
- Quelle est la population du Kenya ?
- Quelle est la monnaie utilisée en Islande ?
- Quel type de climat a le Qatar ?
- Quelle est la langue officielle de la Namibie ?
- Quelles sont les principales ressources naturelles du Kazakhstan ?
- Quelle est la superficie totale de la Nouvelle-Zélande ?
- Quel est le taux de croissance démographique du Nigeria ?
- Quelle est la religion majoritaire en Thaïlande ?
- Quelle est la forme de gouvernement de Cuba ?
- Quels pays sont frontaliers de la Zambie ?
- Quelle est l'espérance de vie en Corée du Sud ?
- Quel est le taux d'alphabétisation au Bangladesh ?
- Quelle est la ville la plus peuplée d'Égypte ?
- Quels sont les principaux partenaires d'exportation de l'Australie ?
- What is the capital of Estonia?
- What is the currency used in Jordan?

## Hyper précises

Une valeur exacte et unique, vérifiée à la main dans `corpus/*.md` avant
d'écrire la question - un bon test de citation (le bon chiffre, la bonne
source) plutôt que de simple pertinence thématique.

- Quelle est la date exacte de l'indépendance de l'Inde ?
- Quelle est l'altitude du point culminant de la Tanzanie ?
- Quel est le taux de mortalité infantile total du Mali ?
- Combien d'aéroports le corpus recense-t-il pour la Russie ?
- Qui est le chef de l'État du Japon selon le corpus ?
- Quelle est la superficie totale du Chili ?
- Comment s'appelle la chambre basse du Parlement du Canada ?

## Ambiguës ou mal formulées

- capital congo
- population?
- Corée
- c'est quoi la capital de la georgie
- dis moi des trucs sur l'irlande
- Quel est le meilleur pays du corpus ?
- Pourquoi ce pays est-il pauvre ?
- tell me about the currency

## Hors corpus

- Quelle est la capitale de la Wallonie indépendante ?
- Quel est le PIB de l'Atlantide ?
- Quelle est la capitale de la Zubrowka ?
- Quel temps fera-t-il demain à Paris ?
- Qui va gagner les prochaines élections aux États-Unis ?
- Quelle est la recette du couscous marocain ?
- Quel est le score du dernier match de foot du Brésil ?
- Quelle est la capitale de la planète Mars ?

## Multi-pays / comparaison

- Quel pays a la plus grande population entre le Nigeria et l'Éthiopie ?
- Compare le PIB de l'Allemagne et de la France.
- Quels pays d'Amérique du Sud ont une façade sur l'océan Pacifique ?
- Quelle est la différence de climat entre la Norvège et l'Espagne ?
- Classe le Japon, la Corée du Sud et la Chine par population.
- Quels pays frontaliers de la Suisse ont l'allemand comme langue officielle ?
- Compare l'espérance de vie au Japon et au Tchad.
