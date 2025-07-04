#!/bin/bash

echo "Choose the CMS (numbers):"
select CMS_TYPE in "sitecore" "contentful" "wordpress"; do
  case $CMS_TYPE in
    sitecore)
      EXAMPLE_FILE="sitecore.zip"
      break
      ;;
    contentful)
      EXAMPLE_FILE="contentful.json"
      break
      ;;
    wordpress)
      EXAMPLE_FILE="wordpress.xml"
      break
      ;;
    *)
      echo "Invalid option. Please select 1, 2, or 3."
      ;;
  esac
done

read -p "Enter the full path to your $CMS_TYPE data file (e.g., $EXAMPLE_FILE): " CMS_DATA_PATH

# Remove surrounding quotes if they exist
CMS_DATA_PATH="${CMS_DATA_PATH%\"}"
CMS_DATA_PATH="${CMS_DATA_PATH#\"}"

# Store original Windows path for Docker volume mounting
ORIGINAL_PATH="$CMS_DATA_PATH"

# Convert Windows path to Unix format for Git Bash file operations ONLY
UNIX_PATH="$CMS_DATA_PATH"
if [[ "$CMS_DATA_PATH" =~ ^[A-Za-z]:\\ ]]; then
  # Replace backslashes with forward slashes
  UNIX_PATH=$(echo "$CMS_DATA_PATH" | sed 's/\\/\//g')
  # Convert C: to /c/ format for Git Bash
  UNIX_PATH=$(echo "$UNIX_PATH" | sed 's/^\([A-Za-z]\):/\/\L\1/')
fi

# Check if file exists using the converted path
if [ ! -f "$UNIX_PATH" ]; then
  echo "❌ File does not exist: $UNIX_PATH"
  exit 1
fi

FILENAME=$(basename "$UNIX_PATH")
CONTAINER_PATH="/data/$FILENAME"

export CMS_TYPE
export CMS_DATA_PATH="$ORIGINAL_PATH"
export CONTAINER_PATH

ENV_PATH="./upload-api/.env"

set_env_var() {
  VAR_NAME="$1"
  VAR_VALUE="$2"
  
  # Create directory if it doesn't exist
  mkdir -p "$(dirname "$ENV_PATH")"
  
  if grep -q "^${VAR_NAME}=" "$ENV_PATH" 2>/dev/null; then
    # Update existing variable - escape special characters for sed
    ESCAPED_VALUE=$(printf '%s\n' "$VAR_VALUE" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i.bak "s|^${VAR_NAME}=.*|${VAR_NAME}=${ESCAPED_VALUE}|" "$ENV_PATH"
    rm -f "$ENV_PATH.bak"
  else
    # Append new variable
    echo "${VAR_NAME}=${VAR_VALUE}" >> "$ENV_PATH"
  fi
}

set_env_var "CMS_TYPE" "$CMS_TYPE"
# Use original Windows path for Docker volume mounting
set_env_var "CMS_DATA_PATH" "$ORIGINAL_PATH"
set_env_var "CONTAINER_PATH" "$CONTAINER_PATH"
set_env_var "NODE_BACKEND_API" "http://migration-api:5001"

# Check if docker-compose.yml exists before running
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found in current directory"
  echo "Current directory: $(pwd)"
  echo "Available files:"
  ls -la
  exit 1
fi

echo "✅ Starting Docker Compose with the following configuration:"
echo "CMS_TYPE: $CMS_TYPE"
echo "CMS_DATA_PATH (for Docker): $ORIGINAL_PATH"
echo "CMS_DATA_PATH (for file check): $UNIX_PATH"
echo "CONTAINER_PATH: $CONTAINER_PATH"

MSYS_NO_PATHCONV=1 docker compose up --build