# Migration UI

Migration UI is a web application designed to facilitate the migration of content. It provides a user-friendly interface for managing and migrating content efficiently.

## Features
- User-friendly interface for content migration
- Integration with Contentstack
- State management with Redux Toolkit
- Comprehensive testing with Testing Library

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/contentstack/migration-v2
    ```

2. Navigate to the project directory:
    ```sh
    cd ui
    ```

3. Install the dependencies:
    ```sh
    npm install
    ```

## Environment Variables

The following environment variables are used in this project:

- `REACT_APP_WEBSITE_BASE_URL`: The base URL for the website. Default is `http://localhost:3000/`.
- `REACT_APP_BASE_API_URL`: The base URL for the API. Default is `http://localhost:5001/`.
- `REACT_APP_API_VERSION`: The version of the API. Default is `v2`.
- `REACT_APP_HOST`: The host URL for the application. Default is `http://localhost:3000`.
- `REACT_APP_UPLOAD_SERVER`: The URL for the upload server. Default is `http://localhost:4002/`.
- `REACT_APP_OFFLINE_CMS`: A flag to indicate if the CMS is offline. Default is `true`.

Make sure to set these variables in a `.env` file at the root of your ui project.

## Usage
Start the development server:
```sh
npm start
```

Open your browser and navigate to http://localhost:3000.

## Dependencies
- @contentstack/json-rte-serializer: ^2.0.5
- @contentstack/venus-components: ^2.2.4
- @reduxjs/toolkit: ^2.2.5
- @testing-library/jest-dom: ^5.17.0
- @testing-library/react: ^13.4.0
- @testing-library/user-event: ^13.5.0
- @types/react: ^18.2.28
- @types/react-dom: ^18.2.13
- @types/react-redux: ^7.1.33

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any changes.

## License
This project is licensed under the MIT License.
