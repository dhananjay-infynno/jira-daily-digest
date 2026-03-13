# Jira Daily Update (Chrome Extension)

## What it does

- Pick a **date range** (From / To, defaults to today → today)
- Fetch your Jira worklogs for that range from **one or more Jira Cloud sites**
- Show ticket **key**, **summary**, **time logged**, and **status**, grouped by **project** (boards)
- Show **totals**:
  - Overall total time across all projects
  - Per-project total time
- Copy updates in this format:

```
-------------------------------------------------
Today's Update - [DD-MM-YYYY]          # when From = To = today
-------------------------------------------------
Project Name [h:mm]
-------------------------------------------------
- KEY - Summary [h:mm] - Status
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the extension assets:

```bash
npm run build
```

3. Load in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select this folder: `C:\Users\sagar\Desktop\Infynno\jira-ext`

## Configure Jira

Open the extension **Options** page and set:

- **Jira Base URLs**: one per line, e.g.\
  `https://siteA.atlassian.net`\
  `https://siteB.atlassian.net`
- **Email**: your Atlassian email
- **API Token**: create one in Atlassian account security settings

These settings are saved in `chrome.storage.sync` so they can follow your Chrome Sync (if enabled).

Click **Validate & Save**:

- It will request permissions and validate each Jira URL
- Any invalid / no-access URLs are **removed automatically**
- Only valid URLs are saved

## Using the popup

- Choose **From** and **To** dates
- Click **Get** (full-width button) to fetch worklogs
- Use:
  - **Copy all**: one combined update with total + all projects
  - **Copy** on a specific project card: board-wise update for that project only

Projects with no logged time in the selected range are **hidden** from the list and from the copied text.

