#!/usr/bin/env bash
# Installe la commande « bonjour » dans ~/.local/bin (ou $PREFIX/bin).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${PREFIX:-$HOME/.local}/bin"

mkdir -p "$DEST"
install -m 755 "$DIR/bin/bonjour" "$DEST/bonjour"
echo "Installé : $DEST/bonjour"

case ":$PATH:" in
  *":$DEST:"*) ;;
  *) echo "Ajoutez ceci à votre ~/.bashrc ou ~/.zshrc :"
     echo "  export PATH=\"$DEST:\$PATH\"" ;;
esac
