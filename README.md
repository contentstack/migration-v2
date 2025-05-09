# Migration v2
## Overview
The migration-v2 project is designed to facilitate the migration of assets and related functionalities. This project includes multiple components such as API, UI, and upload API.

## Installation
Clone the repository:
```
git clone https://github.com/contentstack/migration-v2.git
cd migration-v2
```

Check for readme.md files and install dependencies for folders

## Migration-v2 API

This is the migration V2's node server.

### Environment Variables
The following environment variables are used in this project:

- `APP_TOKEN_KEY`: The token key for the application. Default is `MIGRATION_V2`.
- `PORT`: The port number on which the application runs. Default is `5001`.

Make sure to set these variables in a `.env` file at the root of your project.

1. To run the development server, create a `./development.env` file and add environment variables as per `./example.env`
2. To run the production server, create a `./production.env` file and add environment variables as per `./example.env`

### To start the server
Run `npm run dev`


## Migration UI

Migration UI is a web application designed to facilitate the migration of content. It provides a user-friendly interface for managing and migrating content efficiently.

### Features
- User-friendly interface for content migration
- Integration with Contentstack
- State management with Redux Toolkit
- Comprehensive testing with Testing Library

### Installation

1. Navigate to the project directory:
    ```sh
    cd ui
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

### Environment Variables

The following environment variables are used in this project:

- `REACT_APP_WEBSITE_BASE_URL`: The base URL for the website. Default is `http://localhost:3000/`.
- `REACT_APP_BASE_API_URL`: The base URL for the API. Default is `http://localhost:5001/`.
- `REACT_APP_API_VERSION`: The version of the API. Default is `v2`.
- `REACT_APP_HOST`: The host URL for the application. Default is `http://localhost:3000`.
- `REACT_APP_UPLOAD_SERVER`: The URL for the upload server. Default is `http://localhost:4002/`.
- `REACT_APP_OFFLINE_CMS`: A flag to indicate if the CMS is offline. Default is `true`.

Make sure to set these variables in a `.env` file at the root of your ui project.

### Usage
Start the development server:
```sh
npm start
```

Open your browser and navigate to http://localhost:3000.

### Dependencies
- @contentstack/json-rte-serializer: ^2.0.5
- @contentstack/venus-components: ^2.2.4
- @reduxjs/toolkit: ^2.2.5
- @testing-library/jest-dom: ^5.17.0
- @testing-library/react: ^13.4.0
- @testing-library/user-event: ^13.5.0
- @types/react: ^18.2.28
- @types/react-dom: ^18.2.13
- @types/react-redux: ^7.1.33

## Migration v2 upload-api
### Overview
The migration-v2 upload-api project is designed to facilitate the migration of different CMS to Contentstack functionalities.

### Installation
Navigate to the project directory:
```
cd migration-v2/upload-api
```
Install dependencies:
```
npm install
```

### Environment Variables

The following environment variables are used in this project:

- `PORT`: The port number on which the application runs. Default is `4002`.
- `NODE_BACKEND_API`: The backend API endpoint. Default is `http://localhost:5001`.

Make sure to set these variables in a `.env` file at the root of your project.

### Configuration
Please refer sample.config.json and provide this config in index.ts of config folder of upload-api/src
The following configuration is used in this project:

- `plan.dropdown.optionLimit`: The limit for dropdown options. Default is `100`.
- `cmsType`: The type of CMS used. Default is `sitecore`.
- `isLocalPath`: A flag to indicate if the path is local. Default is `true`.

#### AWS Data
- `awsRegion`: The AWS region. Default is `us-east-2`.
- `awsAccessKeyId`: The AWS access key ID.
- `awsSecretAccessKey`: The AWS secret access key.
- `awsSessionToken`: The AWS session token.
- `bucketName`: The name of the AWS S3 bucket. Default is `migartion-test`.
- `buketKey`: The key for the AWS S3 bucket. Default is `project/package 45.zip`.

#### Local Path
- `localPath`: The local path to the extracted files. for example `/upload-api/extracted_files/package 45.zip`.

## Cli
Navigate to the project directory
  1. Install pnpm
  Since pnpm is required, you need to install it globally if it's not already installed:
  ```
  npm install -g pnpm
  ```
  2. Run the Setup Script
  Now, run the main setup script specified in the package.json:
  ```
  npm run setup-repo
  ```

## Scripts
- `npm start`: Starts the main server by running index.js.
- `npm run api`: Navigates to the api directory and runs the development server.
- `npm run upload`: Navigates to the upload-api directory and starts the upload API server.
- `npm run ui`: Navigates to the ui directory and starts the UI server.
- `npm run env`: Starts the main server by running npm start.
- `npm run postinstall`: Installs dependencies for the api, ui, and upload-api directories.
- `npm test`: Displays an error message indicating that no tests are specified.

## Repository
- Type: git
- URL: https://github.com/contentstack/migration-v2.git

## Bugs and Issues
- URL: https://github.com/contentstack/migration-v2/issues

## Homepage
- URL: https://github.com/contentstack/migration-v2#readme

## DevDependencies
- husky: ^4.3.8
- prettier: ^2.4.1
- rimraf: ^3.0.2
- validate-branch-name: ^1.3.0

## Husky Configuration
```
"husky": {
  "hooks": {}
}
```

- Branch Name Validation
```
"validate-branch-name": {
  "pattern": "^(feature|bugfix|hotfix)/[a-z0-9-]{5,30}$",
  "errorMsg": "Please add valid branch name!"
}
```

## License
This project is licensed under the ISC License.

## Author
The author information is not specified.

## Contact
For further assistance, please contact the project maintainer through the issues page on GitHub.
