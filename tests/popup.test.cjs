const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");

async function popup(initial = {}) {
  const data = {
    sync: { ...(initial.sync || {}) },
    local: { ...(initial.local || {}) },
    session: { ...(initial.session || {}) }
  };
  const elements = {};
  for (const id of ["enabled", "siteToggle", "siteHost", "totalAttempts", "tabAttempts", "legacyNote", "status"]) {
    elements[id] = { checked: false, disabled: false, hidden: false, textContent: "", listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; }
    };
  }
  const storageListeners = [];
  const chrome = {
    tabs: { query: async () => [{ id: 12, url: initial.url || "https://example.com/article" }] },
    storage: { onChanged: { addListener: (fn) => storageListeners.push(fn) } }
  };
  for (const area of ["sync", "local", "session"]) {
    chrome.storage[area] = {
      get: async (defaults) => ({ ...defaults, ...data[area] }),
      set: async (values) => { Object.assign(data[area], structuredClone(values)); }
    };
  }
  vm.runInNewContext(source, { chrome, URL, document: { getElementById: (id) => elements[id] } });
  const settle = async () => { for (let n = 0; n < 3; n++) await new Promise(setImmediate); };
  await settle();
  return { elements, data, storageListeners, settle };
}

test("popup distinguishes rejection attempts, current page counts, and legacy interactions", async () => {
  const { elements } = await popup({
    local: { totalAttempts: 20, totalHandled: 100 }, session: { tabAttempts: { 12: 2 } }
  });
  assert.equal(elements.siteHost.textContent, "example.com");
  assert.equal(elements.totalAttempts.textContent, "20");
  assert.equal(elements.tabAttempts.textContent, "2");
  assert.equal(elements.legacyNote.hidden, false);
  assert.match(elements.legacyNote.textContent, /100 interactions/);
  assert.match(elements.legacyNote.textContent, /only hid banners/);
  assert.equal(elements.status.textContent, "Active on this site");
});

test("site preference remains separate from a global pause and is disabled until resumed", async () => {
  const { elements, data } = await popup({ sync: { enabled: false } });
  assert.equal(elements.enabled.checked, false);
  assert.equal(elements.siteToggle.checked, true);
  assert.equal(elements.siteToggle.disabled, true);
  assert.equal(elements.status.textContent, "Paused everywhere");
  elements.enabled.checked = true;
  await elements.enabled.listeners.change();
  assert.equal(data.sync.enabled, true);
  assert.equal(elements.siteToggle.disabled, false);
});

test("site toggle saves an exact hostname exclusion and can remove it", async () => {
  const { elements, data } = await popup({ sync: { disabledSites: ["other.example"] } });
  elements.siteToggle.checked = false;
  await elements.siteToggle.listeners.change();
  assert.deepEqual(data.sync.disabledSites, ["other.example", "example.com"]);
  assert.equal(elements.status.textContent, "Paused on this site");
  elements.siteToggle.checked = true;
  await elements.siteToggle.listeners.change();
  assert.deepEqual(data.sync.disabledSites, ["other.example"]);
});

test("browser pages cannot be added to site exceptions", async () => {
  const { elements, data } = await popup({ url: "chrome://extensions/" });
  assert.equal(elements.siteToggle.disabled, true);
  assert.equal(elements.siteHost.textContent, "Unavailable on this page");
  await elements.siteToggle.listeners.change();
  assert.equal(data.sync.disabledSites, undefined);
});

test("storage events update the visible counters without reopening the popup", async () => {
  const { elements, data, storageListeners, settle } = await popup();
  data.local.totalAttempts = 9;
  storageListeners[0]({ totalAttempts: { newValue: 9 } }, "local");
  await settle();
  assert.equal(elements.totalAttempts.textContent, "9");
  data.session.tabAttempts = { 12: 3 };
  storageListeners[0]({ tabAttempts: { newValue: data.session.tabAttempts } }, "session");
  await settle();
  assert.equal(elements.tabAttempts.textContent, "3");
});
