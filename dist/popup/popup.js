const els = {
  fromInput: document.getElementById("fromInput"),
  toInput: document.getElementById("toInput"),
  getBtn: document.getElementById("getBtn"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  copyAllBtn: document.getElementById("copyAllBtn"),
  summaryText: document.getElementById("summaryText"),
  openOptions: document.getElementById("openOptions"),
};

function yyyyMmDdLocal(d) {
  const tzOff = d.getTimezoneOffset() * 60_000;
  const local = new Date(d.getTime() - tzOff);
  return local.toISOString().slice(0, 10);
}

function ddMmYyyyFromYyyyMmDd(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}-${m}-${y}`;
}

function secondsToHm(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function sumSeconds(items) {
  let s = 0;
  for (const it of items || []) s += Number(it?.timeSpentSeconds || 0);
  return s;
}

function setStatus(kind, text) {
  if (!text) {
    els.status.classList.add("hidden");
    els.status.textContent = "";
    els.status.className = "mt-3 hidden rounded-md border px-2 py-1.5 text-xs";
    return;
  }
  els.status.classList.remove("hidden");
  const base = "mt-3 rounded-md border px-2 py-1.5 text-xs";
  const cls =
    kind === "error"
      ? `${base} border-red-200 bg-red-50 text-red-800`
      : kind === "success"
        ? `${base} border-emerald-200 bg-emerald-50 text-emerald-800`
        : `${base} border-slate-200 bg-white text-slate-700`;
  els.status.className = cls;
  els.status.textContent = text;
}

function clearResults() {
  els.results.innerHTML = "";
  els.copyAllBtn.classList.add("hidden");
  els.summaryText.textContent = "";
}

function mergeGroupsBySiteToProjects(groupsBySite) {
  const byProject = {};
  for (const site of Object.keys(groupsBySite || {})) {
    const projMap = groupsBySite?.[site] || {};
    for (const projectName of Object.keys(projMap)) {
      if (!byProject[projectName]) byProject[projectName] = [];
      byProject[projectName].push(...(projMap[projectName] || []));
    }
  }
  for (const projectName of Object.keys(byProject)) {
    byProject[projectName].sort((a, b) => a.key.localeCompare(b.key));
  }
  // Filter out projects with no actual logged time.
  for (const projectName of Object.keys(byProject)) {
    const items = (byProject[projectName] || []).filter(
      (it) => Number(it?.timeSpentSeconds || 0) > 0,
    );
    if (items.length === 0) delete byProject[projectName];
    else byProject[projectName] = items;
  }
  return byProject;
}

function render(groupsBySite) {
  clearResults();
  const byProject = mergeGroupsBySiteToProjects(groupsBySite);
  const projectNames = Object.keys(byProject || {});
  if (projectNames.length === 0) {
    els.summaryText.textContent = "No tickets found for this date.";
    return;
  }

  let totalIssues = 0;
  let totalSeconds = 0;
  for (const projectName of projectNames) {
    const items = byProject[projectName] || [];
    totalIssues += items.length;
    totalSeconds += sumSeconds(items);
  }

  els.summaryText.textContent = `${totalIssues} ticket(s) across ${projectNames.length} board(s) — Total [${secondsToHm(totalSeconds)}].`;
  els.copyAllBtn.classList.remove("hidden");

  for (const projectName of projectNames.sort((a, b) => a.localeCompare(b))) {
    const issues = byProject[projectName] || [];
    const projectSeconds = sumSeconds(issues);

    const section = document.createElement("div");
    section.className = "rounded-xl border border-slate-200 bg-white p-2 shadow-sm";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between gap-2";

    const title = document.createElement("div");
    title.className = "text-sm font-semibold";
    title.textContent = projectName;

    const right = document.createElement("div");
    right.className = "flex items-center gap-2";

    const meta = document.createElement("div");
    meta.className = "text-xs text-slate-500";
    meta.textContent = `${issues.length} ticket(s) — [${secondsToHm(projectSeconds)}]`;

    const copyBtn = document.createElement("button");
    copyBtn.className =
      "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      if (!lastData?.groupsBySite || !lastRange) return;
      const text = buildProjectCopyText(lastRange.from, lastRange.to, byProject, projectName);
      await navigator.clipboard.writeText(text);
      setStatus("success", `Copied: ${projectName}`);
    });

    right.appendChild(meta);
    right.appendChild(copyBtn);

    header.appendChild(title);
    header.appendChild(right);
    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "mt-2 space-y-1";

    for (const it of issues) {
      const row = document.createElement("div");
      row.className =
        "rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-800";
      row.textContent = `${it.key} — ${it.summary} [${secondsToHm(it.timeSpentSeconds)}] — ${it.status}`;
      list.appendChild(row);
    }

    section.appendChild(list);
    els.results.appendChild(section);
  }
}

let lastData = null;
let lastRange = null;

function buildUniversalCopyText(fromYyyyMmDd, toYyyyMmDd, byProject) {
  const from = ddMmYyyyFromYyyyMmDd(fromYyyyMmDd);
  const to = ddMmYyyyFromYyyyMmDd(toYyyyMmDd);
  const today = ddMmYyyyFromYyyyMmDd(yyyyMmDdLocal(new Date()));
  const isSingleDay = fromYyyyMmDd === toYyyyMmDd;
  const headerLine = isSingleDay
    ? from === today
      ? `Today's Update - [${from}]`
      : `Update - [${from}]`
    : `Update - [${from} to ${to}]`;
  const lines = [];
  lines.push("-------------------------------------------------");
  lines.push(headerLine);
  lines.push("-------------------------------------------------");

  const projectNames = Object.keys(byProject || {}).sort((a, b) => a.localeCompare(b));
  const allItems = [];
  for (const projectName of projectNames) allItems.push(...(byProject[projectName] || []));
  lines.push(`Total - [${secondsToHm(sumSeconds(allItems))}]`);
  lines.push("-------------------------------------------------");
  for (const projectName of projectNames) {
    lines.push(`${projectName} [${secondsToHm(sumSeconds(byProject[projectName] || []))}]`);
    lines.push("-------------------------------------------------");
    const issues = byProject[projectName] || [];
    for (const it of issues) {
      lines.push(`- ${it.key} - ${it.summary} [${secondsToHm(it.timeSpentSeconds)}] - ${it.status}`);
    }
    lines.push("");
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function buildProjectCopyText(fromYyyyMmDd, toYyyyMmDd, byProject, projectName) {
  const from = ddMmYyyyFromYyyyMmDd(fromYyyyMmDd);
  const to = ddMmYyyyFromYyyyMmDd(toYyyyMmDd);
  const today = ddMmYyyyFromYyyyMmDd(yyyyMmDdLocal(new Date()));
  const isSingleDay = fromYyyyMmDd === toYyyyMmDd;
  const headerLine = isSingleDay
    ? from === today
      ? `Today's Update - [${from}]`
      : `Update - [${from}]`
    : `Update - [${from} to ${to}]`;
  const lines = [];
  lines.push("-------------------------------------------------");
  lines.push(headerLine);
  lines.push("-------------------------------------------------");
  const issues = byProject?.[projectName] || [];
  lines.push(`${projectName} [${secondsToHm(sumSeconds(issues))}]`);
  lines.push("-------------------------------------------------");
  for (const it of issues) {
    lines.push(`- ${it.key} - ${it.summary} [${secondsToHm(it.timeSpentSeconds)}] - ${it.status}`);
  }
  return lines.join("\n");
}

async function getUpdates() {
  const from = els.fromInput.value;
  const to = els.toInput.value;
  if (!from || !to) return;

  setStatus("info", "Fetching updates…");
  els.getBtn.disabled = true;
  els.copyAllBtn.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({
      type: "JIRA_DAILY_UPDATE_GET",
      from,
      to,
    });

    if (!res?.ok) {
      const msg =
        res?.error ||
        "Failed to fetch Jira updates. Please check your Options and try again.";
      setStatus("error", msg);
      clearResults();
      lastData = null;
      lastRange = null;
      return;
    }

    lastData = res.data;
    lastRange = { from, to };
    render(res.data.groupsBySite);
    setStatus("success", "Done.");
  } catch (e) {
    setStatus("error", e?.message || String(e));
    clearResults();
    lastData = null;
    lastRange = null;
  } finally {
    els.getBtn.disabled = false;
    els.copyAllBtn.disabled = false;
  }
}

els.openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

els.getBtn.addEventListener("click", () => {
  void getUpdates();
});

els.copyAllBtn.addEventListener("click", async () => {
  if (!lastData?.groupsBySite || !lastRange) return;
  const byProject = mergeGroupsBySiteToProjects(lastData.groupsBySite);
  const text = buildUniversalCopyText(lastRange.from, lastRange.to, byProject);
  await navigator.clipboard.writeText(text);
  setStatus("success", "Copied to clipboard.");
});

// init
const today = yyyyMmDdLocal(new Date());
els.fromInput.value = today;
els.toInput.value = today;
setStatus("", "");

