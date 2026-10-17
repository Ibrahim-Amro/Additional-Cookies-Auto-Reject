"use strict";

const DEFAULT_CONFIG = { enabled: true, disabledSites: [] };
// Storage operations share one queue so bursts from multiple frames cannot lose counts.
let statsQueue = Promise.resolve();

function hostnameFor(url) {
  try {
    const parsed = new URL(url);
    return /^(https?:)$/.test(parsed.protocol) ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function countValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function getConfig(sender) {
  const cfg = await chrome.storage.sync.get(DEFAULT_CONFIG);
  // A cross-origin consent frame must follow the top-level site's exemption.
  const hostname = hostnameFor(sender.tab?.url || sender.url);
  const disabledSites = Array.isArray(cfg.disabledSites) ? cfg.disabledSites : [];
  return {
    enabled: cfg.enabled !== false && hostname !== null &&
      !disabledSites.some((site) => typeof site === "string" && site.toLowerCase() === hostname)
  };
}

function enqueueStats(task) {
  const result = statsQueue.then(task);
  statsQueue = result.catch(() => {});
  return result;
}

async function setBadge(tabId, count) {
  // The tab may have closed while a storage operation was pending.
  try {
    await chrome.action.setBadgeText({ tabId, text: count ? String(count) : "" });
    if (count) await chrome.action.setBadgeBackgroundColor({ tabId, color: "#276749" });
  } catch {
    // Closing a tab does not invalidate aggregate statistics.
  }
}

async function recordAttempt(sender) {
  if (!(await getConfig(sender)).enabled) return { recorded: false };
  const tabId = sender.tab.id;
  const [session, local] = await Promise.all([
    chrome.storage.session.get({ tabAttempts: {} }),
    chrome.storage.local.get({ totalAttempts: 0 })
  ]);
  const tabAttempts = { ...session.tabAttempts };
  const count = countValue(tabAttempts[tabId]) + 1;
  tabAttempts[tabId] = count;
  await chrome.storage.local.set({ totalAttempts: countValue(local.totalAttempts) + 1 });
  await chrome.storage.session.set({ tabAttempts });
  await setBadge(tabId, count);
  return { recorded: true };
}

async function clearTab(tabId, removed) {
  const session = await chrome.storage.session.get({ tabAttempts: {} });
  const tabAttempts = { ...session.tabAttempts };
  delete tabAttempts[tabId];
  await chrome.storage.session.set({ tabAttempts });
  if (!removed) await setBadge(tabId, 0);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "get-config") {
    getConfig(sender).then(sendResponse, () => sendResponse({ enabled: false }));
    return true;
  }
  if (message?.type === "rejection-attempt" &&
      Number.isInteger(sender.tab?.id) && sender.tab.id >= 0 &&
      typeof message.method === "string" && message.method.length > 0 && message.method.length <= 100) {
    // Store only counts. Page URLs, text, and the method are never persisted.
    enqueueStats(() => recordAttempt(sender)).then(sendResponse, () => sendResponse({ recorded: false }));
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueueStats(() => clearTab(tabId, true)).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    enqueueStats(() => clearTab(tabId, false)).catch(() => {});
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || (!changes.enabled && !changes.disabledSites)) return;
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (Number.isInteger(tab.id)) {
        // Without a frameId Chrome delivers this message to every content-script frame.
        chrome.tabs.sendMessage(tab.id, { type: "config-changed" }).catch(() => {});
      }
    }
  }).catch(() => {});
});
