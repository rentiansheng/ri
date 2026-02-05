#!/bin/bash

###############################################################################
# Quick Test Script - Run All Tests (Unit + E2E)
#
# This is a simplified script that runs both unit and E2E tests
# Perfect for quick verification before committing
#
# Usage:
#   ./scripts/quick-test.sh
#
###############################################################################

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}${BLUE}=====================================${NC}"
echo -e "${BOLD}${BLUE}   Quick Test Suite${NC}"
echo -e "${BOLD}${BLUE}=====================================${NC}\n"

###############################################################################
# Step 1: Unit Tests
###############################################################################

echo -e "${BOLD}Step 1: Running Unit Tests...${NC}\n"

if npm run test:unit; then
    echo -e "\n${GREEN}✓ Unit tests passed!${NC}\n"
else
    echo -e "\n${RED}✗ Unit tests failed!${NC}\n"
    exit 1
fi

###############################################################################
# Step 2: Build Application
###############################################################################

echo -e "${BOLD}Step 2: Building Application...${NC}\n"

if npm run build; then
    echo -e "\n${GREEN}✓ Build successful!${NC}\n"
else
    echo -e "\n${RED}✗ Build failed!${NC}\n"
    exit 1
fi

###############################################################################
# Step 3: E2E Tests
###############################################################################

echo -e "${BOLD}Step 3: Running E2E Tests...${NC}\n"

if npm run test:e2e; then
    echo -e "\n${GREEN}✓ E2E tests passed!${NC}\n"
else
    echo -e "\n${RED}✗ E2E tests failed!${NC}\n"
    echo -e "${YELLOW}Run './scripts/run-e2e-tests.sh --ui' to debug${NC}\n"
    exit 1
fi

###############################################################################
# Success!
###############################################################################

echo -e "${BOLD}${GREEN}=====================================${NC}"
echo -e "${BOLD}${GREEN}   All Tests Passed! ✨${NC}"
echo -e "${BOLD}${GREEN}=====================================${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review test reports"
echo "  2. Commit your changes"
echo "  3. Push to GitHub"
echo ""

exit 0
