## 2026-06-26T09:53:38Z
We are improving the Oracle Cloud Free Tier signup automation script based on verification reviews.
Your task is to modify `C:\Users\USER\teamwork_projects\oracle_signup\oracle_signup.py` to implement the following robustness improvements:
1. **Dependencies Check**: Wrap the Playwright imports (`from playwright.sync_api import ...`) in a `try...except ImportError` block. If it fails, print a clean, helpful error message explaining how to install it (`pip install playwright && playwright install`) and exit with status 1.
2. **Shorten Selector Timeouts**: In `type_with_delay` and `select_dropdown`, reduce the `wait_for_selector` timeout from `15000` (15s) to `5000` (5s).
3. **Abort on Navigation Failure**: If `page.goto` fails (raises an exception), print an error message: "Failed to connect to Oracle Cloud registration page. Check your internet connection." and exit with status 1, rather than trying to fill fields on a blank page.
4. **Playwright Timeout Sleep**: In the monitoring loop, replace `time.sleep(1)` with `page.wait_for_timeout(1000)` to yield thread control properly to the Playwright sync driver.
5. **Robust Stdin / TTY Handling**: Before starting the stdin daemon thread, check if standard input is a TTY using `sys.stdin.isatty()`. If it is not (e.g. non-interactive script environment), do not prompt for inputs or start the stdin block thread; instead, print: "Standard input is not interactive. Monitoring browser closure or dashboard URL detection..." and let the monitoring loop run without stdin blocks. Additionally, if the `input()` call raises any exception in the background thread (like `EOFError`), log a warning to console and cleanly terminate the input thread without calling `user_done.set()` (so the loop continues monitoring the browser).
6. **KeyboardInterrupt Handling**: Wrap the main execution context in a try-except block catching `KeyboardInterrupt` to exit the script cleanly with a message: "\nScript terminated by user. Closing browser..." and close the browser/context before exiting status 0.
7. **Maximum Idle Timeout**: Add a maximum monitoring timeout of 30 minutes (1800 seconds). If the page is not closed and the dashboard is not detected within 30 minutes, print a timeout message and close the browser.

Ensure Python 3 syntax is completely correct. Write your handoff report in c:\Program Files\PROYECTOS DE PROGRAMACION\SPEACK3\.agents\worker_m2_2\handoff.md describing your changes.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
