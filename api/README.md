# migration-v2 API

This is the migration V2's node server.

## To start the server

1. Run `npm i`
2. Install and start MongoDB

### To start MongoDB

1. Install MongoDB on your system.
2. Start the MongoDB service.
3. Verify that MongoDB is running by opening a command prompt and running the command `mongo --version`.

## Environment Variables
The following environment variables are used in this project:

- `APP_TOKEN_KEY`: The token key for the application. Default is `MIGRATION_V2`.
- `PORT`: The port number on which the application runs. Default is `5001`.

Make sure to set these variables in a `.env` file at the root of your project.

1. To run the development server, create a `./development.env` file and add environment variables as per `./example.env`
2. To run the production server, create a `./production.env` file and add environment variables as per `./example.env`

