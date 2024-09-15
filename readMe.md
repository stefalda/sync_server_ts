# Sync Server (sync_server_ts)

The **Sync Server** is a Node.js/Express-based server designed to handle user authentication, client registration, and data synchronization across multiple platforms. This server works alongside a client-side library to ensure secure and consistent data synchronization, providing support for realms to separate different user groups or applications.

The client-side library is available for Flutter and any of its supported platforms (iOS, Android, Web, Windows, MacOS, Linux):
- [sync_client](https://github.com/stefalda/sync_client)

## Features

- **User and Client Registration**: Register new users and clients for secure synchronization.
- **Token-based Authentication**: Authenticate users and manage tokens for secure requests.
- **Push/Pull Syncing**: Synchronize data changes between the client and the server using push and pull methods.
- **Password Management**: Handle password changes and forgotten password requests with PIN verification.
- **Realms**: Support for multiple realms to handle separate user groups or apps.

Here is the proofread version of your paragraph:

---

## Database Support

The application requires a **Postgres** database to persist data. The database can be self-hosted or obtained from a cloud provider. It has been tested with both **Postgres** and **CockroachDB**.

In the root of the project, two scripts are available to create the Postgres and CockroachDB databases:
- `database_postgres_script.sql`
- `database_cockroachdb_script.sql`

## Docker installation
The application is offered as a Docker image downloadable from here.

If you want to self host everything you can use a docker-compose.yml file like the following:

```yaml
services:
  db:
    image: postgres:alpine3.20
    user: postgres
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgress
      - POSTGRES_DB=postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 1s
      timeout: 5s
      retries: 10  
    ports:
      - "5433:5432"
    volumes:
      - ./database_postgres_script.sql:/docker-entrypoint-initdb.d/init.sql
      - ./data:/var/lib/postgresql/data
    
  server:
    image: sfalda/sync_server:latest
    restart: always
    container_name: sync-server
    ports:
      - '3000:3000'
    depends_on:
        db:
          condition: service_healthy
    volumes:
      # the config.json file
      - ./dist/config.json:/app/dist/config.json
```

## Routes

### User & Client Registration

- **POST** `/register/:realm`
   - Registers a new user and client.
   - Requires a JSON body with `name`, `email`, `password`, and `clientId`.
   - **Example Request**:
   ```json
   {
      "name": "John Doe",
      "email": "john@example.com",
      "password": "securePassword",
      "clientId": "myClientID123"
   }
   ```

- **POST** `/unregister/:realm`
   - Unregisters the client and optionally deletes the user's data.
   - Requires an authorization token.
   - **Example Request**:
   ```json
   {
      "email": "john@example.com",
      "password": "securePassword",
      "clientId": "myClientID123"
   }
   ```

### Authentication

- **POST** `/login/:realm`
   - Logs in the user and registers the client, using Basic Authentication.
   - Returns an access token and a refresh token.
   - **Headers**: `Authorization: Basic base64(username:password)`
   - **Example Request**:
   ```json
   {
      "clientId": "myClientID123"
   }
   ```

- **POST** `/login/:realm/refreshToken`
   - Refreshes the access token using a valid refresh token.
   - **Example Request**:
   ```json
   {
      "refreshToken": "myValidRefreshToken"
   }
   ```

### Password Management

- **POST** `/password/:realm/forgotten`
   - Initiates a forgotten password request by sending a PIN to the user's registered email address.
   - **Example Request**:
   ```json
   {
      "email": "john@example.com"
   }
   ```

- **POST** `/password/:realm/change`
   - Changes the user's password by verifying the PIN sent to their email.
   - **Example Request**:
   ```json
   {
      "email": "john@example.com",
      "pin": "123456",
      "newPassword": "newSecurePassword"
   }
   ```

### Synchronization

- **POST** `/pull/:realm`
   - Pulls data changes from the sync server.
   - Requires a valid access token.
   - **Example Request**:
   ```json
   {
      "lastSyncTime": 1680300000000
   }
   ```

- **POST** `/push/:realm`
   - Pushes data changes to the sync server.
   - Requires a valid access token.
   - **Example Request**:
   ```json
   {
      "changes": [
         {
            "table": "notes",
            "operation": "insert",
            "data": {
               "guid": "123-abc",
               "title": "My Note",
               "description": "This is a new note."
            }
         }
      ]
   }
   ```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/stefalda/sync_server_ts.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the server:

   The server is able to support different *realm* each one with its specific database backend.
   Every *realm* should be defined in the **config.json** file in the dist folder or in the base folder for development.
   **Beware that the realm should be coded in lowercase.**
   
   Example config.json:

```json
{
    "db": {
        "realms": {
            "default": "postgresql://postgres:postgress@localhost:5433/postgres",
            "todos": "postgresql://postgres:postgress@localhost:5433/postgres",
            "todo_test": "postgresql://postgres:postgress@localhost:5433/postgres"
        }
    },
    "email": {
        "from": "Nowhere Man",
        "fromEmail": "nowhereman@nowhereland.com",
        "smtp": "email-smtp.eu-west-3.amazonaws.com",
        "port": "2587",
        "username": "john",
        "password": "password",
        "apps": {
            "memento": "Memento",
            "default": "Sync Server App",
            "todos": "ToDos App"
            "todo_test": "ToDos Test App"
         }
    }
}
```

4. Run the server:
   ```bash
   npm start
   ```

## Authentication

This server uses token-based authentication. After logging in via the `/login/:realm` endpoint, a JWT (JSON Web Token) is returned, which must be included in the `Authorization` header (`Bearer <token>`) for any subsequent requests that require authentication (e.g., `/pull`, `/push`).

## Error Handling

In case of any errors, the server returns an appropriate HTTP status code along with a JSON object containing the error message. Common status codes:
- `200 OK`: Request was successful.
- `403 Forbidden`: Access denied (e.g., invalid credentials, expired token).
- `500 Internal Server Error`: Something went wrong on the server.

## Realms

The concept of "realms" is used to separate different user groups or applications. Each user and client must be associated with a realm, which is provided as a path parameter in the API routes (e.g., `/register/:realm`, `/login/:realm`).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.