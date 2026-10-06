---
name: skill-md
description: Orchestrateur universel. Utilise ce skill pour toute demande de l'utilisateur dont la réalisation peut nécessiter un ou plusieurs autres skills (documents, PDF, Word, Excel, PowerPoint, graphiques, artifacts, code, business, etc.). Il identifie les skills nécessaires, les charge et les enchaîne jusqu'à ce que la demande soit entièrement accomplie.
---

# skill-md — orchestrateur de skills

Objectif : mener à bien la demande de l'utilisateur en mobilisant **tous les skills nécessaires**, sans qu'il ait à les nommer.

## Procédure

1. **Comprendre la demande** : résultat attendu, format du livrable, public, contraintes. Si un point bloquant est ambigu, poser une seule question courte ; sinon choisir un défaut raisonnable et le signaler.
2. **Cartographier les skills** : parcourir la liste des skills disponibles dans la session et sélectionner tous ceux dont la description correspond à une partie de la tâche. Découper la demande en étapes, associer chaque étape à un skill.
3. **Charger chaque skill avec l'outil `Skill`** avant de l'utiliser, et suivre ses instructions à la lettre. Ne jamais deviner un nom : n'utiliser que ceux qui sont listés.
4. **Enchaîner dans l'ordre logique** (ex. données → xlsx → dataviz → pdf/pptx/docx → artifact). Réutiliser les sorties d'une étape comme entrées de la suivante.
5. **Vérifier** : relire le livrable, tester ce qui peut l'être (exécution, ouverture du fichier, rendu), corriger avant de conclure.
6. **Livrer** : indiquer clairement les fichiers produits (chemins) et un court résumé des skills utilisés et de ce qui a été fait.

## Correspondances usuelles

| Besoin | Skill |
|---|---|
| Document, rapport, lettre | `docs` (ou `docx` si Word demandé) |
| PDF (lire, créer, fusionner) | `pdf` |
| Tableur, CSV | `xlsx` |
| Présentation | `pptx` |
| Graphique, dashboard | `dataviz` |
| Page web, artifact | `artifact-design`, `web-artifacts-builder` |
| Visuel, affiche | `canvas-design` |
| API / SDK Claude | `claude-api` |
| Revue de code / sécurité | `code-review`, `security-review`, `simplify` |
| Business en ligne de Samir | `samir-business-manager` |
| Création/amélioration d'un skill | `skill-creator` |
| Réglages Claude Code | `update-config` |

## Règles

- Utiliser plusieurs skills si la tâche le demande ; n'en utiliser aucun si elle est triviale.
- Préférer le skill spécialisé à une solution improvisée.
- Si aucun skill ne convient, faire la tâche directement avec les outils disponibles et le dire.
- Ne jamais prétendre qu'un skill a été exécuté s'il ne l'a pas été.
- Répondre dans la langue de l'utilisateur (français par défaut).
