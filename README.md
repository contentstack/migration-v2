# Migration v2
## Overview
The migration-v2 project is designed to facilitate the migration of assets and related functionalities. This project includes multiple components such as API, UI, and upload API.

## Installation
Clone the repository:
```
git clone https://github.com/contentstack/migration-v2.git
cd migration-v2
```
Install dependencies:
```
npm install
```

Check for readme.md files and install dependencies for folders

1. go to api folder
  ```
  cd api
  npm install
  ```

2. go to ui folder
  ```
  cd ui
  npm install
  ```

3. go to upload-api folder
  ```
  cd upload-api
  npm install
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
