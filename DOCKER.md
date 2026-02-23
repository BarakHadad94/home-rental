# Docker Setup

## Quick Start

```bash
# Build and run everything (use "docker compose" or "docker-compose" depending on your Docker installation)
docker compose up --build

# Or run in detached mode (background)
docker compose up -d --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

- `RESEND_API_KEY` - Required for booking confirmation emails (optional for local testing)
- `RESEND_FROM` - Sender email for Resend

## Data (uses your local backend)

Docker uses the **same** database and photos as when you run the backend locally:

- **Database**: `backend/home_rental.db`
- **Photos**: `backend/static/photos/`

So you see "Ein Kerem Vacation", your real photos, calendar, and gallery. Changes you make in Docker are saved to these files and appear when you run without Docker, and the other way around.
