# Standard auto — réservations et commandes pour commerçants

Un standard téléphonique automatique : le client appelle, choisit au clavier de réserver une table ou de commander à emporter, et tout arrive directement dans l'espace du commerçant. Sans dépendance (Node.js ≥ 18 uniquement).

## Ce que ça fait

| | |
|---|---|
| 📞 **Téléphone** | Répond aux appels (Twilio). `1` = réserver (personnes → jour → heure), `2` = commander (choix des plats, total annoncé, heure de retrait). Propose des heures alternatives si c'est complet. |
| 🌐 **Page client** `/` | Réservation en ligne (créneaux réellement disponibles) et commande à emporter. |
| 🧑‍🍳 **Espace commerçant** `/admin` | Réservations du jour, commandes en cours (nouvelle → préparation → prête), historique des appels, carte, tables, horaires. Se rafraîchit seul, avec un son optionnel. |
| 🧪 **Simulateur** `/simulateur` | Teste le parcours téléphonique complet depuis le navigateur, sans numéro. |

Les réservations sont **confirmées automatiquement** : la plus petite table libre pouvant accueillir le groupe est attribuée, sans chevauchement.

## Démarrage

```bash
ADMIN_PASSWORD=choisissez-un-mot-de-passe npm start
# http://localhost:3000        page client
# http://localhost:3000/admin  espace commerçant (identifiant libre, mot de passe = ADMIN_PASSWORD)
npm test
```

## Brancher un vrai numéro (Twilio)

1. Hébergez l'app derrière HTTPS (Render, Fly.io, un VPS…).
2. Chez Twilio, achetez un numéro français et réglez **A call comes in** → *Webhook*, `POST`, `https://VOTRE-DOMAINE/voice/incoming`.
3. Définissez `TWILIO_AUTH_TOKEN` et `PUBLIC_URL=https://VOTRE-DOMAINE` : les requêtes sont alors vérifiées par signature, personne d'autre ne peut appeler vos webhooks.

## Configuration (variables d'environnement)

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | Mot de passe de `/admin` et `/simulateur` (défaut `admin` : à changer). |
| `TWILIO_AUTH_TOKEN`, `PUBLIC_URL` | Vérification de la signature Twilio. |
| `NOTIFY_WEBHOOK_URL` | Reçoit un `POST` JSON à chaque réservation, commande ou appel (pour brancher SMS, WhatsApp, Slack, Zapier…). |
| `PORT`, `DATA_FILE` | Port (3000) et fichier de données (`data/db.json`). |

Horaires, durée d'un repas, tables, carte et message d'accueil se règlent dans l'espace commerçant.

## Limites actuelles

- Parcours téléphonique au clavier (DTMF) ; la reconnaissance vocale libre est une évolution possible.
- Le client téléphonique est identifié par son numéro d'appel (pas de nom).
- Données stockées dans un fichier JSON : adapté à un commerce, pas à du multi-commerces.
- Pas de paiement en ligne ni d'envoi de SMS de confirmation (utilisez `NOTIFY_WEBHOOK_URL` pour automatiser).
