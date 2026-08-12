# Footi — multiplayer soccer trivia

A self-hosted trivia game where friends join a lobby with a 3-digit code, answer questions hosted by one of them, and the host judges every answer. Runs on Docker Compose (PostgreSQL + Node server + React frontend).

## Quick start

```bash
cp .env.example .env        # then edit passwords/secret
docker compose up -d --build
docker compose exec -T server npm run seed -- /seed/questions.example.json
```

The app is then at **http://localhost:1234** (override with `APP_PORT`).

`.env` variables:

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `footi` | DB password (used by db and server) |
| `SESSION_SECRET` | dev-only | Cookie/session signing secret — **change it** |
| `ADMIN_TOKEN` | `footi-admin` | Auth for `x-admin-token` question-management API |
| `APP_PORT` | `1234` | Host port for the web app |

## How a game works

1. One player creates a lobby and gets a **3-digit code** (also visible in the URL).
2. Friends join with the code. The host picks mode (FFA or teams), number of questions, categories, difficulties and (in team mode) team sizes before starting.
3. Each round: question is shown → everyone answers → **the host judges** every answer, awarding points (the UI shows suggested points, but the host has the final say).
4. Scores accumulate; standings show after the last question. In team mode, team scores are the sum of their members'.

Match results are saved to each player's history, and win/loss/draw records are tracked per friend in the Friends list.

## Question types

New types can be added in code only — the DB stores `answer` as JSON, so **no schema changes are needed** to support a new kind of question. Implement the `QuestionTypeHandler` interface in `server/src/questionTypes.ts` and `registerType()` it: the admin UI, seeding, scoring and judging all pick it up automatically.

### `multiple_choice` — pick one of N options

```json
{
  "type": "multiple_choice",
  "question": "Which country won the 2022 FIFA World Cup?",
  "answer": {
    "options": ["Brazil", "France", "Argentina", "Germany"],
    "correct": 2
  },
  "category": "World Cup",
  "difficulty": "easy"
}
```

`correct` is the **index** of the right option. Scoring: 10 points for the right pick. The host still confirms each answer.

### `bid` — "name as many as you can"

Players first bid how many they can name, then get **30 seconds** to type answers (one per line / separated by commas). Points are `valid answers + (bid bonus if you reached your bid)`.

```json
{
  "type": "bid",
  "question": "Name as many winners of the UEFA Champions League as you can",
  "answer": {
    "suggestions": ["Real Madrid", "AC Milan", "Liverpool", "Bayern Munich"]
  },
  "category": "Champions League",
  "difficulty": "medium"
}
```

`suggestions` is optional — include it so the judge view can flag matches automatically; omit it and the host decides manually. The host always judges the final points.

Every question needs `type`, `question`, `category` and `difficulty` (`easy` | `medium` | `hard`).

## Adding questions

### Via the admin UI

Open **/admin** from the sidebar, enter the admin token once, then create, edit or delete questions; filter by category/type/difficulty/search.

### Via JSON seed (bulk)

Put a JSON array of questions in a file and run:

```bash
docker compose exec -T server npm run seed -- /seed/myquestions.json
```

Mount additional files by adding more entries to the `seed` volume in `docker-compose.yml`. The seeder validates every question, reports per-type counts and lists any rejected rows (bad rows are skipped, good ones still saved).

### Via the admin API

All endpoints need `x-admin-token: <ADMIN_TOKEN>`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/questions?category=&type=&difficulty=&q=&limit=&offset=` | List questions (query params optional) |
| POST | `/api/admin/questions` | Create — body is a question object (see above) |
| PUT | `/api/admin/questions/:id` | Update |
| DELETE | `/api/admin/questions/:id` | Delete |

Example:

```bash
curl -X POST http://localhost:1234/api/admin/questions \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"question":"Test?","answer":{"options":["a","b"],"correct":0},"category":"Test","type":"multiple_choice","difficulty":"easy"}'
```

`/api/meta` (unauthenticated) returns the available categories, types and difficulties — handy for building filters or scripts.

## Development

```bash
# server
cd server && npm start          # tsx src/index.ts, uses DATABASE_URL

# client (Vite dev server, proxies /api and /socket.io to :3000)
cd client && npm run dev
```

Schema migrations run automatically when the server starts and before seeding (`server/src/db.ts`). Production builds are just `docker compose up -d --build`.

## Layout

```
docker-compose.yml      # db + server + frontend (nginx) on APP_PORT
db/init/001_schema.sql  # users, friends, questions, matches, answers, sessions
seed/                   # example questions, mounted read-only into the server
server/src/             # auth, routes, lobby engine, question types, stats, seed
client/src/             # pages (Auth, Home, Room, Friends, History, Admin) + game components
```