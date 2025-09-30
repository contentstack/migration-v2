const contentstack = require("@contentstack/marketplace-sdk");
const readline = require("readline");
const { execSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const manifest = require("./manifest.json");
const { default: axios } = require("axios");

// Region configuration
const REGION_CONFIG = {
  NA: {
    name: "North America",
    cma: "https://api.contentstack.io",
    cda: "https://cdn.contentstack.io",
    app: "https://app.contentstack.com",
    developerHub: "https://developerhub-api.contentstack.com",
    personalize: "https://personalize-api.contentstack.com",
    launch: "https://launch-api.contentstack.com",
  },
  EU: {
    name: "Europe",
    cma: "https://eu-api.contentstack.com",
    cda: "https://eu-cdn.contentstack.com",
    app: "https://eu-app.contentstack.com",
    developerHub: "https://eu-developerhub-api.contentstack.com",
    personalize: "https://eu-personalize-api.contentstack.com",
    launch: "https://eu-launch-api.contentstack.com",
  },
  "AZURE-NA": {
    name: "Azure North America",
    cma: "https://azure-na-api.contentstack.com",
    cda: "https://azure-na-cdn.contentstack.com",
    app: "https://azure-na-app.contentstack.com",
    developerHub: "https://azure-na-developerhub-api.contentstack.com",
    personalize: "https://azure-na-personalize-api.contentstack.com",
    launch: "https://azure-na-launch-api.contentstack.com",
  },
  "AZURE-EU": {
    name: "Azure Europe",
    cma: "https://azure-eu-api.contentstack.com",
    cda: "https://azure-eu-cdn.contentstack.com",
    app: "https://azure-eu-app.contentstack.com",
    developerHub: "https://azure-eu-developerhub-api.contentstack.com",
    personalize: "https://azure-eu-personalize-api.contentstack.com",
    launch: "https://azure-eu-launch-api.contentstack.com",
  },
  "GCP-NA": {
    name: "GCP North America",
    cma: "https://gcp-na-api.contentstack.com",
    cda: "https://gcp-na-cdn.contentstack.com",
    app: "https://gcp-na-app.contentstack.com",
    developerHub: "https://gcp-na-developerhub-api.contentstack.com",
    personalize: "https://gcp-na-personalize-api.contentstack.com",
    launch: "https://gcp-na-launch-api.contentstack.com",
  },
};


/**
 * Gets the current region from the CSDX config.
 * @returns The current region.
 */
function getCurrentRegion() {
  try {
    const regionOutput = execSync("csdx config:get:region", {
      encoding: "utf8",
    }).trim();
    console.log("Raw region from CSDX config:", regionOutput);

    const regionMatch = regionOutput.match(
      /\b(NA|EU|AZURE-NA|AZURE-EU|GCP-NA)\b/
    );

    if (regionMatch) {
      const regionKey = regionMatch[1];
      console.log("Extracted region key:", regionKey);
      return regionKey;
    }

    console.warn("Could not extract region from:", regionOutput);
    return "NA"; 
  } catch (error) {
    console.warn("Could not get region from CSDX:", error.message);
    return "NA"; 
  }
}

/**
 * Sets the OAuth configuration for the CLI.
 * @param migration - The migration object.
 * @param stackSDKInstance - The stack SDK instance.
 * @param managementAPIClient - The management API client.
 */
module.exports = async ({
  migration,
  stackSDKInstance,
  managementAPIClient,
}) => {
  const axiosInstance = managementAPIClient.axiosInstance;


  const regionKey = getCurrentRegion();
  const regionConfig = REGION_CONFIG[regionKey];

  console.log(`\n=== USING REGION: ${regionConfig.name} (${regionKey}) ===`);
  console.log(`CMA: ${regionConfig.cma}`);
  console.log(`CDA: ${regionConfig.cda}`);
  console.log(`App: ${regionConfig.app}`);
  console.log("=".repeat(50));

  try {
    const user = await managementAPIClient.getUser();
    console.log(`✓ User: ${user.email} (${user.uid})`);

    if (!user.organizations || user.organizations.length === 0) {
      console.log("❌ No organizations found");
      return;
    }

    console.log(`\n=== YOUR ORGANIZATIONS ===`);
    user.organizations.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.uid})`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const selectedOrg = await new Promise((resolve) => {
      rl.question(`\nSelect organization number: `, (answer) => {
        rl.close();
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < user.organizations.length) {
          resolve(user.organizations[index]);
        } else {
          console.log("❌ Invalid selection");
          resolve(null);
        }
      });
    });

    if (!selectedOrg) {
      console.log("❌ No organization selected. Exiting...");
      return;
    }

    const headers = managementAPIClient.axiosInstance.defaults.headers;
    const authtoken = headers.authtoken || headers.authorization;

    console.log(`\n✓ Selected: ${selectedOrg.name} (${selectedOrg.uid})`);
    console.log(
      `🔑 Auth token: ${
        authtoken ? authtoken.substring(0, 20) + "..." : "Not found"
      }`
    );

    const orgDetails = await managementAPIClient
      .organization(selectedOrg.uid)
      .fetch();

    console.log(`✓ Organization details fetched: ${orgDetails.name}`);

    const regionMapping = {
      NA: "NA",
      EU: "EU",
      "AZURE-NA": "AZURE_NA",
      "AZURE-EU": "AZURE_EU",
      "GCP-NA": "GCP_NA",
      "GCP-EU": "GCP_EU",
    };

    const sdkRegion = regionMapping[regionKey];

    let clientConfig = {
      authorization: authtoken,
    };

    if (regionKey !== "NA" && sdkRegion) {
      clientConfig.region = contentstack.Region[sdkRegion];
      console.log(`✓ Setting SDK region to: ${sdkRegion}`);
    }

    const client = contentstack.client(clientConfig);

    console.log(`✓ Contentstack client configured for ${regionKey} region`);

    // Find or create app
    let existingApp = null;

    try {
      console.log("🔍 Searching for existing app...");
      const allApps = await client.marketplace(selectedOrg.uid).findAllApps();
      existingApp = allApps?.items?.find((app) => app?.name === manifest?.name);

      if (!existingApp) {
        console.log("📱 Creating new app...");
        existingApp = await client
          .marketplace(selectedOrg.uid)
          .app()
          .create(manifest);
        console.log(`✓ App created: ${existingApp.name} (${existingApp.uid})`);
      } else {
        console.log(
          `✓ Found existing app: ${existingApp.name} (${existingApp.uid})`
        );
        console.log("🔄 Updating existing app with manifest...");

        // Update the existing app with the current manifest
        const oauthUpdatePayload = {
          redirect_uri: manifest?.oauth?.redirect_uri,
          app_token_config: manifest?.oauth?.app_token_config || {
            enabled: false,
            scopes: [],
          },
          user_token_config: manifest?.oauth?.user_token_config || {
            enabled: true,
            scopes: manifest?.oauth?.user_token_config?.scopes || [],
            allow_pkce: true,
          },
        };
        const updatedApp = await axios.put(
          `${regionConfig.app}/apps-api/manifests/${existingApp?.uid}/oauth`,
          oauthUpdatePayload,
          {
            headers: {
              authorization: authtoken,
              "Content-Type": "application/json",
              organization_uid: selectedOrg.uid,
            },
          }
        );

        console.log(`✓ App updated: ${existingApp.name} (${existingApp.uid})`);
      }
    } catch (error) {
      console.error("❌ Error with app operations:", error.message);
      if (error.status === 401) {
        console.error(`\n💡 Authentication Error - This usually means:`);
        console.error(`   • Your auth token is from a different region`);
        console.error(
          `   • Please logout and login again in the ${regionKey} region`
        );
        console.error(`   • Commands: csdx auth:logout → csdx auth:login`);
      }
      throw error;
    }

    console.log("🔐 Fetching OAuth configuration...");
    const oauthData = await client
      ?.marketplace(selectedOrg?.uid)
      ?.app(existingApp?.uid)
      ?.oauth()
      ?.fetch();

    console.log("🔒 Generating PKCE credentials...");
    const code_verifier = crypto?.randomBytes(32).toString("hex");
    const code_challenge = crypto
      ?.createHash("sha256")
      ?.update(code_verifier)
      ?.digest("base64")
      ?.replace(/\+/g, "-")
      ?.replace(/\//g, "_")
      ?.replace(/=+$/, "");

    // Generates the authorization URL for the app
    const authUrl = `${regionConfig.app}/#!/apps/${
      existingApp?.uid
    }/authorize?response_type=code&client_id=${
      oauthData?.client_id
    }&redirect_uri=${encodeURIComponent(
      oauthData?.redirect_uri
    )}&code_challenge=${code_challenge}&code_challenge_method=S256`;

    console.log(`\n🚀 Authorization URL for ${regionConfig.name}:`);
    console.log(authUrl);

    // Formats the app data for the app.json file
    const appData = {
      timestamp: new Date().toISOString(),
      region: {
        key: regionKey,
        name: regionConfig.name,
        endpoints: regionConfig,
      },
      user: {
        email: user.email,
        uid: user.uid,
      },
      organization: {
        name: selectedOrg.name,
        uid: selectedOrg.uid,
      },
      app: {
        name: existingApp?.name,
        uid: existingApp?.uid,
        manifest: manifest.name,
      },
      oauthData: oauthData,
      pkce: {
        code_verifier: code_verifier,
        code_challenge: code_challenge,
      },
      authUrl: authUrl,
    };

    fs.writeFileSync("app.json", JSON.stringify(appData, null, 2));
    console.log("✓ OAuth data & Auth URL logged to app.json");

  } catch (error) {
    console.error("❌ Setup failed:");
    console.error("Error:", error?.message);

    if (error?.errorMessage) {
      console.error("Details:", error?.errorMessage);
    }

    console.error(`\n🔍 Debug Info:`);
    console.error(`Region: ${regionKey} (${regionConfig?.name || "Unknown"})`);
    console.error(`Expected CMA: ${regionConfig?.cma || "Unknown"}`);
    console.error(
      `Management API URL: ${managementAPIClient.axiosInstance.defaults.baseURL}`
    );

    throw error;
  }
};