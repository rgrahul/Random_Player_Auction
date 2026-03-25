#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=================================${NC}"
echo -e "${CYAN}  ABL 26 - Player Auction        ${NC}"
echo -e "${CYAN}=================================${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed.${NC}"
    echo ""
    echo "Install it from: https://nodejs.org (v18+ required)"
    echo ""
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo "  Windows: Download from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js v18+ required. Found: $(node -v)${NC}"
    echo "Please upgrade: https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}Node.js $(node -v) detected${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Choose mode
MODE="${1:-dev}"

if [ "$MODE" = "preview" ] || [ "$MODE" = "prod" ]; then
    echo -e "${YELLOW}Building for production...${NC}"
    npm run build
    echo ""
    echo -e "${GREEN}Starting preview server...${NC}"
    echo -e "${CYAN}Open the URL shown below in your browser${NC}"
    echo ""
    npx vite preview --host
else
    echo -e "${GREEN}Starting development server...${NC}"
    echo -e "${CYAN}Open the URL shown below in your browser${NC}"
    echo ""
    npx vite --host
fi
