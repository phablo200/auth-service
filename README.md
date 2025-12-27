# Auth210

A multi-tenant authentication and authorization microservice built with Node.js, Express, and TypeScript. Auth210 provides secure user management and JWT-based authentication for multiple applications from a single service.

## Overview

Auth210 is designed to serve as a centralized authentication service for multiple client applications. Each request is scoped to a specific application via the `x-application-id` header, enabling complete tenant isolation while sharing the same infrastructure.

### Key Features

- **Multi-tenant Architecture** — Isolate users and data per application using a single deployment
- **JWT Authentication** — Secure token-based auth with refresh token support
- **User Management** — Full CRUD operations for users with soft-delete support
- **Profile System** — Role-based profiles for user categorization
- **Password Security** — Bcrypt hashing with configurable salt rounds
- **Internationalization** — Built-in i18n support (English & Portuguese)
- **Docker Ready** — Complete Docker Compose setup for development

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥24.12.0 |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT + bcrypt |
| i18n | i18next |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js ≥24.12.0 (for local development)

### Running with Docker

```bash
# Clone the repository
git clone <repository-url>
cd auth210

# Create environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Run database migrations
docker exec -it auth210-api npm run migrate

# Seed initial data
docker exec -it auth210-api npm run seed
```

The API will be available at `http://localhost:3001`

### Local Development

```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start development server
npm run dev
```

## API Reference

All endpoints require the `x-application-id` header.

### Health & Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info and version |
| GET | `/health` | Health check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| POST | `/api/auth/validate-token` | Validate a token |
| GET | `/api/auth/validate-token` | Validate token (auth required) |
| GET | `/api/auth/refresh-token` | Refresh JWT (auth required) |
| PATCH | `/api/auth/reset-password` | Reset user password |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users` | Create a new user |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user (soft delete) |

## Request Examples

### Sign Up

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -H "x-application-id: your-app-id" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-application-id: your-app-id" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

## Project Structure

```
src/
├── config/          # Configuration (i18n, etc.)
├── constants/       # Application constants
├── controllers/     # Request handlers
├── db/              # Database client, migrations, seeds
├── errors/          # Custom error classes
├── middleware/      # Express middleware
├── models/          # TypeScript interfaces
├── repositories/    # Data access layer
├── routes/          # API route definitions
├── scripts/         # CLI scripts (migrate, seed)
├── services/        # Business logic
└── types/           # Type declarations
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `JWT_SECRET` | Secret key for JWT signing |
| `DATABASE_URL` | PostgreSQL connection string |

## Database Schema

### Tables

- **users** — User accounts with email, password hash, and profile reference
- **profiles** — User roles/categories
- **applications** — Registered client applications for multi-tenancy

## Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Compile TypeScript
npm run start     # Run production build
npm run migrate   # Run database migrations
npm run seed      # Seed initial data
npm run lint      # Run ESLint
npm run test      # Run tests
```

## License

MIT © Phablo Vilas Boas

