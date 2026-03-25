# User Guide — Random Player Auction

## Getting Started

When you first open the app, you'll see the **upload screen** with the ABL banner. You need to upload a player file to begin.

---

## Step 1: Prepare Your Player File

Create a `.csv`, `.xlsx`, or `.xls` file with the following columns:

| Column | Required | Example Values |
|--------|----------|----------------|
| `Full Name` | Yes | `John Doe` |
| `Self-Assessed Skill Rating (Our Society level)` | Yes | `Advanced`, `Intermediate +`, `Intermediate`, `Beginner` |
| `Category` | No | `Mens (Age 18+ and above)`, `Womens`, `Kids (Age 10-18 years)`, `Kids (Upto 10 years)` |
| `Flat number` | No | `A-101` |

You can also click **Download Template CSV** on the upload screen to get a sample file with the correct headers.

---

## Step 2: Upload Players

1. Click **Choose File** on the upload screen
2. Select your player file
3. The app loads all players and takes you to the auction screen

You can also re-upload a file anytime using the **Load File** button in the header.

---

## Step 3: Round 1 — Skill-Based Auction

Round 1 lets you pick players filtered by skill level and category.

### Filter Players

- **Category tabs** (top row): All, Mens, Womens, Kids 10-18, Kids <10
- **Skill tabs** (second row): Advanced, Intermediate+, Intermediate, Beginner
- Each tab shows `(selected/total)` count

### Spin & Pick

1. Click **SPIN** — the slot machine animates and lands on a random player
2. Review the player shown
3. Choose an action:

| Button | What it does |
|--------|-------------|
| **SELECT** | Confirms the player — added to the Selected Players list |
| **SKIP** | Sends the player to Round 1 Waitlist — they'll be available in Round 2 |
| **UNDO** | Reverses the last action (select or skip) |

4. Repeat for all skill levels and categories

### Screen Layout

| Panel | Position | Content |
|-------|----------|---------|
| Player Pool | Left | All players in current skill/category with status |
| Slot Machine | Center | Spin controls, action buttons |
| Selected Players | Right (top) | Players picked so far, grouped by skill |
| Waitlist | Right (bottom) | Players skipped, shown per round |

### Status Badges in Player Pool

| Badge | Meaning |
|-------|---------|
| **POOL** | Available for selection |
| **PICKED** | Already selected |
| **WAIT** | Skipped to waitlist |

---

## Step 4: Start Next Round

Once you've skipped some players, a button appears:

**Start Round 2 (X in waitlist)**

Click it to begin Round 2.

### How Rounds Work

```
Round 1  →  Skip players  →  Round 1 Waitlist
                                    ↓
Round 2  (pool = Round 1 Waitlist, all skills mixed)
         →  Select = picked
         →  Skip   = moved to Round 2 Waitlist
                                    ↓
Round 3  (pool = Round 2 Waitlist, all skills mixed)
         →  Select = picked
         →  Skip   = moved to Round 3 Waitlist
                                    ↓
         ... continues as needed
```

**Key points:**
- Round 1 filters by skill level and category
- Round 2+ pools contain ALL skill levels mixed together
- Skipping in any round moves the player to the next round's waitlist
- You can always go **Back to Round N-1** using the link at the top
- Each round's waitlist is shown separately in the right panel

---

## Step 5: Simulation Mode

Don't want to manually spin each player? Use simulation:

1. Click **Simulate Round N** — auto-spins through the entire pool
2. Each player is automatically **selected** after a brief pause
3. Click **Stop Simulation** anytime to halt and take manual control

Simulation only processes the current round's pool. Switch rounds to simulate different pools.

---

## Step 6: Complete Auction

When you're done selecting:

1. Click **Complete Auction**
2. Confirm in the dialog
3. View the summary screen showing:
   - Total selected, waitlisted, and total player counts
   - All selected players grouped by skill level

From the summary screen:
- **Back to Auction** — return to make more changes
- **New Auction** — clear everything and start fresh

---

## Managing Waitlists

### Viewing Waitlists

The right panel shows a separate waitlist card for each round:
- **Round 1 Waitlist** — players skipped in Round 1
- **Round 2 Waitlist** — players skipped in Round 2
- And so on...

### Restoring a Player from Waitlist

Hover over any player in a waitlist and click the **restore icon** (circular arrow). This moves them back to the previous pool:
- Restoring from Round 1 Waitlist → back to Round 1 pool
- Restoring from Round 2 Waitlist → back to Round 1 Waitlist (Round 2 pool)

---

## Other Controls

| Button | Location | Action |
|--------|----------|--------|
| **Load File** | Header | Upload a new player file (replaces current) |
| **Home** | Header | Clear everything and return to upload screen |
| **RESET** | Center panel | Clear all selections and waitlists, stay on Round 1 |
| **UNDO** | Center panel | Reverse the last action |

---

## Header Status Bar

The header shows live stats:

| Indicator | Color | Meaning |
|-----------|-------|---------|
| Round N | Gray/Magenta | Current round number |
| Player count | Green | Total players loaded |
| Selected count | Cyan | Total players selected |
| Waitlist count | Yellow | Total players across all waitlists |

---

## Data Persistence

- All progress is **automatically saved** in your browser
- Refreshing the page or closing the tab **preserves your state**
- Progress is stored per-browser (not synced across devices)
- To fully reset: click **Home** → **New Auction**, or clear browser localStorage

---

## Tips

1. **Work through skill levels systematically** — complete one skill level before moving to the next
2. **Use categories** to focus on specific groups (Mens, Womens, Kids)
3. **Don't worry about mistakes** — UNDO reverses any action
4. **Skipped players always get another chance** — they cascade through rounds
5. **Simulate for speed** — use simulation when you want to auto-select an entire pool
6. **Multiple rounds are flexible** — you can go back to previous rounds anytime
