# Testing Scripts

This directory contains automated testing scripts for Second Brain OS.

## Available Scripts

### 1. `run-e2e-tests.sh` - Complete E2E Testing Script

Full-featured script with pre-flight checks, build automation, and comprehensive test execution.

#### Basic Usage

```bash
# Run all E2E tests (headless mode)
./scripts/run-e2e-tests.sh

# Run with Playwright UI (recommended for first run)
./scripts/run-e2e-tests.sh --ui

# Run with Electron window visible
./scripts/run-e2e-tests.sh --headed

# Debug mode (step through tests)
./scripts/run-e2e-tests.sh --debug
```

#### Advanced Options

```bash
# Run specific test suite
./scripts/run-e2e-tests.sh --specific session-management
./scripts/run-e2e-tests.sh --specific terminal-settings
./scripts/run-e2e-tests.sh --specific navigation-resize
./scripts/run-e2e-tests.sh --specific tab-management

# Skip build step (use existing build)
./scripts/run-e2e-tests.sh --skip-build

# Don't open HTML report after tests
./scripts/run-e2e-tests.sh --no-report

# Combine options
./scripts/run-e2e-tests.sh --skip-build --specific session-management
```

#### What It Does

1. **Pre-flight Checks**
   - Verifies Node.js and npm installation
   - Checks for required dependencies
   - Ensures Playwright is installed

2. **Build Application**
   - Runs `npm run build` (unless `--skip-build`)
   - Verifies build output exists
   - Creates production bundle

3. **Run Tests**
   - Executes Playwright E2E tests
   - Captures screenshots on failure
   - Records videos on failure
   - Generates detailed test reports

4. **Generate Reports**
   - Creates HTML report
   - Generates JSON results
   - Opens report in browser automatically
   - Provides test summary

5. **Logging**
   - Saves detailed logs to `test-results/`
   - Timestamps all output
   - Preserves error traces

---

### 2. `quick-test.sh` - Fast Test Suite

Simplified script that runs unit tests, builds, and E2E tests in sequence.

#### Usage

```bash
./scripts/quick-test.sh
```

#### What It Does

1. Runs all unit tests (`npm run test:unit`)
2. Builds the application (`npm run build`)
3. Runs all E2E tests (`npm run test:e2e`)
4. Shows summary of results

Perfect for quick verification before committing code.

---

## Test Suites Overview

### Available E2E Test Suites

| Suite                | Tests | Description                                    |
|----------------------|-------|------------------------------------------------|
| `session-management` | 8     | Session creation, switching, renaming, deletion|
| `terminal-settings`  | 9     | Terminal themes, fonts, settings persistence   |
| `navigation-resize`  | 9     | Panel resizing, width constraints              |
| `tab-management`     | 11    | Tab creation, switching, drag-and-drop         |

**Total: 37 E2E Tests**

---

## Output and Reports

### Test Results Location

```
test-results/
├── results.json                    # JSON test results
├── e2e-test-YYYY-MM-DD_HH-MM-SS.log # Execution log
└── [on failure]
    ├── screenshot-*.png            # Failure screenshots
    └── video-*.webm                # Failure videos
```

### HTML Report

```
playwright-report/
└── index.html                      # Interactive test report
```

**Open report manually:**
```bash
npx playwright show-report
```

---

## Troubleshooting

### Common Issues

#### 1. Script Permission Denied

```bash
chmod +x scripts/run-e2e-tests.sh
chmod +x scripts/quick-test.sh
```

#### 2. Playwright Not Installed

The script will automatically install Playwright if missing, but you can also install manually:

```bash
npm install --save-dev @playwright/test
npx playwright install
```

#### 3. Build Failures

Ensure all dependencies are installed:
```bash
npm install
npm run build
```

#### 4. Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 90 * 1000, // 90 seconds
```

#### 5. Electron Won't Launch

- Check if `electron/main.cjs` exists
- Verify Node.js version (requires 18.x or 20.x)
- Try running manually: `npm start`

---

## Debugging E2E Tests

### Method 1: UI Mode (Recommended)

```bash
./scripts/run-e2e-tests.sh --ui
```

- Visual test execution
- Pause and step through tests
- Inspect DOM at any point
- Time travel debugging

### Method 2: Debug Mode

```bash
./scripts/run-e2e-tests.sh --debug
```

- Opens Playwright Inspector
- Breakpoint support
- Console logging
- Step-by-step execution

### Method 3: Headed Mode

```bash
./scripts/run-e2e-tests.sh --headed
```

- Shows Electron window during tests
- Useful for visual debugging
- Watch tests in real-time

### Method 4: Run Specific Test

```bash
# Run single test suite
./scripts/run-e2e-tests.sh --specific session-management --ui

# Run specific test case
npx playwright test -g "should create a new session"
```

---

## CI/CD Integration

These scripts are integrated with GitHub Actions:

### Workflows

1. **`.github/workflows/test.yml`** - Main test suite
   - Runs on push to main/master/develop
   - Matrix: Ubuntu/macOS × Node 18.x/20.x
   - Uploads coverage to Codecov

2. **`.github/workflows/pr-check.yml`** - PR quick check
   - Runs unit tests on PRs
   - Fast feedback (~1 minute)
   - Auto-comments results

### Run CI Tests Locally

```bash
# Full CI test suite
npm run test:ci

# This runs:
# 1. Unit tests with coverage
# 2. E2E tests (headless)
```

---

## Performance

### Expected Execution Times

| Command                      | Duration | Description           |
|------------------------------|----------|-----------------------|
| `npm run test:unit`          | ~2s      | Unit tests only       |
| `npm run build`              | ~10s     | Vite production build |
| `npm run test:e2e`           | ~2-3m    | All E2E tests         |
| `./scripts/quick-test.sh`    | ~3m      | Full test suite       |
| `./scripts/run-e2e-tests.sh` | ~2-3m    | E2E with reporting    |

*Times may vary based on system performance*

---

## Best Practices

### Before Committing

```bash
# Run quick test suite
./scripts/quick-test.sh

# Or run comprehensive tests
npm run test:all
```

### When Adding New Features

```bash
# Run specific test suite
./scripts/run-e2e-tests.sh --specific <suite-name> --ui

# Watch tests in real-time
./scripts/run-e2e-tests.sh --headed
```

### When Tests Fail

```bash
# Debug with UI
./scripts/run-e2e-tests.sh --ui

# Check screenshots
open test-results/*.png

# View HTML report
npx playwright show-report
```

### Before Pushing to GitHub

```bash
# Full test suite with coverage
npm run test:ci

# Ensure everything passes before pushing
```

---

## Contributing

When adding new E2E tests:

1. Add test file to `test/e2e/`
2. Follow naming convention: `feature-name.spec.ts`
3. Use helper functions from `test/e2e/helpers/electron.ts`
4. Update this README with new test suite info
5. Run tests locally with `--ui` mode first
6. Ensure tests pass in headless mode

---

## Help and Support

```bash
# Show help for main script
./scripts/run-e2e-tests.sh --help

# View Playwright documentation
open https://playwright.dev/docs/intro

# Check test status in GitHub Actions
open https://github.com/rentiansheng/ri/actions
```

---

## Quick Reference

```bash
# Unit tests
npm run test:unit          # Run once
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage

# E2E tests
npm run test:e2e           # Headless
npm run test:e2e:ui        # UI mode
npm run test:e2e:debug     # Debug mode

# All tests
npm run test:all           # Unit + E2E
npm run test:ci            # CI mode (coverage + E2E)

# Scripts
./scripts/run-e2e-tests.sh           # Full E2E with reporting
./scripts/run-e2e-tests.sh --ui      # Interactive mode
./scripts/run-e2e-tests.sh --help    # Show help
./scripts/quick-test.sh              # Quick full suite
```

---

**Made with ❤️ for Second Brain OS**
