const enabledToggle = document.getElementById("enabled");
const siteToggle = document.getElementById("siteToggle");
const totalHandledEl = document.getElementById("totalHandled");

let currentHost = null;

function getCurrentTabHost(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return callback(null);
    try {
      callback(new URL(tabs[0].url).hostname);
    } catch (e) {
      callback(null);
    }
  });
}

function refresh() {
  chrome.storage.sync.get({ enabled: true, disabledSites: [] }, (cfg) => {
    enabledToggle.checked = cfg.enabled;

    getCurrentTabHost((host) => {
      currentHost = host;
      if (host) {
        siteToggle.checked = cfg.enabled && !cfg.disabledSites.includes(host);
        siteToggle.disabled = false;
      } else {
        siteToggle.checked = false;
        siteToggle.disabled = true;
      }
    });
  });

  chrome.storage.local.get({ totalHandled: 0 }, (data) => {
    totalHandledEl.textContent = data.totalHandled;
  });
}

enabledToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledToggle.checked }, refresh);
});

siteToggle.addEventListener("change", () => {
  if (!currentHost) return;
  chrome.storage.sync.get({ disabledSites: [] }, (cfg) => {
    let list = cfg.disabledSites;
    if (siteToggle.checked) {
      list = list.filter((h) => h !== currentHost);
    } else if (!list.includes(currentHost)) {
      list = [...list, currentHost];
    }
    chrome.storage.sync.set({ disabledSites: list }, refresh);
  });
});

refresh();
