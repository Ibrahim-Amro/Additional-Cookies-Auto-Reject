"use strict";

const enabledToggle = document.getElementById("enabled");
const siteToggle = document.getElementById("siteToggle");
const siteHostEl = document.getElementById("siteHost");
const totalAttemptsEl = document.getElementById("totalAttempts");
const tabAttemptsEl = document.getElementById("tabAttempts");
const legacyNoteEl = document.getElementById("legacyNote");
const statusEl = document.getElementById("status");
let currentHost = null;
let refreshVersion = 0;

function countValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function tabHostname(tab) {
  try {
    const url = new URL(tab?.url);
    return /^(https?:)$/.test(url.protocol) ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function refresh() {
  const version = ++refreshVersion;
  try {
    const [cfg, local, session, tabs] = await Promise.all([
      chrome.storage.sync.get({ enabled: true, disabledSites: [] }),
      chrome.storage.local.get({ totalAttempts: 0, totalHandled: 0 }),
      chrome.storage.session.get({ tabAttempts: {} }),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]);
    if (version !== refreshVersion) return;
    currentHost = tabHostname(tabs[0]);
    const globallyEnabled = cfg.enabled !== false;
    const disabledSites = Array.isArray(cfg.disabledSites) ? cfg.disabledSites : [];
    const excluded = disabledSites.some((host) => typeof host === "string" && host.toLowerCase() === currentHost);
    enabledToggle.checked = globallyEnabled;
    siteToggle.checked = currentHost !== null && !excluded;
    siteToggle.disabled = !globallyEnabled || currentHost === null;
    siteHostEl.textContent = currentHost || "Unavailable on this page";
    totalAttemptsEl.textContent = countValue(local.totalAttempts).toLocaleString();
    tabAttemptsEl.textContent = countValue(session.tabAttempts?.[tabs[0]?.id]).toLocaleString();
    const legacy = countValue(local.totalHandled);
    legacyNoteEl.hidden = legacy === 0;
    legacyNoteEl.textContent = legacy ? `${legacy.toLocaleString()} interactions recorded by the earlier version are kept separately; some only hid banners.` : "";
    statusEl.textContent = !globallyEnabled ? "Paused everywhere" :
      !currentHost ? "Extensions cannot run on this page" :
      excluded ? "Paused on this site" : "Active on this site";
  } catch {
    statusEl.textContent = "Could not load settings. Reopen this popup to try again.";
  }
}

enabledToggle.addEventListener("change", async () => {
  try {
    await chrome.storage.sync.set({ enabled: enabledToggle.checked });
    await refresh();
  } catch {
    statusEl.textContent = "Could not save this setting. Please try again.";
  }
});

siteToggle.addEventListener("change", async () => {
  if (!currentHost || siteToggle.disabled) return;
  const host = currentHost;
  const siteEnabled = siteToggle.checked;
  try {
    const cfg = await chrome.storage.sync.get({ disabledSites: [] });
    const list = Array.isArray(cfg.disabledSites) ? cfg.disabledSites.filter((item) => typeof item === "string") : [];
    const sites = list.filter((item) => item.toLowerCase() !== host);
    if (!siteEnabled) sites.push(host);
    await chrome.storage.sync.set({ disabledSites: sites });
    await refresh();
  } catch {
    statusEl.textContent = "Could not save this setting. Please try again.";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  const relevant = areaName === "sync" ? changes.enabled || changes.disabledSites :
    areaName === "local" ? changes.totalAttempts || changes.totalHandled :
    areaName === "session" && changes.tabAttempts;
  if (relevant) refresh();
});

refresh();
