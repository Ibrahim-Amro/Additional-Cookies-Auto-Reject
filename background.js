// Tracks how many banners have been auto-rejected per tab and shows it as a badge.

const tabCounts = {};

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === "banner-handled" && sender.tab && sender.tab.id != null) {
    const tabId = sender.tab.id;
    tabCounts[tabId] = (tabCounts[tabId] || 0) + 1;
    chrome.action.setBadgeText({ tabId, text: String(tabCounts[tabId]) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#2e7d32" });

    chrome.storage.local.get({ totalHandled: 0 }, (data) => {
      chrome.storage.local.set({ totalHandled: data.totalHandled + 1 });
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabCounts[tabId];
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabCounts[tabId] = 0;
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});
