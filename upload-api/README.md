# Migration v2 upload-api
## Overview
The migration-v2 upload-api project is designed to facilitate the migration of different CMS to Contentstack functionalities.

## Installation
Clone the repository:
```
git clone https://github.com/contentstack/migration-v2.git
cd migration-v2/upload-api
```
Install dependencies:
```
npm install
```

## Environment Variables

The following environment variables are used in this project:

- `PORT`: The port number on which the application runs. Default is `4002`.
- `NODE_BACKEND_API`: The backend API endpoint. Default is `http://localhost:5000`.

Make sure to set these variables in a `.env` file at the root of your project.

## Configuration
Please refer sample.config.json and provide this config in index.ts of config folder of upload-api/src
The following configuration is used in this project:

- `plan.dropdown.optionLimit`: The limit for dropdown options. Default is `100`.
- `cmsType`: The type of CMS used. Default is `sitecore`.
- `isLocalPath`: A flag to indicate if the path is local. Default is `true`.

### AWS Data
- `awsRegion`: The AWS region. Default is `us-east-2`.
- `awsAccessKeyId`: The AWS access key ID.
- `awsSecretAccessKey`: The AWS secret access key.
- `awsSessionToken`: The AWS session token.
- `bucketName`: The name of the AWS S3 bucket. Default is `migartion-test`.
- `buketKey`: The key for the AWS S3 bucket. Default is `project/package 45.zip`.

### Local Path
- `localPath`: The local path to the extracted files. for example is `/upload-api/extracted_files/package 45.zip`.

## Repository
- Type: git
- URL: https://github.com/contentstack/migration-v2.git

## License
This project is licensed under the ISC License.

## Author
The author information is not specified.

## Contact
For further assistance, please contact the project maintainer through the issues page on GitHub.
