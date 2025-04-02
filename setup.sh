#!/bin/bash

# Get the script's directory (ensures correct paths)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Install NVM if not installed
if ! command -v nvm &> /dev/null; then
  echo "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
else
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Ensure Node.js 21 is installed and used
NODE_VERSION=$(node -v 2>/dev/null)
if [[ "$NODE_VERSION" != v21.* ]]; then
  echo "Installing and using Node.js 21..."
  nvm install 21
fi
nvm use 21

Setup CLI
echo "Setting up CLI repo..."
cd "$SCRIPT_DIR/cli" || exit 1

# Check if current user can write to node_modules
if [ -w node_modules ] || [ ! -d node_modules ]; then
  npm run setup-repo --force
else
  echo "Permission issue detected. Trying with sudo..."
  sudo npm run setup-repo --force
fi

# Return to script root
cd "$SCRIPT_DIR" || exit 1

# Fix npm cache permissions
echo "Fixing npm cache permissions..."
sudo chown -R $(id -u):$(id -g) "$HOME/.npm"

# Start With Env File
echo "Creating .env file..."
npm run create:env

echo "Updating config file..."
npm run setup:file

# Start services in new terminals
echo "Starting services in new terminals..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e "tell application \"Terminal\" to do script \"
  source \$HOME/.nvm/nvm.sh && nvm use 21 &&
  cd '$SCRIPT_DIR/api' &&
  echo 'Cleaning API dependencies...' &&
  rm -rf node_modules package-lock.json &&
  npm install &&
  npm run dev
  \""
  osascript -e "tell application \"Terminal\" to do script \"
  source \$HOME/.nvm/nvm.sh && nvm use 21 &&
  cd '$SCRIPT_DIR/upload-api' &&
  echo 'Cleaning upload-api dependencies...' &&
  rm -rf node_modules package-lock.json &&
  rm -rf migration-sitecore/node_modules migration-sitecore/package-lock.json &&
  npm install &&
  npm run start
  \""
  osascript -e "tell application \"Terminal\" to do script \"
  source \$HOME/.nvm/nvm.sh && nvm use 21 &&
  cd '$SCRIPT_DIR/ui' &&
  echo 'Cleaning UI dependencies...' &&
  rm -rf node_modules package-lock.json &&
  npm install &&
  npm run start
  \""
 
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux (GNOME Terminal)
  gnome-terminal -- bash -c "source $HOME/.nvm/nvm.sh && nvm use 21 && cd '$SCRIPT_DIR/api' && npm install && npm run dev; exec bash"
  gnome-terminal -- bash -c "source $HOME/.nvm/nvm.sh && nvm use 21 && cd '$SCRIPT_DIR/upload-api' && npm install && npm run start; exec bash"
  gnome-terminal -- bash -c "source $HOME/.nvm/nvm.sh && nvm use 21 && cd '$SCRIPT_DIR/ui' && npm install && npm run start; exec bash"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

echo "All services started!"