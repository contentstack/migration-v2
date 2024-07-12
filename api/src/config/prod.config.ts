export const prodConfig = {
  CS_API: {
    NA: "https://api.contentstack.io/v3",
    EU: "https://eu-api.contentstack.com/v3",
    AZURE_NA: "https://azure-na-api.contentstack.com/v3",
    AZURE_EU: "https://azure-eu-api.contentstack.com/v3",
  },
  CS_URL: {
    NA: "https://app.contentstack.com/#!",
    EU: "https://eu-app.contentstack.com/#!",
    AZURE_NA: "https://azure-na-app.contentstack.com/#!",
    AZURE_EU: "https://azure-eu-app.contentstack.com/#!",
  },
  LOG_FILE_PATH:
    process.platform === "win32" ? ".\\combine.log" : "./combine.log", // Replace with the actual path to your log file
};
