#!/bin/bash

###############################################################################
# E2E Testing Script for Second Brain OS
# 
# This script automates the complete E2E testing workflow:
# 1. Pre-flight checks
# 2. Build the application
# 3. Run Playwright E2E tests
# 4. Generate and open test reports
# 5. Clean up and error handling
#
# Usage:
#   ./scripts/run-e2e-tests.sh [options]
#
# Options:
#   --ui          Run tests in UI mode (interactive, recommended for debugging)
#   --headed      Run tests in headed mode (show Electron window)
#   --debug       Run tests in debug mode (step through tests)
#   --specific    Run specific test file (e.g., --specific session-management)
#   --skip-build  Skip the build step (use existing build)
#   --no-report   Don't open the HTML report after tests
#   --help        Show this help message
#
# Examples:
#   ./scripts/run-e2e-tests.sh                    # Run all tests (headless)
#   ./scripts/run-e2e-tests.sh --ui               # Run with Playwright UI
#   ./scripts/run-e2e-tests.sh --headed           # Show Electron window
#   ./scripts/run-e2e-tests.sh --specific session # Run only session tests
#   ./scripts/run-e2e-tests.sh --skip-build       # Skip build, run tests
#
###############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Script configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$PROJECT_ROOT/test-results/e2e-test-$TIMESTAMP.log"

# Default options
RUN_UI_MODE=false
RUN_HEADED=false
RUN_DEBUG=false
SKIP_BUILD=false
OPEN_REPORT=true
SPECIFIC_TEST=""

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BOLD}${CYAN}========================================${NC}"
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo -e "${BOLD}${CYAN}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "${MAGENTA}▶${NC} $1"
}

show_help() {
    cat << EOF
${BOLD}E2E Testing Script for Second Brain OS${NC}

${BOLD}Usage:${NC}
  ./scripts/run-e2e-tests.sh [options]

${BOLD}Options:${NC}
  --ui          Run tests in UI mode (interactive, recommended for debugging)
  --headed      Run tests in headed mode (show Electron window)
  --debug       Run tests in debug mode (step through tests)
  --specific    Run specific test file (e.g., --specific session-management)
  --skip-build  Skip the build step (use existing build)
  --no-report   Don't open the HTML report after tests
  --help        Show this help message

${BOLD}Examples:${NC}
  ./scripts/run-e2e-tests.sh                    # Run all tests (headless)
  ./scripts/run-e2e-tests.sh --ui               # Run with Playwright UI
  ./scripts/run-e2e-tests.sh --headed           # Show Electron window
  ./scripts/run-e2e-tests.sh --specific session # Run only session tests
  ./scripts/run-e2e-tests.sh --skip-build       # Skip build, run tests

${BOLD}Test Suites Available:${NC}
  - session-management  (8 tests)  - Session creation, switching, deletion
  - terminal-settings   (9 tests)  - Terminal themes, fonts, settings
  - navigation-resize   (9 tests)  - Panel resizing, width constraints
  - tab-management      (11 tests) - Tab creation, switching, drag-and-drop

EOF
    exit 0
}

###############################################################################
# Parse Command Line Arguments
###############################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --ui)
            RUN_UI_MODE=true
            shift
            ;;
        --headed)
            RUN_HEADED=true
            shift
            ;;
        --debug)
            RUN_DEBUG=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-report)
            OPEN_REPORT=false
            shift
            ;;
        --specific)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

###############################################################################
# Main Script
###############################################################################

cd "$PROJECT_ROOT"

print_header "E2E Testing Script - Second Brain OS"

print_info "Project Root: $PROJECT_ROOT"
print_info "Timestamp: $TIMESTAMP"
print_info "Log File: $LOG_FILE"
echo ""

# Create test-results directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/test-results"

# Start logging
exec > >(tee -a "$LOG_FILE")
exec 2>&1

###############################################################################
# Step 1: Pre-flight Checks
###############################################################################

print_header "Step 1: Pre-flight Checks"

print_step "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

print_step "Checking npm version..."
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
NPM_VERSION=$(npm --version)
print_success "npm version: $NPM_VERSION"

print_step "Checking if node_modules exists..."
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
    print_success "Dependencies installed"
else
    print_success "node_modules exists"
fi

print_step "Checking Playwright installation..."
if ! npm list @playwright/test &> /dev/null; then
    print_error "Playwright is not installed"
    print_info "Installing Playwright..."
    npm install --save-dev @playwright/test
    npx playwright install
    print_success "Playwright installed"
else
    print_success "Playwright is installed"
fi

###############################################################################
# Step 2: Build Application (unless --skip-build)
###############################################################################

if [ "$SKIP_BUILD" = false ]; then
    print_header "Step 2: Building Application"
    
    print_step "Running: npm run build"
    
    if npm run build; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
    
    print_step "Verifying build output..."
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        print_error "Build output (dist/) is missing or incomplete"
        exit 1
    fi
    print_success "Build output verified"
else
    print_header "Step 2: Skipping Build"
    print_warning "Using existing build (--skip-build flag)"
    
    print_step "Verifying existing build..."
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        print_error "No existing build found in dist/"
        print_info "Remove --skip-build flag to build the application"
        exit 1
    fi
    print_success "Existing build found"
fi

###############################################################################
# Step 3: Run E2E Tests
###############################################################################

print_header "Step 3: Running E2E Tests"

# Build the test command based on options
TEST_COMMAND="npx playwright test"

if [ "$RUN_UI_MODE" = true ]; then
    print_info "Running in UI mode (interactive)"
    TEST_COMMAND="$TEST_COMMAND --ui"
elif [ "$RUN_DEBUG" = true ]; then
    print_info "Running in debug mode"
    TEST_COMMAND="$TEST_COMMAND --debug"
elif [ "$RUN_HEADED" = true ]; then
    print_info "Running in headed mode"
    TEST_COMMAND="$TEST_COMMAND --headed"
else
    print_info "Running in headless mode"
fi

# Add specific test file if specified
if [ -n "$SPECIFIC_TEST" ]; then
    print_info "Running specific test: $SPECIFIC_TEST"
    TEST_COMMAND="$TEST_COMMAND test/e2e/${SPECIFIC_TEST}.spec.ts"
fi

print_step "Executing: $TEST_COMMAND"
echo ""

# Run the tests
TEST_EXIT_CODE=0
if ! eval "$TEST_COMMAND"; then
    TEST_EXIT_CODE=$?
    print_error "Tests failed with exit code: $TEST_EXIT_CODE"
else
    print_success "All tests passed!"
fi

###############################################################################
# Step 4: Generate Test Report Summary
###############################################################################

print_header "Step 4: Test Results Summary"

# Check if results file exists
RESULTS_FILE="$PROJECT_ROOT/test-results/results.json"
if [ -f "$RESULTS_FILE" ]; then
    print_success "Test results saved to: $RESULTS_FILE"
    
    # Parse results (basic summary - requires jq for detailed parsing)
    if command -v jq &> /dev/null; then
        TOTAL_TESTS=$(jq '.suites[].specs | length' "$RESULTS_FILE" 2>/dev/null | awk '{s+=$1} END {print s}')
        print_info "Total tests executed: ${TOTAL_TESTS:-N/A}"
    fi
else
    print_warning "Results file not found"
fi

# Check for screenshots/videos (failures)
if [ -d "$PROJECT_ROOT/test-results" ]; then
    SCREENSHOT_COUNT=$(find "$PROJECT_ROOT/test-results" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
    VIDEO_COUNT=$(find "$PROJECT_ROOT/test-results" -name "*.webm" 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$SCREENSHOT_COUNT" -gt 0 ]; then
        print_warning "Screenshots captured: $SCREENSHOT_COUNT (indicates test failures)"
    fi
    
    if [ "$VIDEO_COUNT" -gt 0 ]; then
        print_warning "Videos recorded: $VIDEO_COUNT (indicates test failures)"
    fi
fi

###############################################################################
# Step 5: Open Test Report
###############################################################################

if [ "$OPEN_REPORT" = true ] && [ "$RUN_UI_MODE" = false ]; then
    print_header "Step 5: Opening Test Report"
    
    REPORT_FILE="$PROJECT_ROOT/playwright-report/index.html"
    
    if [ -f "$REPORT_FILE" ]; then
        print_step "Opening HTML report..."
        
        # Open report in default browser (OS-specific)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            open "$REPORT_FILE"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            xdg-open "$REPORT_FILE" &> /dev/null || sensible-browser "$REPORT_FILE" &> /dev/null
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            # Windows
            start "$REPORT_FILE"
        fi
        
        print_success "Test report opened in browser"
        print_info "Report location: $REPORT_FILE"
    else
        print_warning "HTML report not found"
        print_info "You can generate it manually with: npx playwright show-report"
    fi
fi

###############################################################################
# Final Summary
###############################################################################

print_header "Execution Complete"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All E2E tests passed! ✨"
    echo ""
    print_info "Next steps:"
    echo "  - Review the HTML report for detailed results"
    echo "  - Commit your changes if everything looks good"
    echo "  - Push to GitHub to trigger CI/CD pipeline"
else
    print_error "Some tests failed. Please review the errors above."
    echo ""
    print_info "Debugging tips:"
    echo "  - Run with --ui to see tests interactively: ./scripts/run-e2e-tests.sh --ui"
    echo "  - Run with --debug to step through tests: ./scripts/run-e2e-tests.sh --debug"
    echo "  - Run with --headed to see Electron window: ./scripts/run-e2e-tests.sh --headed"
    echo "  - Check screenshots in test-results/ directory"
    echo "  - View HTML report: open playwright-report/index.html"
fi

echo ""
print_info "Log file saved to: $LOG_FILE"
echo ""

exit $TEST_EXIT_CODE
