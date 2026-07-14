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

## Database Support

The application requires a **Postgres** database to persist data. The database can be self-hosted or obtained from a cloud provider. It has been tested with both **Postgres** and **CockroachDB**.

In the root of the project, two scripts are available to create the Postgres and CockroachDB databases:
- `database_postgres_script.sql`
- `database_cockroachdb_script.sql`

## Docker

The application is available as a Docker image on Docker Hub:

```bash
docker pull sfalda/sync_server:latest
```

### Build Locally

```bash
docker build -t sync_server .
```

### Docker Compose

To self-host the full stack (PostgreSQL + server), use a `docker-compose.yml` like the following:

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
    "server": {
        "port": 8076,
        "authentication": "jwt",
        "secret_key": "JWT_SECRET_KEY",
        "secret_key_refresh": "JWT_SECRET_KEY2"
    },
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
            "todos": "ToDos App",
            "todo_test": "ToDos Test App"
        }
    }
}
```

4. Run the server:
   ```bash
   npm start
   ```

## Testing

Tests use **Vitest** with a real PostgreSQL test database. The test infrastructure includes integration tests (against a real database) and unit tests (for pure logic like password hashing).

### Prerequisites

- A running PostgreSQL instance (Docker command below)
- Create the test database:
  ```bash
  docker run -d --name sync-server-test-db \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgress \
    -e POSTGRES_DB=sync_server_test \
    -p 5433:5432 \
    postgres:alpine3.20
  ```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch
```

The test configuration uses `config.test.json` (loaded automatically via Vitest aliases when `NODE_ENV=test`). The production `config.json` is never modified.

### Test Structure

Tests mirror the `src/` directory structure under `test/`:

| Directory | Tests |
|-----------|-------|
| `test/helpers/` | Email client, logger, config |
| `test/middleware/` | Authorization middleware |
| `test/repositories/` | Database, sync, user, auth, chunk processor |
| `test/routes/` | API endpoints, sync routes, password flow |

The database schema is provisioned automatically before each test run via `test/globalSetup.ts`. Each test suite cleans up after itself using `test/fixtures.ts` helpers.

## CI Pipeline

The project uses **GitHub Actions** for continuous integration. The CI workflow:

1. **Spins up a PostgreSQL service** (same `postgres:alpine3.20` image) using GitHub Actions service containers.
2. **Installs dependencies** (`npm ci`).
3. **Runs linting** (`npm run lint`).
4. **Runs the full test suite** (`npm test`) against the service container database.
5. **Builds the project** (`npm run build`).

The CI configuration is at `.github/workflows/ci.yml`. Tests run against a PostgreSQL service container on port 5433 (matching the test configuration in `config.test.json`). Lint warnings do not block the pipeline.

## Health Check

A `GET /healthz` endpoint returns `{ "status": "ok" }` with HTTP 200, useful for container orchestrators and load balancers.

## Authentication

The server supports two authentication modes, configured via `server.authentication` in `config.json`:

- **`"jwt"`** (default): Returns a JWT access token (24h expiry) and a refresh token (7d expiry). Tokens are signed with `secret_key` and `secret_key_refresh` respectively.
- **`"token"`**: Returns a UUID-based access token and refresh token stored in the database.

After logging in via the `/login/:realm` endpoint, include the token in the `Authorization` header (`Bearer <token>`) for authenticated requests (e.g., `/pull`, `/push`).

## Error Handling

In case of any errors, the server returns an appropriate HTTP status code along with a JSON object containing the error message. Common status codes:
- `200 OK`: Request was successful.
- `403 Forbidden`: Access denied (e.g., invalid credentials, expired token).
- `500 Internal Server Error`: Something went wrong on the server.

## Realms

The concept of "realms" is used to separate different user groups or applications. Each user and client must be associated with a realm, which is provided as a path parameter in the API routes (e.g., `/register/:realm`, `/login/:realm`).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.