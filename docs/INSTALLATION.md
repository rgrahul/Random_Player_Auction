# Installation Guide — Random Player Auction

## Prerequisites

| Requirement | Version | Check Command         |
|-------------|---------|------------------------|
| Node.js     | v18+    | `node --version`       |
| npm         | v9+     | `npm --version`        |
| Browser     | Modern  | Chrome, Firefox, Safari, Edge |

Download Node.js from [https://nodejs.org](https://nodejs.org) if not installed.

---

## Option 1: Quick Start (Recommended)

### macOS / Linux

```bash
cd Random_Player_Auction
chmod +x start.sh
./start.sh
```

### Windows

Double-click `start.bat` or run:

```cmd
cd Random_Player_Auction
start.bat
```

The script will:
1. Verify Node.js is installed
2. Install dependencies (`npm install`)
3. Start the dev server
4. Print a URL to open (default: `http://localhost:5173`)

---

## Option 2: Manual Setup

### 1. Clone or copy the project

```bash
git clone https://github.com/rgrahul/Random_Player_Auction.git
cd Random_Player_Auction
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. Build for production

```bash
npm run build
```

This creates an optimized `dist/` folder.

### 5. Preview production build locally

```bash
npm run preview
```

Opens at `http://localhost:4173`.

---

## Deployment Options

### Static Hosting (Vercel)

```bash
npm i -g vercel
npm run build
vercel --prod
```

### Static Hosting (Netlify)

```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages

1. Edit `vite.config.js` — add the base path:

```js
export default defineConfig({
  base: '/Random_Player_Auction/',
  plugins: [react(), tailwindcss()],
})
```

2. Build and deploy:

```bash
npm run build
# Deploy the dist/ folder to gh-pages branch
npx gh-pages -d dist
```

### Docker

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Build and run:

```bash
docker build -t player-auction .
docker run -p 8080:80 player-auction
```

Open `http://localhost:8080`.

### Self-Hosted (Nginx)

```bash
npm run build
```

Nginx config:

```nginx
server {
    listen 80;
    server_name auction.example.com;
    root /path/to/Random_Player_Auction/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Available Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start development server with hot reload |
| `npm run build`   | Build optimized production bundle        |
| `npm run preview` | Serve production build locally           |
| `npm run lint`    | Run ESLint on source files               |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `node: command not found` | Install Node.js from [nodejs.org](https://nodejs.org) |
| Port 5173 in use | Kill the process using it: `lsof -ti:5173 \| xargs kill` |
| Old state after update | Clear localStorage: open browser DevTools → Application → Local Storage → delete `abl26-auction-state` |
| Blank screen after build | Ensure `base` in `vite.config.js` matches your deploy path |
| File upload not working | Ensure CSV has exact column headers: `Full Name` and `Self-Assessed Skill Rating (Our Society level)` |
