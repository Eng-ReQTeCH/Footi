# Footi — multiplayer soccer party game

A self-hosted party game where friends join a lobby with a 3-digit code and play **Trivia**, **Guess Who** or an **Auction draft** — with the host judging every round. Runs on Docker Compose (PostgreSQL + Node server + React frontend).

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

### Player pool tuning

The players offered in Guess Who and the Auction come from the CSVs in `Database/` (see [Player pool](#player-pool)). All thresholds below are overridable via `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PLAYER_DEF_MV_FLOOR` | `45000000` | Standard pool: defender market-value floor (€) |
| `PLAYER_MID_MV_FLOOR` | `55000000` | Standard pool: midfielder market-value floor (€) |
| `PLAYER_ATT_MV_FLOOR` | `65000000` | Standard pool: attacker market-value floor (€) |
| `PLAYER_GK_MV_FLOOR` | `25000000` | Standard pool: goalkeeper market-value floor (€) |
| `TOP_CLUB_MV_FLOOR` | `40000000` | Standard pool: discount floor for players at a top-10 club of their league |
| `PLAYER_FC_RATING_FLOOR` | `84` | Standard pool: FC26 overall-rating floor |
| `GUESS_GK_MV_FLOOR` | `40000000` | Guess Who pool: goalkeeper floor (€) |
| `GUESS_DEF_MV_FLOOR` | `70000000` | Guess Who pool: defender floor (€) |
| `GUESS_MID_MV_FLOOR` | `80000000` | Guess Who pool: midfielder floor (€) |
| `GUESS_ATT_MV_FLOOR` | `90000000` | Guess Who pool: attacker floor (€) |
| `GUESS_TOP_CLUB_MV_FLOOR` | `50000000` | Guess Who pool: discount floor for players at a top-10 club of their league |
| `GUESS_FC_RATING_FLOOR` | `86` | Guess Who pool: FC26 overall-rating floor |

A player enters a pool if they pass **any** floor (market value, top-club discount or FC26 rating) — Egyptians are always kept. Top-10 clubs are the 10 highest squad-value clubs per league, computed from the player data at startup.

## Game types

The host picks a game type in the lobby:

- **Trivia** — the classic quiz. The host configures question count, seconds per question, categories and difficulties. Every round the host judges each answer (see below).
- **Guess Who** — a 24-player grid of the biggest names from the Guess Who pool. Each player gets a **secret player** from the grid, then asks real-life yes/no questions ("is your player a forward?") and taps grid cards to cross them out. The host ends the round and crowns the winner. Grids are weighted toward top-rated/high-value stars.
- **Auction draft** — everyone starts with a **300M € budget**. Each slot (1 GK, 4 defenders, 3 midfielders, 3 attackers, 1 super sub, 1 manager) puts a star up for auction: everyone bids, the highest bidder pays their bid and gets the player; everyone else gets a **random replacement**. Slots are weighted toward big names; replacements are purely random. After the draft the host pastes a generated **LLM judge prompt** (into ChatGPT/Gemini/etc.) to compare squads, then crowns the best squad.

## How a game works

1. One player creates a lobby and gets a **3-digit code** (also visible in the URL).
2. Friends join with the code. The host picks a game type (trivia / guess who / auction) and configures it before starting.
3. **Trivia:** question shown → everyone answers → **the host judges** every answer, awarding points (the UI shows suggested points, but the host has the final say).
4. Scores accumulate; standings show after the last round. In team mode, team scores are the sum of their members'.

Match results are saved to each player's history, and win/loss/draw records are tracked per friend in the Friends list.

## Player pool

All players, clubs and ratings live in plain CSVs under `Database/`, mounted read-only into the server:

- `players.csv` — market values, clubs, positions and images (Transfermarkt-style data).
- `clubs.csv` — club metadata and `coach_name`.
- `FC26_20250921.csv` — FC26 (FIFA) overall ratings, used to match each player to a rating and as an extra "is this a star" signal.
- `additionalMensFROMFIFAS.csv` — extra FIFA cards, including **special cards** (TOTY / Team-of-the-Season rows like `26_0`). Special cards of current stars (e.g. Ronaldo, Benzema, Kanté, Mahrez) that don't otherwise make the pool are added back in, so icons show up more often.

Pool construction (in `server/src/players.ts`):

1. Every top-5-league (PL / La Liga / Serie A / Bundesliga / Ligue 1) or Egyptian player with a positive market value is a candidate.
2. Players are matched to their FC26 rating by normalized name (exact, first+last, initial+last, or surname+club). Fallback matching is deliberately strict so a random nobody never inherits a star's rating.
3. A player passes the **standard pool** (auction + general use) or the **Guess Who pool** by clearing any floor — market value, top-club discount, or FC26 rating.
4. Special FIFA cards (86+) of stars who'd otherwise be missing get added to both pools.
5. **Managers** are the coaches of the top-10 clubs per league, the curated fallback list (`FALLBACK_MANAGERS`) and Hossam Hassan (Egypt national team).
6. Guess Who grids and auction offers are **weighted random** — star-rated/high-value players appear much more often, but the pool isn't locked to a fixed roster. Auction replacements stay uniform random.

The server logs the final pool sizes at startup, so after changing `Database/` or the floors, check the logs to see the effect.

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
Database/               # players.csv, clubs.csv, FC26 ratings, additional FIFA cards
server/src/             # auth, routes, lobby engine, player pool, question types, stats, seed
client/src/             # pages (Auth, Home, Room, Friends, History, Admin) + game components
```
