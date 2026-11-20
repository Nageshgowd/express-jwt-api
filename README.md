# Express JWT Task API

A REST API for personal task management, built with **Node.js, Express 5, MongoDB (Mongoose) and TypeScript**. Users register and log in with JWT auth, and each user can only see and change their own tasks.

## Features

- JWT authentication with bcrypt-hashed passwords (cost 12)
- Task CRUD with filtering by status, sorting and pagination
- Request validation with Zod, with clear 400 error details
- Ownership checks on every task query, so users never see each other's data
- Security basics: Helmet, CORS, a 100 KB body limit and rate limiting on auth routes
- Central error handling with consistent JSON errors
- Integration tests (Vitest + Supertest) that run against an in-memory MongoDB

## Quick start

Requires Node 20+ and a MongoDB instance (local or Atlas).

```bash
npm install
cp .env.example .env        # then set JWT_SECRET
npm run dev                 # http://localhost:3000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting files |
| `npm test` | Run the integration tests (downloads a MongoDB binary on first run) |

## API

All task routes need the header `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Create an account, returns a token |
| POST | `/api/auth/login` | Log in, returns a token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/tasks` | List tasks. Query: `page`, `limit` (max 100), `status`, `sort` |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:id` | Get one task |
| PATCH | `/api/tasks/:id` | Update fields. Send `"dueDate": null` to clear it |
| DELETE | `/api/tasks/:id` | Delete a task |

`status` is one of `todo`, `in_progress`, `done`. `sort` is one of `createdAt`, `-createdAt`, `dueDate`, `-dueDate`.

### Example

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}'

# Create a task (use the token from above)
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Write README","dueDate":"2030-01-01"}'

# List open tasks, 10 per page
curl "http://localhost:3000/api/tasks?status=todo&limit=10" -H "Authorization: Bearer $TOKEN"
```

Validation errors look like:

```json
{ "error": "Validation failed", "details": [{ "path": "title", "message": "Too small: expected string to have >=1 characters" }] }
```

## Project structure

```
src/
  app.ts            Express app: middleware and routes
  server.ts         Entry point: connects to MongoDB and listens
  config.ts         Environment config
  errors.ts         HttpError, 404 and error handlers
  middleware/auth.ts  JWT signing and verification
  models/           Mongoose models (User, Task) with indexes
  routes/           auth.ts and tasks.ts
tests/api.test.ts   Integration tests
```

## Design notes

- Login returns the same error for an unknown email and a wrong password, so accounts can't be enumerated.
- Task indexes match the list query: `{ owner, createdAt }` and `{ owner, status, createdAt }`.
- The password hash is excluded from queries by default (`select: false`).
- Tokens are not revocable. For production, add refresh tokens and a deny list.

## License

MIT
