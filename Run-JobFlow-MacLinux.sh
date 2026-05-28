#!/bin/bash

# Define terminal colors for visual cues
GREEN='\033[0;32m'
BLUE='\033[0;34m'
AMBER='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================================${NC}"
echo -e "${BLUE}    __         __     ______ __     ______ _       _   _ _ ${NC}"
echo -e "${BLUE}   /  \\\       /  \\\   / _____/ \\\ \\\   / _____/ \\\     / / / / / ${NC}"
echo -e "${BLUE}  / /\\\ \\\     / /\\\ \\\ / /      \\\ \\\ \\\ / /      \\\ \\\   / / / / /  ${NC}"
echo -e "${BLUE} / /__\\\ \\\   / /__\\\ \\\ \\\ \\\      \\\ \\\ \\\ \\\ \\\      \\\ \\\ / / /_/_/   ${NC}"
echo -e "${BLUE}/_/    \\\_\ /_/    \\\_\ \\\_____/  \\\_/ \\\_____/    \\\___/ (_/_)    ${NC}"
echo -e "${BLUE}=======================================================================${NC}"
echo ""
echo -e "          ${AMBER}--- OPTION 2: STANDALONE PORTABLE WORKSPACE (MAC/LINUX) ---${NC}"
echo ""
echo "Initializing pre-flight environment checks..."
echo ""

# 1. Verifying Node.js presence
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js was not detected on your system.${NC}"
    echo "JobFlow requires Node.js (v18 or higher) to host the local Express backend,"
    echo "parse incoming recruiter emails, and interact with the Gemini AI model."
    echo ""
    echo "Opening Node.js official download page..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://nodejs.org/"
    else
        xdg-open "https://nodejs.org/" || echo "Please visit https://nodejs.org to download Node.js."
    fi
    exit 1
fi

echo -e "${GREEN}[SUCCESS] Node.js environment detected:${NC}"
node -v
echo ""

# 2. Verifying and staging local secrets environmental file
if [ ! -f .env ]; then
    echo -e "${BLUE}[INFO] Local .env parameters file missing. Cloning from template...${NC}"
    cp .env.example .env
    echo ""
    echo -e "${AMBER}==================================================================${NC}"
    echo -e "${RED}!! ACTION REQUIRED: GEMINI API KEY CONFIGURATION !!${NC}"
    echo ""
    echo "A clean '.env' file has been created in this folder root."
    echo "To allow AI-tailoring and critique, open '.env' in your editor and write:"
    echo "GEMINI_API_KEY=your_actual_api_key_here"
    echo -e "${AMBER}==================================================================${NC}"
    echo ""
    sleep 3
fi

# 3. Provisioning Node modules if absent
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}[INFO] Modules folder empty. Installing dependencies...${NC}"
    echo -e "${AMBER}(This may take up to 2 minutes on the first run; please wait)${NC}"
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Dependency installation failed.${NC}"
        echo "Please verify internet connection and run 'npm install' manually inside this folder."
        exit 1
    fi
    echo -e "${GREEN}[SUCCESS] Node packages successfully configured.${NC}"
fi

# 4. Starting browser and core server process
echo -e "${BLUE}[INFO] Launching local browser segment...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000"
else
    xdg-open "http://localhost:3000" &> /dev/null || echo "Please open http://localhost:3000 in your browser."
fi

echo -e "${GREEN}[SUCCESS] Starting core server on standard Port 3000...${NC}"
echo "Press [Ctrl + C] anytime inside this terminal window to stop the local thread."
echo ""
echo -e "${BLUE}=======================================================================${NC}"
echo ""

npm run dev
