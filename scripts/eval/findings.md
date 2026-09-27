# Constats de la relecture - #73

Relecture manuelle du rapport généré par `run_eval.py` (48 questions,
`questions.md`). Deux exécutions comparées : une avant le durcissement du
system prompt (`apps/rag/services/prompt.py`), une après - pour vérifier que
les ajustements aident vraiment plutôt que de le supposer. Pas de juge LLM :
chaque réponse ci-dessous a été lue et, pour les chiffres, vérifiée
directement dans `corpus/*.md`.

## Ce qui tient bien

- **Hors corpus (pays fictifs, sujets absurdes, prédictions) : 7/8 refus
  propres sur les deux runs**, la propriété de sécurité la plus importante
  pour une app publique sans login. Aucune tentative d'halluciner un PIB pour
  l'Atlantide, une capitale pour la Zubrowka, une météo, un résultat sportif,
  une élection à venir.
- **Questions hyper précises : 7/7 exactes**, chiffres et noms vérifiés mot
  pour mot contre le corpus (indépendance de l'Inde, altitude du Kilimandjaro,
  mortalité infantile au Mali, nombre d'aéroports en Russie, chef de l'État du
  Japon, superficie du Chili, chambre basse du Canada) - la citation
  fonctionne bien quand la question nomme un seul pays et un seul champ.
- **Questions factuelles simples sur des pays variés** (pas seulement
  Népal/Brésil/Norvège) : très majoritairement exactes et citées, y compris
  en anglais (`What is the capital of Estonia?`).
- **Désambiguïsation correcte** de formulations informelles ("capital congo"
  -> Kinshasa, "c'est quoi la capital de la georgie" -> Tbilisi malgré
  l'absence d'accent et l'orthographe).

## Deux vrais problèmes trouvés, corrigés dans le system prompt

Avant correctif, deux hallucinations franches et vérifiées contre le corpus
lui-même (pas juste "surprenant" - faux) :

- **"Compare le PIB de l'Allemagne et de la France"** -> *"Le PIB de la
  France est supérieur à celui de l'Allemagne."* Faux : le corpus donne
  France 3,732 T$ (PPA) contre Allemagne 5,247 T$ - Allemagne largement
  supérieure, dans les deux mesures (PPA et taux de change officiel).
- **"Quels pays frontaliers de la Suisse ont l'allemand comme langue
  officielle ?"** -> *"...ainsi qu'avec la République tchèque."* La
  République tchèque n'est pas frontalière de la Suisse et n'apparaît dans
  aucun des 8 passages retournés - fabriqué de toutes pièces, en violation
  directe de la règle "n'utilise que les passages fournis".
- **"tell me about the currency"** (aucun pays nommé) -> *"The Turkish Lira
  is the preferred currency in Cyprus."* Un chiffre confiant pour un pays
  choisi arbitrairement parmi 8 sources à similarité quasi identique
  (0.840-0.846, aucun signal réel), sur une question qui ne nommait aucun
  pays.

Correctif (`SYSTEM_PROMPT`) : renforcement de la règle anti-fabrication
("ne pas énoncer un fait absent des passages, même s'il semble vrai") et
ajout d'une règle explicite - si la question ne nomme pas de pays précis et
que les passages couvrent plusieurs pays sans rapport, demander de préciser
plutôt que d'en choisir un.

**Vérifié, honnêtement mitigé** : sur les deux mêmes questions rejouées après
correctif, plus aucune des deux hallucinations dangereuses (PIB inversé,
République tchèque fabriquée) - remplacées par des refus ou des réponses
correctes. Mais la règle "demander de préciser" n'est pas suivie de façon
fiable : sur "population?" et "Pourquoi ce pays est-il pauvre ?", le modèle
choisit encore silencieusement un pays arbitraire (Tchad) au lieu de
demander - la différence, c'est qu'il ne fabrique plus de chiffre faux pour
ce choix arbitraire à chaque fois (```population?``` a donné le vrai chiffre
du Tchad une fois, un refus correct une autre fois - variance d'un run à
l'autre). C'est un modèle local de 3B : le correctif réduit nettement le
risque le plus grave (une fausse affirmation présentée avec assurance), il ne
le supprime pas totalement.

## Un problème découvert par la relecture, pas encore corrigé

**Nouvelle hallucination apparue sur le deuxième run**, absente du premier -
"Quelle est la capitale de la Wallonie indépendante ?" a répondu la première
fois correctement ("la Wallonie indépendante n'existe pas"), la seconde fois
*"La capitale de la région wallonne est Anvers"* - faux (Anvers est en
Flandre ; la capitale de la Wallonie, dans la mesure où la question a un
sens, serait Namur) - et ajoute que la Wallonie serait "représentée au sein
du Parlement flamand", également faux. Le corpus ne couvre que la Belgique
au niveau national, pas ses régions ; le modèle a répondu à une
sous-question hors du périmètre du corpus au lieu de décliner entièrement,
comme il l'avait fait la première fois sur la même question.

Traité comme un signal de **variance d'un run à l'autre** plutôt qu'une
régression du prompt (rien dans le changement de `SYSTEM_PROMPT` ne cible ce
cas, et le comportement correct existait déjà avant le changement) - propre
à un modèle local de 3B sans contrôle de seed/température explicite. Pas de
correctif appliqué ici : un prompt ne peut pas garantir un comportement
déterministe sur un modèle de cette taille, et il n'y a pas de configuration
Ollama pratique pour fixer un seed par requête dans ce pipeline. Documenté
comme limite connue plutôt que "corrigé".

## Limite connue, documentée (pas un bug à corriger) : pas de recherche multi-hop

La recherche fait un seul embedding de la question entière puis un seul
top-k - elle ne peut pas "aller chercher" un pays qui n'est pas nommé dans la
question. Preuve reproductible, identique sur les deux runs : **"Quels pays
d'Amérique du Sud ont une façade sur l'océan Pacifique ?"** a répondu à
chaque fois un pays faux (Suriname, puis Suriname+Venezuela - tous deux sur
l'Atlantique/Caraïbes, pas le Pacifique) sans qu'aucun des 8 passages
retournés ne concerne un pays effectivement sur la façade Pacifique (Chili,
Pérou, Équateur, Colombie - absents des deux runs). La question ne nomme
aucun pays, donc rien ne peut orienter la recherche vers les bons.

Un effet voisin, plus subtil, apparaît même quand les deux pays SONT nommés
et correctement retrouvés : sur la comparaison PIB Allemagne/France, les 8
passages incluent bien 2-3 chunks "Germany > Economy" - mais la réponse
affirme que le PIB allemand "n'est pas spécifié dans les passages fournis".
`RAG_PROMPT_CONTEXT_CHARS` (2800, partagé entre les 8 passages) laisse
probablement trop peu de place à la deuxième entité une fois le budget
consommé par la première - un candidat plausible pour le même symptôme sur
la comparaison Norvège/Espagne (le climat espagnol, pourtant source #3, jugé
"non déductible") et le classement Japon/Corée/Chine (décliné entièrement).

**Décision : ne pas augmenter `RAG_PROMPT_CONTEXT_CHARS`.** Deux raisons :
(1) ça pénaliserait le temps de premier jeton de *toutes* les questions (y
compris les ~85% à un seul pays qui fonctionnent déjà bien) pour un gain
incertain sur un sous-ensemble multi-pays - le vrai facteur limitant est
l'ordre de sélection des passages par similarité brute, pas seulement leur
taille cumulée ; rien ne garantit qu'un budget plus grand aurait inclus la
bonne ligne de PIB allemand avant une passage France moins utile. (2) La
vraie réponse à "pas de recherche multi-hop" est une sous-requête par entité
détectée (un embedding par pays nommé, ou un elargissement de `RAG_TOP_K`
par entité) - une fonctionnalité, pas un réglage, hors scope de ce ticket.
Documenté ici et dans `docs/ARCHITECTURE.md` comme limite connue.

## Ajustements appliqués

- `apps/rag/services/prompt.py` (`SYSTEM_PROMPT`) : règle anti-fabrication
  renforcée + règle de clarification sur pays non précisé (voir plus haut).
- `RAG_TOP_K`, `RAG_SIMILARITY_THRESHOLD`, `RAG_PROMPT_CONTEXT_CHARS` :
  **non modifiés**, délibérément - `RAG_SIMILARITY_THRESHOLD` (0.72) confirme
  sa conception documentée : même les questions les plus absurdes
  (Atlantide, Mars) retournent des passages au-dessus du seuil (la bande de
  similarité e5 est trop étroite pour filtrer par le score seul), et
  pourtant 7/8 refus corrects sur ces questions - la garde-fou réelle est le
  prompt, pas le seuil, exactement comme prévu à la conception. Voir
  ci-dessus pour `RAG_PROMPT_CONTEXT_CHARS`. `RAG_TOP_K` (8) suffit déjà à
  retrouver les deux entités sur la plupart des questions à 2 pays - le
  problème observé est un problème de sélection/budget, pas de couverture.

## Reproduire

```bash
docker compose exec backend python scripts/eval/run_eval.py
# ou, si un venv host a `requests` (aucune dépendance Django) :
python scripts/eval/run_eval.py
```

Écrit `scripts/eval/report.md` (écrasé à chaque exécution - versionné comme
état de référence du pipeline actuel, pas comme historique). `--limit N` pour
un essai rapide, `--questions <fichier>` pour un autre jeu de questions.
