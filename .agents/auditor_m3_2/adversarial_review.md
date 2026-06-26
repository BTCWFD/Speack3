## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Low] Challenge 1: Front-end / Selector Fragility
- **Assumption challenged**: The HTML selectors (`select[name="country"]`, `input[name="firstName"]`, `input[name="lastName"]`, `input[name="email"]`) on Oracle's registration page remain static.
- **Attack scenario**: Oracle modifies their signup form layout, tags, or element names.
- **Blast radius**: The automation script will fail to locate the selectors and throw exceptions, warning the user about the failure.
- **Mitigation**: The code already catches these exceptions in try-except blocks, logs warnings (e.g., `[Warning] Failed to autofill...`), and instructs the user to enter details manually. This prevents the script from crashing.

### [Low] Challenge 2: CAPTCHA and Cloudflare WAF Block
- **Assumption challenged**: Oracle will permit Playwright to load their page without immediate WAF blocking or impossible-to-bypass bot checks.
- **Attack scenario**: Oracle's bot protection (e.g., Akamai or Cloudflare) detects that Playwright is running (even with `AutomationControlled` disabled) and prompts the user with hard CAPTCHAs or block screens.
- **Blast radius**: Autofill is blocked or the user is unable to proceed without solving the CAPTCHAs manually.
- **Mitigation**: The script runs in a hybrid mode. It runs `headless=False` so that the user can solve CAPTCHAs and other manual prompts directly in the browser interface, and instructs the user to do so in the terminal output.

### [Low] Challenge 3: Redirect/URL Monitoring Failure
- **Assumption challenged**: The dashboard URL will always contain `"/dashboard/"` or `"dashboard"`.
- **Attack scenario**: Oracle modifies the destination URL after successful signup to a new endpoint (e.g., `/console/home/` or similar) without containing "dashboard".
- **Blast radius**: The monitoring loop will not auto-detect completion and will keep waiting for 30 minutes.
- **Mitigation**: The script features a hybrid exit mechanism. The user can press `ENTER` in the terminal to exit the script and close the browser manually.

## Stress Test Results

- **No stdin TTY (Non-interactive mode check)**:
  - Scenario: Redirection of stdin (e.g., `python oracle_signup.py < $null` or `echo | python oracle_signup.py`).
  - Expected: Script runs without starting the keyboard listener thread and relies on URL monitoring or manual window close.
  - Actual: Checked lines 100-102 and 168-180. The script checks `sys.stdin.isatty()` and behaves correctly. (PASS)
- **Invalid country selection**:
  - Scenario: Providing an invalid country option like `"Atlantis"`.
  - Expected: Falls back gracefully, prints a warning, and allows the user to make the selection.
  - Actual: Handled on lines 63-87 in `select_dropdown`. (PASS)

## Unchallenged Areas

- **Live payment information / Identity verification hold**:
  - Reason not challenged: Oracle requires active and unique credit card credentials to complete the sign-up process. Providing fake details will block the process, and using real credentials during automated test runs is out of scope.
