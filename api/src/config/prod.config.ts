export const prodConfig = {
  CS_API: {
    NA: "https://api.contentstack.io/v3",
    EU: "https://eu-api.contentstack.com/v3",
    AZURE_NA: "https://azure-na-api.contentstack.com/v3",
    AZURE_EU: "https://azure-eu-api.contentstack.com/v3",
    GCP_NA: "https://gcp-na-api.contentstack.com/v3",
  },
  CS_URL: {
    NA: "https://app.contentstack.com/#!",
    EU: "https://eu-app.contentstack.com/#!",
    AZURE_NA: "https://azure-na-app.contentstack.com/#!",
    AZURE_EU: "https://azure-eu-app.contentstack.com/#!",
    GCP_NA: "https://gcp-na-app.contentstack.com/#!",
  },
  LOG_FILE_PATH:
    process.platform === "win32" ? ".\\sample.log" : "./sample.log", // Replace with the actual path to your log file
};
