# Project: Oracle Cloud Signup Automation Handoff

## Architecture
- The task is to create a standalone automation script located in `~/teamwork_projects/oracle_signup` (typically resolves to `C:\Users\USER\teamwork_projects\oracle_signup`).
- The script should interact with the browser (e.g. Playwright or Selenium) to navigate to the Oracle Cloud Free Tier registration page.
- Once the page is loaded, the script will complete any initial non-sensitive input and pause execution, leaving the browser window open and active for manual user input.
- Communication with the user is handled through stdout/prompts.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Environment Exploration | Probe available runtimes (Python/Node), packages, browsers, and directory structure. | none | DONE |
| 2 | Script Development | Write automation script in target folder with non-headless configuration and clean user handoff. | M1 | DONE |
| 3 | Verification & Handoff | Review code, run verification tests, and provide user instructions. | M2 | DONE |

## Code Layout
- Target folder: `C:\Users\USER\teamwork_projects\oracle_signup`
- Script: `oracle_signup.py` — Python script to launch browser and automate inputs.
- Readme: `README.md` — User guide detailing how to run the script.


## Interface Contracts
- No complex multi-module communication is required. The script runs standalone.
- The automation script must yield control by pausing execution (e.g. standard input prompt or Playwright's `page.pause()` / custom delay/prompt) and printing a clear guide to stdout.
