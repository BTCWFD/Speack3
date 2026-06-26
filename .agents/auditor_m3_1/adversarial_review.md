## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Low] Challenge 1: Dynamic Selector Instability

- **Assumption challenged**: Oracle's sign-up page selectors (e.g., `select[name="country"]`, `input[name="firstName"]`, `input[name="lastName"]`, `input[name="email"]`) will remain static and unchanged.
- **Attack scenario**: Oracle updates their front-end framework or changes input field names/classes.
- **Blast radius**: The Playwright selectors will timeout and fail to autofill.
- **Mitigation**: The script already implements graceful degradation by catching exceptions in `type_with_delay` and `select_dropdown` and prompting the user to fill those fields manually, ensuring the process does not crash.

### [Low] Challenge 2: CAPTCHA and IP Reputation Blocking

- **Assumption challenged**: Playwright can easily navigate and submit the forms without triggering high-reputation blocking or anti-bot screens.
- **Attack scenario**: Oracle's anti-bot system (e.g., Akamai/Cloudflare) detects the Playwright instance (even with standard automation flag disabled) and serves challenging CAPTCHAs or block pages.
- **Blast radius**: The user will be stuck solving CAPTCHAs, or the registration page will refuse to submit.
- **Mitigation**: The hybrid model requires the user to solve CAPTCHAs manually, ensuring that the script does not attempt to programmatically bypass complex bot detectors.

### [Low] Challenge 3: Stdin Block in Non-TTY environments

- **Assumption challenged**: Stdin is always interactive.
- **Attack scenario**: Script is run via an automated execution runner or CI environment.
- **Blast radius**: Stdin is not a TTY, so the input thread would crash or fail.
- **Mitigation**: The script checks `sys.stdin.isatty()` before launching the manual input thread, falling back to pure URL monitoring.

## Stress Test Results

- **No interactive stdin** → Run script with output redirection (`python oracle_signup.py < $null`) → Successfully bypasses keyboard listener and proceeds with automated URL checking → **PASS**
- **Dynamic select options failure** → Inject invalid country code option → Dropdown fails selection, logs warning, and lets user proceed manually → **PASS**

## Unchallenged Areas

- **Credit card validation** — Not challenged because providing test payment methods to live Oracle signups is out of scope and requires real, sensitive credentials.
