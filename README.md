# ABL 26 - Random Player Auction

A React-based player auction app with a slot machine UI for randomly selecting players from skill-based pools. Built for badminton league tournaments with neon dark-mode visuals and smooth animations.

- [Design Document](docs/DESIGN.md)
- [Installation Guide](docs/INSTALLATION.md)
- [User Guide](docs/USER_GUIDE.md)

---

## Quick Start

```bash
cd Random_Player_Auction
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## File Format

Upload a `.csv`, `.xlsx`, or `.xls` file with these columns:

| Column | Required | Values |
|--------|----------|--------|
| `Full Name` | Yes | Player name |
| `Self-Assessed Skill Rating (Our Society level)` | Yes | `Advanced`, `Intermediate +`, `Intermediate`, `Beginner` |
| `Category` | No | `Mens (Age 18+ and above)`, `Womens`, `Kids (Age 10-18 years)`, `Kids (Upto 10 years)` |
| `Flat number` | No | Flat/unit number |

```csv
Full Name,Category,Self-Assessed Skill Rating (Our Society level)
John Doe,Mens (Age 18+ and above),Advanced
Jane Smith,Womens,Intermediate +
Alex Kumar,Mens (Age 18+ and above),Intermediate
Sam Wilson,Kids (Age 10-18 years),Beginner
```
