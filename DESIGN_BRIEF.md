# Footi — UI/UX Design Brief

A complete visual redesign brief for **Footi**, a self-hosted multiplayer soccer party game.

---

## 1. Product overview

Footi is a real-time, browser-based party game for small groups of friends (2–12 players). One person **hosts** a game from their phone or laptop; friends **join** with a 3-digit lobby code. There are three game types:

- **Trivia** — soccer trivia in real time; the **host judges every answer manually**, awarding points with the final say.
- **Guess Who** — a 24-player grid of stars; each player has a secret player and eliminates grid cards by asking real-life questions; the host crowns the round's winner.
- **Auction draft** — every player drafts a starting XI by bidding on star players (and a manager) with a 300M € budget; the host crowns the best squad, optionally with an LLM-generated judging prompt.

It is social-first: players track wins/losses against friends, keep match history, and can build a custom question bank.

It is a single-page web app, mobile-first in practice (people play on phones), fully dark-themed. All game state is pushed live over WebSockets — every player's screen stays in sync in real time.

**Target users:** a friend group (typically 3–8 people in the same room or on a voice call), 18–40, casual. The game should feel like a party activity, not an esports product — warm, playful, energetic.

---

## 2. The core game loop (must be crystal clear to anyone redesigning)

1. Player logs in / creates an account.
2. Host creates a lobby → gets a **3-digit code** (also in the URL).
3. Friends enter the code and join; everyone sees who's in the room.
4. Host configures the game:
   - **Game type:** Trivia / Guess Who / Auction draft
   - **Trivia only:** mode (Free-for-all or Teams), number of questions (5 / 10 / 15 / 20), seconds per question (15 / 20 / 30 / 45 / 60), pause between questions (2 / 4 / 6 s), difficulties, categories, team sizes (team mode only)
5. Host starts → 3-second countdown.
6. **Trivia** proceeds round by round (steps 7–11). **Guess Who** and **Auction draft** follow their own flows — see §3.11 and §3.12.
7. Each question:
   - Question appears with a **countdown timer**.
   - **Multiple choice:** pick one of A/B/C/D.
   - **Bid questions:** first place a *bid* ("how many answers can you name?"), then get **30 seconds** to type answers (one per line).
8. **Judge phase (the heart of the game):** the host sees every answer, marks bid answers correct/incorrect, and awards points. Suggestions are pre-filled, but the host has the final say.
9. **Review phase:** everyone sees the correct answer and their points for that question.
10. After the last question: **final standings** screen.
11. The match is saved to history; win/loss/draw records update per-friend.

**The judge being a human is a feature, not a limitation** — it makes the game social and forgiving ("that's close enough!").

---

## 3. Screens — one by one

Each screen below describes the current UI, its purpose, and what to preserve. Screens are rendered inside a fixed app shell (see §4).

### 3.1 Auth (login / register)
- **Purpose:** gate the app.
- Full-screen centered card on the dark background.
- Big **FOOTI** wordmark; a ⚽ inside an emerald rounded square.
- Segmented tabs: **Log in / Create account**.
- Fields: username, password. Error message below the form.
- Currently extremely minimal — no illustration, no "what is this" copy.

### 3.2 Home ("Play")
- **Purpose:** hub. Greet the player, offer create/join, show personal stats.
- Heading "Good evening, <username>".
- Small **connection status** indicator (connected / reconnecting) — the game depends on a live socket.
- Two large cards side by side:
  - **Create lobby** (you host)
  - **Join a lobby** with a big 3-digit numeric input
- A 4-tile stat strip: **Matches, Wins, Losses, Win rate**.

### 3.3 Lobby / Room (pre-game setup)
- **Purpose:** assemble the group and configure the game.
- **Left column:**
  - The **lobby code** shown huge, monospace, letter-spaced — this is the "ticket" to the game.
  - **Player chips** — one per player; green/offline dot, host crown, kick button (host only), player count.
  - **Teams panel** (team mode only) — each team is a colored card; assign/unassign players, "Split evenly" button.
- **Right column: settings.** Presets as chips/toggles, all host-only (non-hosts see disabled controls):
  - Mode (Free-for-all / Teams)
  - Question count
  - Seconds per question
  - Pause length
  - Difficulties (multi-select)
  - Categories (multi-select, with "All")
  - Team sizes (numeric steppers)
- **Start button** (host only, disabled below 2 players). Non-hosts see "Waiting for <host> to start…".

### 3.4 Game — Question screen
- **Purpose:** answer the question.
- **Scoreboard strip** across the top: top-4 players by score (or team totals in team mode). Always visible.
- **Timer bar:** label ("Answer!", "Name them!", "Next up…"), big seconds countdown, progress bar; turns red at ≤5 s.
- **Question card:** category pill + "Q n/m · difficulty" + the question text.
- **Multiple choice:** options as full-width rows with letter badges (A/B/C/D); tap to select → **"Lock in answer"** button.
- **Bid question, phase 1:** a big **bid stepper** (− / number / +) and a "Place bid" button, with explanatory copy about the 30 s naming round and bid bonus.
- **Bid question, phase 2:** your bid, everyone else's bids as small chips, a **textarea** (one answer per line), live count of named answers, and "✓ bid reached / needs N more for bonus".
- After answering: "🎯 Locked in! Waiting for others… n/m".

### 3.5 Judge screen (host only — the most complex screen)
- **Purpose:** the host awards points to every player.
- Amber-tinted header: question, **correct answer**, option list (MC) or official answer list (bid).
- One **card per player**, each containing:
  - Avatar dot in the player's team color, name, "no answer" badge if needed.
  - A **− / points / + stepper** for manual point adjustment.
  - **Multiple choice:** which option the player picked, shown as **actual text**.
  - **Bid:** "Bid X · named N" plus each answer as a chip marked ✓ / ✕ — **click a chip to toggle correct/incorrect**, and the points recompute automatically (valid answers + bid bonus).
- Big **"Submit judgments → next question"** button.
- Non-hosts see a simple "The host is judging answers…" waiting screen.

### 3.6 Review (answer reveal)
- **Purpose:** show the correct answer and points before moving on.
- A green "Correct answer" box (MC shows the right option; bid shows the official list, or "host decides").
- "Your answer" summary with points (**+N** in green, **0** in red).
- A short pause, then the next question auto-starts.

### 3.7 Results (final standings)
- **Purpose:** end-of-game celebration and standings.
- "🏁 Full time!" header with the player's rank.
- **FFA:** ordered list, medal emoji (🥇🥈🥉), winner and "you" highlighted.
- **Teams:** one card per team in team color, members and individual scores.
- Actions: **"Play again"** (recreates a lobby with the same settings) and **"Home"**.

### 3.8 Friends
- **Purpose:** social bragging rights.
- Tabs: **Friends / Requests / Add friend** (requests shows a count badge).
- Friend row: avatar initial, username, **W / L / D against you**, Remove.
- Requests: Accept / Decline.
- Add: search-as-you-type by username, results with an Add button.

### 3.9 History
- **Purpose:** past matches.
- One card per match: mode + lobby code, date/time, players grouped by team with place and score.
- "Load more" pagination (20 at a time).

### 3.10 Admin (question management)
- **Purpose:** build and manage the question bank (host controls).
- Token-gated unlock screen.
- Filter bar: category, type, difficulty, search. Live question count.
- Create/edit form: question text, JSON answer payload, category, type, difficulty.
- Question list with Edit / Delete.
- Note for the designer: this is an internal/power-user screen; visual polish is lower priority than the gameplay screens.

### 3.11 Game — Guess Who
- **Purpose:** eliminate grid cards until each player guesses the others' secret players.
- **Secret player card:** each player's assigned player (image, name, position) shown at the top — "Your secret player".
- **The grid:** 24 star players from the Guess Who pool (weighted toward top-rated/high-value names), in a 3–6 column responsive grid. Tapping a card **crosses it out** (red X, dimmed). Cards show player photo + name.
- **End of round:** the host taps **"End round & pick winner"**; a crown screen lets the host tap a player to declare the winner. Non-hosts wait on the host.

### 3.12 Game — Auction draft
- **Purpose:** draft a starting XI by bidding on stars.
- **Budget + slot strip:** remaining budget (mono, emerald) and current slot ("1/13 · Goalkeeper" etc.).
- **Offered player card:** the star (or manager) up for auction, with a 60 s bid timer.
- **Bid phase:** quick-bid chips (0/5/10/20/50M), a numeric input capped at your budget, and a **"Place bid"** button. Host can end the round early.
- **Reveal:** highest bidder wins and pays their bid; everyone else gets a **random replacement** (shown per-player). Host advances to the next slot or **finalizes squads**.
- **LLM judge:** at the end, a **copy prompt** button copies a generated judging prompt (paste into ChatGPT/Gemini etc.); the host then taps a player to crown the best squad.
- **My squad:** always-visible roster of your manager, GK, defenders, midfielders, attackers and super sub.

---

## 4. Current design system (what you're replacing)

- **Dark theme**, near-black with a green football-pitch tint:
  - `pitch-950` `#020f0b` (page background)
  - `pitch-900` `#04170f` (cards)
  - `pitch-800` `#07231a` (elevated surfaces)
  - `pitch-700` `#0b3224` (borders)
- **Accent:** emerald `#34d399` (primary actions, correct, "you"), amber `#f59e0b` (judging), rose `#f43f5e` (danger/incorrect), slate for neutral text.
- **Team colors** (8, reused everywhere a team appears): emerald, blue, amber, red, purple, orange, cyan, lime.
- **Shape:** generous rounded corners (12–16 px), soft 1 px borders, card-based layout, large touch targets.
- **Typography:** system UI stack; monospace (`font-mono`) reserved for the timer, scores, and the lobby code. Type is heavy/bold — the app is scoreboard-first.
- **Icons:** currently **emojis** (🆕 🎮 👑 ⚽ 🏆 🥇 🥈 🥉 🧑⚖️ 🎯). A real icon set would be a big upgrade.
- **Layout:** content centered in a ~64rem column. Navigation is a **fixed bottom bar on mobile, fixed top bar on desktop** (Play / Friends / History / Admin), with the username and avatar at the far end.

---

## 5. States, feedback, and behaviors to design for

- **Realtime:** every screen updates live via WebSockets — the same state appears on all players' devices simultaneously. Design must tolerate rapid, mid-interaction updates (e.g., another player answers while you're typing).
- **Connection status:** "connected / reconnecting" indicator; handle mid-game disconnects gracefully.
- **Timers everywhere:** start countdown, question timer, bid naming timer (30 s), pause between questions. This is the game's tension; make the countdown feel urgent.
- **Permissions:** non-host players see everything but controls are disabled/locked.
- **Loading states:** initial "Footi…" splash, "Loading…" lists.
- **Empty states:** no questions imported, no friends, no match history.
- **Errors:** inline form errors; transient **toast** notifications (top-center) for events like "You were kicked" or "Lobby closed".
- **Responsive:** phones are the primary device; desktop should be a comfortable large-screen version, not a stretched phone.

---

## 6. Design directions to explore (suggestions, not requirements)

1. **Replace emoji with a cohesive icon system** — especially for the footer nav, stat tiles, medals, and judge controls.
2. **Make the timer a hero element** — circular countdown rings, pulsing near zero, dramatic color shifts.
3. **Turn the lobby code into a visual centerpiece** — it's the "ticket" of the game; consider a ticket/boarding-pass motif.
4. **Make the judge screen scannable** — the host must compare N answers fast; consider one glance-able list with strong valid/invalid affordances.
5. **Give teams stronger identity** — persistent colors, emblems, and across-screen consistency (lobby → scoreboard → results).
6. **Celebrate the finish** — the results screen is the emotional payoff; it currently reads like a table.
7. **Brand personality** — a football-stadium, night-game, chant/supporter energy fits the product name and theme.
8. **Keep the pitch-dark aesthetic direction** but consider elevating it (gradients, depth, subtle texture) rather than flat fills.

---

## 7. Do-not-break rules for the redesign

- The lobby code must stay prominently visible in the lobby.
- The judge flow must remain *human-first*: manual toggling of answers and manual point adjustment with auto-suggestions.
- The bid flow (bid → 30 s naming → judge) must stay a two-step, time-boxed interaction.
- Every player's screen updates in real time without refresh.
- Team colors must be consistent across all screens.
- Mobile ergonomics (thumb-reachable actions) take priority over desktop flourish.
- No game-flow changes without flagging them — this brief is about visual redesign, not gameplay redesign.
