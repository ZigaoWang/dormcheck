# tally

Digital check-in system for YK Pao School. Replaces paper rosters for morning/evening temperature checks.

## Setup

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL and AUTH_SECRET in .env
```

### Database

Uses Neon Postgres. Get a free database at [neon.tech](https://neon.tech).

```bash
# Push schema to database
pnpm db:push

# Seed demo data (1 device, 10 students, 1 admin user)
pnpm db:seed
```

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Login with:
- Email: `admin@tally.local`
- Password: `admin123`

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Random secret for NextAuth.js (generate with `openssl rand -base64 32`) |
| `AUTH_URL` | App URL, e.g. `http://localhost:3000` |

## API

### POST /api/checkin

Called by Android PDAs when a student scans their NFC card.

```bash
curl -X POST http://localhost:3000/api/checkin \
  -H "Content-Type: application/json" \
  -H "X-Device-API-Key: YOUR_DEVICE_API_KEY" \
  -d '{
    "uid": "AABBCCDD",
    "temperature": 36.5,
    "check_type": "morning",
    "device_id": "demo-pda-1"
  }'
```

Response:
```json
{
  "ok": true,
  "student_id": "s99001",
  "name": "Alice Wang",
  "grade": 9,
  "is_late": false,
  "is_fever": false,
  "message": "OK"
}
```

Auth: `X-Device-API-Key` header with a device API key (created in the Devices page).

### POST /api/students/bind

Bind an NFC card UID to a student:

```bash
curl -X POST http://localhost:3000/api/students/bind \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"student_id": "s99001", "uid": "AABBCCDD"}'
```

## Stack

- Next.js 15 (App Router) + TypeScript
- Postgres via Drizzle ORM (Neon)
- NextAuth.js (email + password)
- Tailwind CSS + shadcn/ui
- SSE for live dashboard updates
