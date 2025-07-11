export const devConfig = {
  CS_API: {
    NA: "https://stag-api.csnonprod.com/v3",
    EU: "https://stag-eu-api.csnonprod.com/v3",
    AZURE_NA: "https://stag-azure-na-api.csnonprod.com/v3",
    GCP_NA: "https://stag-gcp-na-api.csnonprod.com/v3",
  },
  CS_URL: {
    NA: "https://app.contentstack.com/#!",
    EU: "https://eu-app.contentstack.com/#!",
    AZURE_NA: "https://azure-na-app.contentstack.com/#!",
    AZURE_EU: "https://azure-eu-app.contentstack.com/#!",
    GCP_NA: "https://gcp-na-app.contentstack.com/#!",
  },
  LOG_FILE_PATH:
    process.platform === "win32" ? ".\\combine.log" : "./combine.log", // Replace with the actual path to your log file
};
