# Handoff Report — Oracle Form Explorer

## 1. Observation
- We analyzed the project files in the workspace and found that `deploy/DEPLOY_ORACLE.md` references the signup URL:
  - Line 18: `1. Crea cuenta en https://www.oracle.com/cloud/free/ (pide tarjeta solo para`
- We conducted a recursive search across the workspace directories (`server/`, `mobile/`, `scripts/`, etc.) and confirmed that no existing browser automation scripts or packages (Selenium, Playwright, Puppeteer) are present. This indicates a greenfield implementation for Oracle signup automation.
- In the `.agents/` metadata directory:
  - `explorer_m1_1` is responsible for checking host runtimes (Python, Node.js) and installed browsers.
  - `explorer_m1_3` is responsible for exploring browser session pause/handover strategies.

## 2. Logic Chain
- **Signup URL Recommendation**:
  - The marketing landing page `https://www.oracle.com/cloud/free/` contains a CTA button that redirects to the registration form.
  - The actual form application resides at `https://signup.cloud.oracle.com/`. Navigating directly to this URL is faster and eliminates the need to script landing-page navigation (which can change or involve intermediate marketing tracking redirects).
- **First Page Fields & Selectors**:
  - The first page of the Oracle Cloud registration form gathers basic non-sensitive details before triggering email verification.
  - Based on Oracle Cloud registration form structure (built on Oracle Jet / React-based single-page application layout), the HTML elements and their robust CSS selectors are:
    1. **Country/Territory Select Dropdown**:
       - Element type: `<select>` (or interactive combobox containing options)
       - Primary Selectors: `select#country`, `select[name="country"]`, `select[id="country"]`
    2. **First Name Input**:
       - Element type: `<input>` (text type)
       - Primary Selectors: `input#firstName`, `input[name="firstName"]`, `input[id="firstName"]`
    3. **Last Name Input**:
       - Element type: `<input>` (text type)
       - Primary Selectors: `input#lastName`, `input[name="lastName"]`, `input[id="lastName"]`
    4. **Email Input**:
       - Element type: `<input>` (email/text type)
       - Primary Selectors: `input#email`, `input[name="email"]`, `input[id="email"]`
    5. **"Verify My Email" / Next Button**:
       - Element type: `<button>` (submit type)
       - Primary Selectors: `button[type="submit"]`, `button#submit`, `button[id="submit"]`
       - Text-based selector (Playwright): `button:has-text("Verify My Email")`
       - XPath-based selector (Selenium): `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'verify my email')]`

- **Non-Headless Browser Launch Components**:
  To support the user-pause strategy (necessary for solving CAPTCHAs, verifying email links, and entering billing info), the automation script must spin up a non-headless browser session.
  
  **Python Automation Stack**:
  - **Option A: Playwright (Python)**
    - *Required packages*: `playwright` (via `pip install playwright`)
    - *Required binaries*: Browser binaries (Chromium, Firefox, or WebKit) installed via `playwright install`.
    - *Launch configuration*: `p.chromium.launch(headless=False)` or `p.firefox.launch(headless=False)`.
  - **Option B: Selenium (Python)**
    - *Required packages*: `selenium` (via `pip install selenium`), `webdriver-manager` (via `pip install webdriver-manager` to manage webdrivers dynamically).
    - *Required binaries*: A compatible browser installed on the host (Chrome, Firefox, or Edge) and the corresponding webdriver executable.
    - *Launch configuration*: `webdriver.Chrome()` or `webdriver.Firefox()` (launches in non-headless mode by default).

  **Node.js Automation Stack**:
  - **Option A: Playwright (Node.js)**
    - *Required packages*: `playwright` (via `npm install playwright`)
    - *Required binaries*: Browser binaries installed via `npx playwright install`.
    - *Launch configuration*: `chromium.launch({ headless: false })`.
  - **Option B: Puppeteer (Node.js)**
    - *Required packages*: `puppeteer` (via `npm install puppeteer` - downloads compatible Chromium automatically).
    - *Required binaries*: Bundled Chromium binary.
    - *Launch configuration*: `puppeteer.launch({ headless: false })`.
  - **Option C: Selenium (Node.js)**
    - *Required packages*: `selenium-webdriver` (via `npm install selenium-webdriver`).
    - *Required binaries*: Installed browser and driver executable.
    - *Launch configuration*: `new Builder().forBrowser('chrome').build()` (non-headless by default).

## 3. Caveats
- **Live Selector Verification**: Because the agent operates in `CODE_ONLY` network mode, we cannot connect to the live Oracle Cloud signup page to inspect the DOM directly. The selectors recommended are based on Oracle's standard, long-running form conventions. The implementing agent must verify these selectors against the live page DOM.
- **Bot Detection & Captchas**: Oracle Cloud uses advanced bot-detection systems (e.g., hCaptcha). Even in non-headless mode, automated typing and navigation can trigger security checks. Slowing down keypresses (typing delay) and letting the user interact with the form directly is recommended.

## 4. Conclusion
- We recommend using **`https://signup.cloud.oracle.com/`** as the precise signup URL.
- The registration flow on the first page contains: **Country**, **First Name**, **Last Name**, and **Email**, followed by a CAPTCHA and the **"Verify My Email"** button.
- Both Python (Playwright / Selenium) and Node.js (Playwright / Puppeteer / Selenium) are suitable, but **Playwright** is highly recommended for both ecosystems due to its built-in browser management, superior element wait handling, and developer tools.

## 5. Verification Method
- **Selector Verification**:
  1. Open a standard web browser on the host.
  2. Navigate to `https://signup.cloud.oracle.com/`.
  3. Open DevTools (F12) and inspect the fields for Country, First Name, Last Name, and Email.
  4. Verify if `select#country`, `input#firstName`, `input#lastName`, and `input#email` match the active DOM elements.
- **Automation Execution Test**:
  1. Once the host environment packages are identified by `explorer_m1_1`, write a minimal test script using the selected framework (e.g., Playwright).
  2. Run the script in non-headless mode to confirm it successfully opens the browser window and loads the form.
