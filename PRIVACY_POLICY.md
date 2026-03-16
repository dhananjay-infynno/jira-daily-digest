# Privacy Policy – Jira Daily Update

*Last updated: March 2026*

Jira Daily Update is a Chrome extension that reads your own Jira Cloud data to build daily or date-range status updates.

## What We Access

- **Your credentials**: Jira Base URL(s), email, and Jira API token (you enter these in Options).
- **Jira data**: Issue key, summary, status, project name, and worklog time for the selected date range.

## How We Use It

- Only to calculate time totals and show/copy formatted update text in the popup.

## What We Store

- Jira Base URL(s), email, and API token in browser extension storage (`chrome.storage.sync`).
- No issue or worklog data is stored; it stays in memory only while the popup is open.

## What We Share

- We do **not** send any data to our servers or third parties.
- All requests go directly from your browser to Jira Cloud over HTTPS.

## Permissions

- **storage** – to save your settings.
- **clipboardWrite** – to copy the generated text when you click Copy.
- **Host access** – for the Jira domain(s) you add (e.g. `*.atlassian.net`), to call Jira APIs.
