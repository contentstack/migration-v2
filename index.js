const fs = require('fs');
const path = require('path');

const apiEnvContent = `APP_TOKEN_KEY=MIGRATION_V2\nPORT=5001\n`;
const uiEnvContent = `REACT_APP_WEBSITE_BASE_URL="http://localhost:3000/"\nREACT_APP_BASE_API_URL="http://localhost:5001/"\nREACT_APP_API_VERSION=v2\nREACT_APP_HOST="http://localhost:3000"\nREACT_APP_UPLOAD_SERVER="http://localhost:4002/"\nREACT_APP_OFFLINE_CMS=true\n`;
const uploadAPIEnvContent = `PORT=4002\nNODE_BACKEND_API=http://localhost:5001\n`;

const envFilePaths = {
  API: path.join(__dirname, 'api', 'production.env'),
  UI: path.join(__dirname, 'ui', '.env.local'),
  'Upload-API': path.join(__dirname, 'upload-api', '.env'),
};

const envContents = {
  API: apiEnvContent,
  UI: uiEnvContent,
  'Upload-API': uploadAPIEnvContent,
};

const createEnvFiles = () => {
  Object.entries(envFilePaths).forEach(([key, filePath]) => {
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFile(filePath, envContents[key], (err) => {
      if (err) {
        console.error('Error creating env file', { key, filePath, error: err });
      } else {
        console.log('Env file created successfully', { key, filePath });
      }
    });
  });
};

createEnvFiles();
