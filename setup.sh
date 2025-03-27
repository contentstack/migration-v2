#!/bin/bash

# Get the script's directory (ensures correct paths)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Install NVM
echo "Installing NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node.js 21
echo "Installing and using Node.js 21..."
nvm install 21
nvm use 21

Setup CLI first
echo "Setting up CLI repo..."
cd "$SCRIPT_DIR/cli" && npm run setup-repo
cd "$SCRIPT_DIR"

# Open new terminals for other services
echo "Starting services in new terminals..."

# macOS (Using AppleScript)
if [[ "$OSTYPE" == "darwin"* ]]; then
  osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/api' && npm i && npm run dev\""
  osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/upload-api' && npm i && npm run start\""
  osascript -e "tell application \"Terminal\" to do script \"cd '$SCRIPT_DIR/ui' && npm i &&  npm run start\""

# Linux (Using GNOME Terminal)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  gnome-terminal -- bash -c "cd '$SCRIPT_DIR/api' && npm run dev; exec bash"
  gnome-terminal -- bash -c "cd '$SCRIPT_DIR/upload-api' && npm run start; exec bash"
  gnome-terminal -- bash -c "cd '$SCRIPT_DIR/ui' && npm run start; exec bash"
fi

echo "All services started!"
