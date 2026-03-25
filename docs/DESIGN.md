# Design Document — Random Player Auction

## Overview

The Random Player Auction is a single-page web application that provides a fair, transparent, and entertaining way to randomly draft players for a badminton league. It uses a slot machine UI to visually randomize player selection, with cryptographically secure randomness to ensure fairness.

---

## Architecture

```
Random_Player_Auction/
├── public/                      # Static assets (banner, favicon, icons, CSV)
├── src/
│   ├── components/
│   │   ├── SlotMachine.jsx      # Animated reel with vertical scroll effect
│   │   ├── PlayerTable.jsx      # Player pool list with status badges
│   │   ├── SelectedPanel.jsx    # Selected players grouped by skill
│   │   └── WaitlistPanel.jsx    # Per-round waitlist with restore action
│   ├── utils/
│   │   └── random.js            # Crypto-grade random (rejection sampling, Fisher-Yates)
│   ├── App.jsx                  # Main app: state management, rounds, file upload
│   ├── main.jsx                 # Entry point
│   └── index.css                # Tailwind + custom animations + neon theme
├── docs/                        # Documentation
├── start.sh                     # Launch script (macOS/Linux)
├── start.bat                    # Launch script (Windows)
├── vite.config.js               # Vite configuration
└── package.json
```

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Framework   | React 19 + Vite 8                               |
| Styling     | Tailwind CSS 4 + custom CSS                     |
| Icons       | Lucide React                                    |
| CSV Parsing | PapaParse                                       |
| Excel       | SheetJS (xlsx)                                  |
| Randomness  | Web Crypto API (`crypto.getRandomValues`)       |
| Persistence | Browser localStorage                            |
| Fonts       | Orbitron (display) + Inter (body)               |

---

## Visual Design

- **Dark mode** base (`#0a0a1a`) with neon accent colors
- **Neon color scheme**:
  - Cyan (`#00fff7`) — selected players, primary highlights
  - Green (`#39ff14`) — pool status, confirm actions
  - Magenta (`#ff00ff`) — advanced skill, later rounds
  - Yellow (`#ffe600`) — waitlist, beginner skill
  - Orange (`#ff6b00`) — file upload actions
- **Slot machine reel** with vertical scroll animation, gradient fade edges, and glowing center line
- **Animated border glow** cycling through cyan/magenta/green
- **Winner reveal** with scale animation and text glow
- **Skill-level color coding**:
  - Advanced → Magenta
  - Intermediate+ → Cyan
  - Intermediate → Green
  - Beginner → Yellow

---

## Data Flow

```
CSV/Excel File
     │
     ▼
  PapaParse / SheetJS
     │
     ▼
  parseRows() → Player Objects [{id, name, skill, category, flat, ...}]
     │
     ▼
  App State (React useState)
     │
     ├── allPlayers[]         — full player list (immutable after load)
     ├── selectedIds (Set)    — IDs of selected players
     ├── waitlists (Object)   — { roundNumber: Set of skipped player IDs }
     ├── round (Number)       — current round (1, 2, 3, ...)
     ├── history[]            — action log for undo
     └── currentPlayer        — player shown after spin
     │
     ▼
  localStorage (auto-saved on every state change)
```

---

## Multi-Round Waitlist System

This is the core feature of the auction. Players who are skipped in any round are moved to that round's waitlist, which becomes the pool for the next round.

### Round Flow

```
Round 1 (Skill-filtered pool)
  ├── SELECT → Selected Players list
  └── SKIP   → Waitlist Round 1
                    │
                    ▼
Round 2 (Pool = Waitlist Round 1, all skills mixed)
  ├── SELECT → Selected Players list (removed from Waitlist R1)
  └── SKIP   → Waitlist Round 2 (removed from Waitlist R1)
                    │
                    ▼
Round 3 (Pool = Waitlist Round 2, all skills mixed)
  ├── SELECT → Selected Players list (removed from Waitlist R2)
  └── SKIP   → Waitlist Round 3 (removed from Waitlist R2)
                    │
                    ▼
  ... continues for as many rounds as needed
```

### Round Rules

| Round   | Pool Source                      | Filters                | Skip Behavior                              |
|---------|----------------------------------|------------------------|--------------------------------------------|
| Round 1 | Full player list from file       | Skill level + Category | Moves player to Round 1 Waitlist           |
| Round N | Waitlist from Round N-1          | None (all mixed)       | Moves player to Round N Waitlist           |

### Key Design Decisions

1. **Per-round waitlists**: Each round has its own waitlist. This ensures skipped players get another chance in the next round, and players who are repeatedly skipped cascade through rounds rather than being lost.

2. **Waitlist transfer on skip**: When a player is skipped in Round N (N > 1), they are removed from the Round N-1 waitlist and added to the Round N waitlist. This prevents duplicates across waitlists.

3. **Waitlist transfer on select**: When a player is selected in Round N (N > 1), they are removed from the Round N-1 waitlist and added to the Selected list.

4. **Undo support**: Every action (select, skip) records the round it happened in. Undo reverses the exact waitlist transfers, restoring the player to the correct pool.

5. **Restore from waitlist**: Players can be manually restored from any round's waitlist back to the previous round's pool.

---

## Randomness

The app uses the **Web Crypto API** for fair, unbiased random selection:

- `crypto.getRandomValues()` for cryptographically secure random numbers
- **Rejection sampling** to avoid modulo bias when picking random integers
- **Fisher-Yates shuffle** for the slot machine reel display
- `pickRandom()` selects from the available pool with uniform probability

---

## State Persistence

All state is saved to `localStorage` under key `abl26-auction-state`:

```json
{
  "players": [...],
  "selectedIds": [0, 5, 12],
  "waitlists": {
    "1": [3, 7, 15],
    "2": [3],
    "3": []
  },
  "history": [...],
  "activeSkill": "Advanced",
  "activeCategory": "All",
  "round": 2,
  "auctionComplete": false
}
```

- State is saved on every change (debounce-free, synchronous)
- Page refresh or browser close preserves full auction state
- Backward-compatible: old `waitlistIds` format is automatically migrated to new `waitlists` format
- **New Auction** clears localStorage completely

---

## Component Responsibilities

| Component          | Responsibility                                                    |
|--------------------|-------------------------------------------------------------------|
| `App.jsx`          | State management, round logic, file upload, action handlers       |
| `SlotMachine.jsx`  | Animated reel display, spin/decelerate/stop phases, winner reveal |
| `PlayerTable.jsx`  | Pool list with status badges (POOL, PICKED, WAIT), per-round view|
| `SelectedPanel.jsx`| Selected players grouped by skill level                           |
| `WaitlistPanel.jsx`| Per-round waitlist display with restore-to-pool action            |

---

## Simulation Mode

The simulate feature auto-spins through the entire current pool:

1. Picks a random player from the pool
2. Spins the slot machine (2s animation)
3. Auto-selects the player (1.5s pause)
4. Repeats until pool is empty or stopped

Simulation respects round boundaries — it processes only the current round's pool.
