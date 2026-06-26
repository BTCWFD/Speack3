# Milestone 1 Synthesis: Environment & Strategy Analysis

## Consensus
- **Tech Stack**: Python + Playwright is the recommended framework.
  - Python 3.12.10 is pre-installed at `C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe`.
  - Python package `playwright` (v1.58.0) is pre-installed.
  - Playwright Chromium browser binaries are pre-downloaded at `C:\Users\USER\AppData\Local\ms-playwright\chromium-1208`.
- **Target Directory**: `C:\Users\USER\teamwork_projects\oracle_signup` has been successfully created.
- **Oracle Cloud registration entrypoint**: `https://signup.cloud.oracle.com/` (direct form page).
- **Pause & Handoff Strategy**:
  - The script will launch a non-headless browser session.
  - A hybrid console block (`input(...)` in Python) combined with a dashboard URL wait (e.g. `page.wait_for_url("**/dashboard/**")` or matching standard post-registration selectors) will be used to yield control to the user.

## Resolved Conflicts
- **Python vs Node**: While Node.js Playwright was considered, Python + Playwright has all library and browser binaries already installed and ready, making it the most resilient option.

## Gaps & Risk Mitigations
- **Bot Detection / CAPTCHAs**: Oracle uses hCaptcha on registration.
  - *Mitigation*: The browser must run in non-headless mode, and the script must type key inputs with realistic delays (e.g., `delay=100` ms) and wait for the user to solve any CAPTCHAs manually.
- **Email Verification Link**: Clicking the email verification link from the user's email client will open in their default system browser, losing the automation session.
  - *Mitigation*: Instructions printed to the console will tell the user to copy the verification link and paste it directly into the automated browser window.
