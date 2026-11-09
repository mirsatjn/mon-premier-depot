# mon-premier-depot

Une petite commande de terminal : `bonjour`.

## Installation

```bash
git clone https://github.com/mirsatjn/mon-premier-depot.git
cd mon-premier-depot
./install.sh
```

La commande est copiée dans `~/.local/bin` (changez avec `PREFIX=/usr/local ./install.sh`).
Si ce dossier n'est pas dans votre `PATH`, le script vous indique la ligne à ajouter.

## Utilisation

```bash
bonjour            # Bonjour, le monde !
bonjour Alice      # Bonjour, Alice !
bonjour --help
```

## Désinstallation

```bash
rm ~/.local/bin/bonjour
```
