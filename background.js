function requiredString(value, name) {
  const v = String(value || "").trim();
  if (!v) throw new Error(`Missing ${name}. Set it in Options.`);
  return v;
}

function basicAuthHeader(email, apiToken) {
  const token = btoa(`${email}:${apiToken}`);
  return `Basic ${token}`;
}

function yyyyMmDdFromStarted(started) {
  return String(started || "").slice(0, 10);
}

function isYyyyMmDdBetweenInclusive(yyyyMmDd, from, to) {
  if (!yyyyMmDd || !from || !to) return false;
  return yyyyMmDd >= from && yyyyMmDd <= to;
}

async function jiraFetchJson(
  jiraBaseUrl,
  path,
  { email, apiToken, method = "GET", body } = {},
) {
  const url = new URL(path, jiraBaseUrl).toString();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(email, apiToken),
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira API error ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}

async function getSettings() {
  const { jiraBaseUrls, email, apiToken } = await chrome.storage.sync.get([
    "jiraBaseUrls",
    "email",
    "apiToken",
  ]);
  return {
    jiraBaseUrls: Array.isArray(jiraBaseUrls) ? jiraBaseUrls : [],
    email: requiredString(email, "Email"),
    apiToken: requiredString(apiToken, "API token"),
  };
}

async function validateCredentials({ jiraBaseUrl, email, apiToken }) {
  const myself = await jiraFetchJson(jiraBaseUrl, "/rest/api/3/myself", {
    email,
    apiToken,
  });
  return {
    accountId: myself?.accountId,
    displayName: myself?.displayName,
  };
}

async function searchIssuesForRange({ jiraBaseUrl, email, apiToken, fromYyyyMmDd, toYyyyMmDd }) {
  const jql = `worklogAuthor = currentUser() AND worklogDate >= "${fromYyyyMmDd}" AND worklogDate <= "${toYyyyMmDd}"`;
  const maxResults = 100;
  const issues = [];
  let nextPageToken = undefined;

  while (true) {
    // Jira Cloud removed /rest/api/3/search in favor of /rest/api/3/search/jql
    // See CHANGE-2046.
    const body = {
      jql,
      maxResults,
      fields: ["summary", "status", "project"],
      ...(nextPageToken ? { nextPageToken } : {}),
    };

    const data = await jiraFetchJson(jiraBaseUrl, "/rest/api/3/search/jql", {
      email,
      apiToken,
      method: "POST",
      body,
    });

    const batch = data?.issues || [];
    issues.push(...batch);
    nextPageToken = data?.nextPageToken;
    if (!nextPageToken || batch.length === 0) break;
  }

  return issues;
}

async function sumWorklogSecondsForRange({
  jiraBaseUrl,
  email,
  apiToken,
  issueKey,
  accountId,
  fromYyyyMmDd,
  toYyyyMmDd,
}) {
  let startAt = 0;
  const maxResults = 100;
  let sumSeconds = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("startAt", String(startAt));
    params.set("maxResults", String(maxResults));

    const data = await jiraFetchJson(
      jiraBaseUrl,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?${params.toString()}`,
      { email, apiToken },
    );

    const worklogs = data?.worklogs || [];
    for (const wl of worklogs) {
      if (accountId && wl?.author?.accountId && wl.author.accountId !== accountId) continue;
      const d = yyyyMmDdFromStarted(wl?.started);
      if (!isYyyyMmDdBetweenInclusive(d, fromYyyyMmDd, toYyyyMmDd)) continue;
      sumSeconds += Number(wl?.timeSpentSeconds || 0);
    }

    const total = Number(data?.total ?? worklogs.length);
    startAt += worklogs.length;
    if (startAt >= total || worklogs.length === 0) break;
  }

  return sumSeconds;
}

function originToHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return String(origin || "");
  }
}

async function getDailyUpdate({ dateYyyyMmDd }) {
  return await getRangeUpdate({ fromYyyyMmDd: dateYyyyMmDd, toYyyyMmDd: dateYyyyMmDd });
}

async function getRangeUpdate({ fromYyyyMmDd, toYyyyMmDd }) {
  const { jiraBaseUrls, email, apiToken } = await getSettings();
  if (jiraBaseUrls.length === 0) {
    throw new Error("Missing Jira Base URLs. Set them in Options.");
  }
  if (!fromYyyyMmDd || !toYyyyMmDd) {
    throw new Error("Missing from/to date.");
  }
  if (fromYyyyMmDd > toYyyyMmDd) {
    throw new Error("From date must be before or equal to To date.");
  }

  const groupsBySite = {};

  for (const jiraBaseUrl of jiraBaseUrls) {
    const { accountId } = await validateCredentials({ jiraBaseUrl, email, apiToken });
    const issues = await searchIssuesForRange({
      jiraBaseUrl,
      email,
      apiToken,
      fromYyyyMmDd,
      toYyyyMmDd,
    });

    const items = [];
    for (const issue of issues) {
      const key = issue?.key;
      if (!key) continue;

      const summary = issue?.fields?.summary || "";
      const status = issue?.fields?.status?.name || "";
      const projectName = issue?.fields?.project?.name || "Unknown Project";

      const timeSpentSeconds = await sumWorklogSecondsForRange({
        jiraBaseUrl,
        email,
        apiToken,
        issueKey: key,
        accountId,
        fromYyyyMmDd,
        toYyyyMmDd,
      });

      items.push({ key, summary, status, projectName, timeSpentSeconds });
    }

    const siteKey = originToHost(jiraBaseUrl);
    if (!groupsBySite[siteKey]) groupsBySite[siteKey] = {};
    for (const it of items) {
      if (!groupsBySite[siteKey][it.projectName]) groupsBySite[siteKey][it.projectName] = [];
      groupsBySite[siteKey][it.projectName].push(it);
    }

    for (const projectName of Object.keys(groupsBySite[siteKey])) {
      groupsBySite[siteKey][projectName].sort((a, b) => a.key.localeCompare(b.key));
    }
  }

  return { groupsBySite };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "JIRA_DAILY_UPDATE_VALIDATE") {
        const jiraBaseUrl = requiredString(message.jiraBaseUrl, "Jira Base URL");
        const email = requiredString(message.email, "Email");
        const apiToken = requiredString(message.apiToken, "API token");
        const data = await validateCredentials({ jiraBaseUrl, email, apiToken });
        sendResponse({ ok: true, data });
        return;
      }

      if (message?.type === "JIRA_DAILY_UPDATE_GET") {
        const date = String(message.date || "").trim();
        const from = String(message.from || "").trim();
        const to = String(message.to || "").trim();

        const data =
          from && to
            ? await getRangeUpdate({ fromYyyyMmDd: requiredString(from, "from"), toYyyyMmDd: requiredString(to, "to") })
            : await getDailyUpdate({ dateYyyyMmDd: requiredString(date, "date") });

        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({ ok: false, error: "Unknown request." });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});

