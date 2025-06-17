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

if [ ! -f "$CMS_DATA_PATH" ]; then
  echo "❌ File does not exist: $CMS_DATA_PATH"
  exit 1
fi

FILENAME=$(basename "$CMS_DATA_PATH")
CONTAINER_PATH="/data/$FILENAME"

export CMS_TYPE
export CMS_DATA_PATH
export CONTAINER_PATH

ENV_PATH="./upload-api/.env"

set_env_var() {
  VAR_NAME="$1"
  VAR_VALUE="$2"
  if grep -q "^${VAR_NAME}=" "$ENV_PATH" 2>/dev/null; then
    # Update existing variable (cross-platform)
    sed -i.bak "s|^${VAR_NAME}=.*|${VAR_NAME}=${VAR_VALUE}|" "$ENV_PATH"
    rm -f "$ENV_PATH.bak"
  else
    # Append new variable
    echo "${VAR_NAME}=${VAR_VALUE}" >> "$ENV_PATH"
  fi
}

set_env_var "CMS_TYPE" "$CMS_TYPE"
set_env_var "CMS_DATA_PATH" "$CMS_DATA_PATH"
set_env_var "CONTAINER_PATH" "$CONTAINER_PATH"
set_env_var "NODE_BACKEND_API" "http://migration-api:5001"


docker compose up --build