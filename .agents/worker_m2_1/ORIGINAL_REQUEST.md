## 2026-06-26T09:49:19Z
Your working directory is c:\Program Files\PROYECTOS DE PROGRAMACION\SPEACK3\.agents\worker_m2_1\.
Your role is Python Playwright Script Developer.
We are implementing the Oracle Cloud Free Tier signup automation script.
Your task is to implement:
1. In the directory C:\Users\USER\teamwork_projects\oracle_signup, create a Python script named `oracle_signup.py` that:
   - Uses `playwright.sync_api` to launch a non-headless browser window.
   - Navigates to `https://signup.cloud.oracle.com/`.
   - Optionally accepts or prompts the user on CLI for Country, First Name, Last Name, and Email (non-sensitive details).
   - Fills these details into the browser form fields (using robust selectors: `select[name="country"]`, `input[name="firstName"]`, `input[name="lastName"]`, `input[name="email"]`).
   - Types inputs with a natural typing delay (e.g., 50-100ms per character) to avoid bot detection.
   - Displays clear CLI instructions to the user on how to proceed: solve CAPTCHA, submit the form, verify email (including copy-pasting verification link if it opens in default browser), and enter billing/confidential details.
   - Pauses execution and keeps the browser window open. Implement a hybrid pause mechanism: waits for the dashboard URL (`**/dashboard/**`) OR blocks on a console stdin prompt (`input("Press Enter in this console once registration is fully complete to close the browser...")`).
2. Create a `README.md` file in C:\Users\USER\teamwork_projects\oracle_signup with clear, user-friendly instructions on:
   - Prerequisites (Python 3.12, Playwright installed).
   - How to run the script (`python oracle_signup.py` or with arguments).
   - How to perform the handoff (handling verification link, OTP, and payment details).
3. Verify that the script executes and opens the browser window by running it locally (e.g., via run_command with a mock run or basic check).
4. Write your handoff report in c:\Program Files\PROYECTOS DE PROGRAMACION\SPEACK3\.agents\worker_m2_1\handoff.md with your findings, commands run, and results.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
