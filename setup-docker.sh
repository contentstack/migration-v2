#!/bin/bash

echo "Choose the CMS (numbers):"
select CMS_TYPE in "sitecore" "contentful" "wordpress" "aem" "drupal"; do
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
    aem)
      EXAMPLE_FILE="aem_data_structure"
      break
      ;;
    drupal)
      EXAMPLE_FILE="drupal.sql"
      break
      ;;
    *)
      echo "Invalid option. Please select 1, 2, 3, 4, or 5."
      ;;
  esac
done

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

# Drupal uses MySQL connection instead of a data file
if [[ "$CMS_TYPE" == "drupal" ]]; then
  echo ""
  echo "Drupal uses a MySQL database connection. Please provide your database details:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  read -rp "MySQL Host (e.g. host.docker.internal for host DB): " MYSQL_HOST
  read -rp "MySQL User: " MYSQL_USER
  read -rsp "MySQL Password: " MYSQL_PASSWORD
  echo ""
  read -rp "MySQL Database: " MYSQL_DATABASE
  read -rp "MySQL Port [3306]: " MYSQL_PORT
  MYSQL_PORT="${MYSQL_PORT:-3306}"

  echo ""
  echo "Drupal assets configuration (for resolving media/file URLs):"
  read -rp "Assets Base URL (e.g. https://example.com): " DRUPAL_ASSETS_BASE_URL
  read -rp "Assets Public Path (e.g. sites/default/files): " DRUPAL_ASSETS_PUBLIC_PATH

  # Drupal doesn't mount a data file; use a placeholder for Docker volume
  ORIGINAL_PATH="$(pwd)"
  DOCKER_MOUNT_PATH="$(pwd)"
  CONTAINER_PATH="/data/drupal"
  CMS_LOCAL_PATH="sql"

  export CMS_TYPE
  export CMS_DATA_PATH="$ORIGINAL_PATH"
  export CONTAINER_PATH
  export CMS_LOCAL_PATH
  export MYSQL_HOST
  export MYSQL_USER
  export MYSQL_PASSWORD
  export MYSQL_DATABASE
  export MYSQL_PORT
  export DRUPAL_ASSETS_BASE_URL
  export DRUPAL_ASSETS_PUBLIC_PATH

  set_env_var "CMS_TYPE" "$CMS_TYPE"
  set_env_var "CMS_DATA_PATH" "$ORIGINAL_PATH"
  set_env_var "DOCKER_MOUNT_PATH" "$DOCKER_MOUNT_PATH"
  set_env_var "CONTAINER_PATH" "$CONTAINER_PATH"
  set_env_var "CMS_LOCAL_PATH" "$CMS_LOCAL_PATH"
  set_env_var "NODE_BACKEND_API" "http://migration-api:5001"
  set_env_var "MYSQL_HOST" "$MYSQL_HOST"
  set_env_var "MYSQL_USER" "$MYSQL_USER"
  set_env_var "MYSQL_PASSWORD" "$MYSQL_PASSWORD"
  set_env_var "MYSQL_DATABASE" "$MYSQL_DATABASE"
  set_env_var "MYSQL_PORT" "$MYSQL_PORT"
  set_env_var "DRUPAL_ASSETS_BASE_URL" "$DRUPAL_ASSETS_BASE_URL"
  set_env_var "DRUPAL_ASSETS_PUBLIC_PATH" "$DRUPAL_ASSETS_PUBLIC_PATH"

else
  # Non-Drupal CMS types: prompt for data file/folder path
  echo "Enter the path to your $CMS_TYPE data:"
  if [[ "$CMS_TYPE" == "aem" ]]; then
    echo "(Path should contain a 'templates' folder with JSON files, or provide direct path to templates folder)"
  fi
  read -r CMS_DATA_PATH

  # Store original path for Docker (Windows paths work with Docker Desktop)
  ORIGINAL_PATH="$CMS_DATA_PATH"
  DOCKER_MOUNT_PATH="$CMS_DATA_PATH"  # Path to mount in Docker

  # Convert Windows path to Unix format for Git Bash file operations ONLY
  UNIX_PATH="$CMS_DATA_PATH"
  if [[ "$CMS_DATA_PATH" =~ ^[A-Za-z]:\\ ]]; then
    UNIX_PATH=$(echo "$CMS_DATA_PATH" | sed 's/\\/\//g')
    UNIX_PATH=$(echo "$UNIX_PATH" | sed 's/^\([A-Za-z]\):/\/\L\1/')
  fi

  # Check if file/directory exists using the converted path
  if [[ "$CMS_TYPE" == "aem" ]]; then
    if [ ! -d "$UNIX_PATH" ]; then
      echo "❌ Directory does not exist: $UNIX_PATH"
      echo "Please provide the path to your AEM data structure folder"
      exit 1
    fi
    
    if [[ "$(basename "$UNIX_PATH")" == "templates" ]]; then
      TEMPLATES_PATH="$UNIX_PATH"
      UNIX_MOUNT_PATH="$(dirname "$UNIX_PATH")"
      DOCKER_MOUNT_PATH="$(dirname "$ORIGINAL_PATH")"
      echo "ℹ️  Detected direct templates path, using parent folder for Docker mounting"
    else
      TEMPLATES_PATH="$UNIX_PATH/templates"
      UNIX_MOUNT_PATH="$UNIX_PATH"
      
      if [ ! -d "$TEMPLATES_PATH" ]; then
        echo "❌ 'templates' folder not found in: $UNIX_PATH"
        echo "Expected structure: your-folder/templates/*.json"
        echo "Or provide the direct path to the templates folder"
        exit 1
      fi
    fi
    
    JSON_COUNT=$(find "$TEMPLATES_PATH" -maxdepth 1 -name "*.json" -type f 2>/dev/null | wc -l)
    if [ "$JSON_COUNT" -eq 0 ]; then
      echo "❌ No JSON files found in templates folder: $TEMPLATES_PATH"
      echo "Please ensure your templates folder contains template JSON files"
      exit 1
    fi
    
    echo "✅ Found $JSON_COUNT JSON template file(s) in templates folder"
    
    FILENAME=$(basename "$UNIX_MOUNT_PATH")
    CONTAINER_PATH="/data/$FILENAME"
  else
    if [ ! -f "$UNIX_PATH" ]; then
      echo "❌ File does not exist: $UNIX_PATH"
      exit 1
    fi
    
    FILENAME=$(basename "$UNIX_PATH")
    CONTAINER_PATH="/data/$FILENAME"
  fi

  export CMS_TYPE
  export CMS_DATA_PATH="$ORIGINAL_PATH"
  export CONTAINER_PATH

  set_env_var "CMS_TYPE" "$CMS_TYPE"
  set_env_var "CMS_DATA_PATH" "$ORIGINAL_PATH"
  set_env_var "DOCKER_MOUNT_PATH" "$DOCKER_MOUNT_PATH"
  set_env_var "CONTAINER_PATH" "$CONTAINER_PATH"
  set_env_var "NODE_BACKEND_API" "http://migration-api:5001"

  # Set AEM-specific environment variables
  if [[ "$CMS_TYPE" == "aem" ]]; then
    set_env_var "AEM_TEMPLATES_DIR" "templates"
    echo "ℹ️  Set AEM_TEMPLATES_DIR to: templates"
  fi
fi

# Check if docker-compose.yml exists before running
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found in current directory"
  echo "Current directory: $(pwd)"
  echo "Available files:"
  ls -la
  exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo ""
  echo "❌ Docker is not running!"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

echo ""
echo "✅ Starting Docker Compose with the following configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CMS_TYPE: $CMS_TYPE"
if [[ "$CMS_TYPE" == "drupal" ]]; then
  echo "MySQL Host: $MYSQL_HOST"
  echo "MySQL User: $MYSQL_USER"
  echo "MySQL Database: $MYSQL_DATABASE"
  echo "MySQL Port: $MYSQL_PORT"
  echo "Assets Base URL: $DRUPAL_ASSETS_BASE_URL"
  echo "Assets Public Path: $DRUPAL_ASSETS_PUBLIC_PATH"
elif [[ "$CMS_TYPE" == "aem" ]]; then
  echo "CMS_DATA_PATH: $ORIGINAL_PATH"
  echo "DOCKER_MOUNT_PATH: $DOCKER_MOUNT_PATH"
  echo "CONTAINER_PATH: $CONTAINER_PATH"
  echo "Templates accessible at: $CONTAINER_PATH/templates"
else
  echo "CMS_DATA_PATH: $ORIGINAL_PATH"
  echo "CONTAINER_PATH: $CONTAINER_PATH"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Export for docker-compose
export DOCKER_MOUNT_PATH

MSYS_NO_PATHCONV=1 docker compose up --build