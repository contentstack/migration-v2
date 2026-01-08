#!/bin/bash

# --- Function to get current region ---
get_current_region() {
    local region=$(csdx config:get:region 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$region" ]; then
        echo "$region"
        return 0
    else
        echo "Not set"
        return 1
    fi
}

# --- Prompt for Region ---
echo ""
echo "Please select your region:"
echo "1. NA (North America)"
echo "2. EU (Europe)"
echo "3. AZURE-NA (Azure North America)"
echo "4. AZURE-EU (Azure Europe)"
echo "5. GCP-NA (GCP North America)"
read -p "Enter region number (default: 1): " REGION_CHOICE

case $REGION_CHOICE in
    2) REGION="EU";;
    3) REGION="AZURE-NA";;
    4) REGION="AZURE-EU";;
    5) REGION="GCP-NA";;
    *) REGION="NA";;
esac

echo "Selected region: $REGION"

# --- Set the Region in CSDX Config ---
echo ""
echo "Setting the region in CSDX..."
if ! csdx config:set:region "$REGION"; then
    echo "Failed to set the region. Please check your CSDX installation."
    exit 1
fi
echo "✓ Region set to $REGION."

# --- Get and Verify the Region ---
echo ""
echo "Verifying the region configuration..."
CURRENT_REGION=$(csdx config:get:region)
if [ $? -eq 0 ]; then
    echo "✓ Current region is set to: $CURRENT_REGION"
else
    echo "⚠ Could not retrieve current region configuration"
fi

# --- OAuth Login (Always redirect after region selection) ---
echo ""
echo "Redirecting to OAuth login..."
echo "This will open your browser for authentication in the selected region ($REGION)."
if ! csdx auth:login --oauth; then
    echo "OAuth login failed. Please try again."
    exit 1
fi
echo "✓ OAuth login successful for region: $REGION"

# Update redirect_uri in manifest.json
JSON_FILE="api/manifest.json"
if [ -f "$JSON_FILE" ]; then
    echo ""
    read -p "Enter new redirect_uri or press enter to use default value: " NEW_URI
    
    #default value
    if [ -z "$NEW_URI" ]; then
        NEW_URI="http://localhost:5001"
    fi
    
    sed -i '' "s|\"redirect_uri\"[[:space:]]*:[[:space:]]*\"[^\"]*\"|\"redirect_uri\": \"${NEW_URI}/v2/auth/save-token\"|g" "$JSON_FILE"
    echo "✓ redirect_uri updated to ${NEW_URI}/v2/auth/save-token in $JSON_FILE"
else
    echo "⚠ manifest.json file not found at: $JSON_FILE"
fi

# Run the Migration Script
echo ""
echo "Running the migration..."
SCRIPT_PATH="api/sso.utils.js"
if [ -f "$SCRIPT_PATH" ]; then
    csdx cm:stacks:migration --file-path "$SCRIPT_PATH"
else
    echo "Migration script not found at: $SCRIPT_PATH"
    echo "Please update the script path in build.sh"
    exit 1
fi

echo ""
echo "✓ Setup script finished."