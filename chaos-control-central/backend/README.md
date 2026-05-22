# Last Puff Backend

Production-ready Node.js, Express, PostgreSQL, and JWT authentication backend for the Last Puff web application.

## Folder Structure

```text
backend/
├── config/
│   └── db.js
├── controllers/
│   └── authController.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   └── userModel.js
├── routes/
│   └── authRoutes.js
├── .env
├── package.json
├── README.md
└── server.js
```

## Environment Variables

Create or update `backend/.env` with your PostgreSQL credentials:

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=last_puff
DB_PASSWORD=YOUR_PASSWORD
DB_PORT=5432
JWT_SECRET=lastpuffsecret
```

## Database Setup

Create the database:

```sql
CREATE DATABASE last_puff;
```

Create the `users` table inside the `last_puff` database:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Install Dependencies

From the `backend` folder run:

```bash
npm install
```

This installs:

- `express`
- `cors`
- `dotenv`
- `pg`
- `bcryptjs`
- `jsonwebtoken`
- `nodemon`

## Available Scripts

```bash
npm run dev
```

Starts the backend with `nodemon`.

```bash
npm start
```

Starts the backend with Node.js.

## Expected Startup Output

```text
PostgreSQL Connected
Server running on port 5000
```

## API Routes

### `GET /api/test`

Response:

```json
{
  "message": "Backend working"
}
```

### `POST /api/auth/signup`

Request body:

```json
{
  "name": "Sobin",
  "email": "sobin@gmail.com",
  "password": "yourPassword"
}
```

Successful response:

```json
{
  "success": true,
  "token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Sobin",
    "email": "sobin@gmail.com"
  }
}
```

### `POST /api/auth/login`

Request body:

```json
{
  "email": "sobin@gmail.com",
  "password": "yourPassword"
}
```

### `GET /api/auth/me`

Protected route.

Headers:

```text
Authorization: Bearer <jwt_token>
```

Returns the logged-in user profile.

## Frontend Integration Notes

- All responses are JSON.
- Proper HTTP status codes are returned for validation, auth, and server errors.
- The backend is isolated inside the `backend` folder and does not modify the current frontend UI.
