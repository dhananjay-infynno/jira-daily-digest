const els = {
  jiraBaseUrls: document.getElementById("jiraBaseUrls"),
  email: document.getElementById("email"),
  apiToken: document.getElementById("apiToken"),
  validateBtn: document.getElementById("validateBtn"),
  status: document.getElementById("status"),
};

function setStatus(text) {
  els.status.textContent = text || "";
}

function normalizeBaseUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const u = new URL(raw);
  return u.origin;
}

function uniqueNonEmpty(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function parseBaseUrls(text) {
  const rawLines = String(text || "")
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  const good = [];
  const bad = [];
  for (const line of rawLines) {
    try {
      good.push(normalizeBaseUrl(line));
    } catch (e) {
      bad.push({ input: line, reason: "Invalid URL" });
    }
  }

  return { good: uniqueNonEmpty(good), bad };
}

async function load() {
  const { jiraBaseUrls, email, apiToken } = await chrome.storage.sync.get([
    "jiraBaseUrls",
    "email",
    "apiToken",
  ]);
  if (Array.isArray(jiraBaseUrls) && jiraBaseUrls.length > 0) {
    els.jiraBaseUrls.value = jiraBaseUrls.join("\n");
  }
  if (email) els.email.value = email;
  if (apiToken) els.apiToken.value = apiToken;
}

async function ensureHostPermission(origin) {
  const want = [`${origin}/*`];

  const has = await chrome.permissions.contains({ origins: want });
  if (has) return true;

  return await chrome.permissions.request({ origins: want });
}

async function validate() {
  setStatus("Validating…");
  els.validateBtn.disabled = true;

  const { good: jiraBaseUrls, bad: badUrls } = parseBaseUrls(els.jiraBaseUrls.value);
  const email = String(els.email.value || "").trim();
  const apiToken = String(els.apiToken.value || "").trim();
  if (jiraBaseUrls.length === 0 || !email || !apiToken) {
    setStatus("Please add at least 1 Jira Base URL, plus email and token.");
    els.validateBtn.disabled = false;
    return;
  }

  const okOrigins = [];
  const removed = [...badUrls];

  for (const origin of jiraBaseUrls) {
    const okPerm = await ensureHostPermission(origin);
    if (!okPerm) {
      removed.push({ input: origin, reason: "Permission denied" });
      continue;
    }

    const res = await chrome.runtime.sendMessage({
      type: "JIRA_DAILY_UPDATE_VALIDATE",
      jiraBaseUrl: origin,
      email,
      apiToken,
    });

    if (!res?.ok) {
      removed.push({ input: origin, reason: res?.error || "Validation failed" });
      continue;
    }

    okOrigins.push(origin);
  }

  // Keep only valid origins in the UI.
  els.jiraBaseUrls.value = okOrigins.join("\n");

  if (okOrigins.length > 0) {
    await chrome.storage.sync.set({ jiraBaseUrls: okOrigins, email, apiToken });
  }

  if (removed.length > 0 && okOrigins.length > 0) {
    setStatus(`Saved ${okOrigins.length} site(s). Removed ${removed.length} invalid/unavailable URL(s).`);
  } else if (removed.length > 0 && okOrigins.length === 0) {
    setStatus(`No valid sites. Removed ${removed.length} invalid/unavailable URL(s).`);
  } else {
    setStatus(`Saved ${okOrigins.length} site(s).`);
  }

  els.validateBtn.disabled = false;
}

els.validateBtn.addEventListener("click", () => void validate());

void load();

