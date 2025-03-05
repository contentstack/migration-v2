const fs = require('fs');
const path = require('path');

const apiEnvContent = `
APP_TOKEN_KEY=MIGRATION_V2
PORT=5001
`;

const uiEnvContent = `
REACT_APP_WEBSITE_BASE_URL="http://localhost:3000/"
REACT_APP_BASE_API_URL="http://localhost:5001/"
REACT_APP_API_VERSION=v2
REACT_APP_HOST="http://localhost:3000"
REACT_APP_UPLOAD_SERVER="http://localhost:4002/"
REACT_APP_OFFLINE_CMS=true
`;

const uploadAPIEnvContent = `
PORT=4002
NODE_BACKEND_API =http://localhost:5001
`;

const envFilePaths = {
  API: path.join(__dirname, 'api', 'production.env'),
  UI: path.join(__dirname, 'ui', '.env.local'),
  'Upload-API': path.join(__dirname, 'upload-api', '.env'),
};

// Define the contents for each file in an array
const envContents = {
  API: apiEnvContent,
  UI: uiEnvContent,
  'Upload-API': uploadAPIEnvContent,
};

// Function to create env files
const createEnvFiles = () => {
  // Loop through each key in the envFilePaths object
  Object.keys(envFilePaths).forEach((key) => {
    const filePath = envFilePaths[key];
    const dir = path.dirname(filePath);

    // Ensure the directory exists, if not, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the content to the env file corresponding to the key
    fs.writeFile(filePath, envContents[key], (err) => {
      if (err) {
        console.error(`Error creating ${key} file at ${filePath}:`, err);
      } else {
        console.log(`${key} env file created successfully!`);
      }
    });
  });
};

// Run the function to create the files
createEnvFiles();
