const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const backgroundSource = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");

function environment(initial = {}) {
  const data = {
    sync: structuredClone(initial.sync || {}),
    local: structuredClone(initial.local || {}),
    session: structuredClone(initial.session || {})
  };
  const listeners = {};
  const badgeCalls = [];
  const broadcasts = [];
  function event(name) {
    listeners[name] = [];
    return { addListener: (fn) => listeners[name].push(fn) };
  }
  const chrome = {
    runtime: { onMessage: event("message") },
    action: {
      setBadgeText: async (details) => { badgeCalls.push(details); },
      setBadgeBackgroundColor: async () => {}
    },
    tabs: {
      onRemoved: event("removed"),
      onUpdated: event("updated"),
      query: async () => [{ id: 3 }, { id: 8 }, { url: "chrome://settings" }],
      sendMessage: async (tabId, message) => {
        broadcasts.push({ tabId, message });
        if (tabId === 8) throw new Error("No receiving content script");
      }
    },
    storage: { onChanged: event("changed") }
  };
  for (const area of ["sync", "local", "session"]) {
    chrome.storage[area] = {
      get: async (defaults) => structuredClone({ ...defaults, ...data[area] }),
      set: async (values) => { Object.assign(data[area], structuredClone(values)); }
    };
  }
  vm.runInNewContext(backgroundSource, { chrome, URL });
  const send = (message, sender = {}) => new Promise((resolve, reject) => {
    try {
      const keepsOpen = listeners.message[0](message, sender, resolve);
      if (!keepsOpen) resolve(undefined);
    } catch (error) { reject(error); }
  });
  const emit = (type, ...args) => { for (const listener of listeners[type]) listener(...args); };
  return { data, listeners, send, emit, badgeCalls, broadcasts, chrome };
}

const sender = (tabId = 3, url = "https://news.example/article") => ({
  tab: { id: tabId, url }, url: "https://consent.vendor.example/dialog"
});
const attempt = { type: "rejection-attempt", method: "explicit-reject" };
const settle = async () => { for (let n = 0; n < 5; n++) await new Promise(setImmediate); };

test("site exemptions follow the top-level hostname for cross-origin frames", async () => {
  const env = environment({ sync: { disabledSites: ["NEWS.EXAMPLE"] } });
  assert.equal((await env.send({ type: "get-config" }, sender())).enabled, false);
  assert.equal((await env.send({ type: "get-config" }, sender(3, "https://other.example"))).enabled, true);
  assert.equal((await env.send({ type: "get-config" }, { url: "https://news.example/frame" })).enabled, false);
  assert.equal((await env.send({ type: "get-config" }, { url: "chrome://settings" })).enabled, false);
});

test("global disable and unreadable configuration fail closed", async () => {
  const env = environment({ sync: { enabled: false } });
  assert.equal((await env.send({ type: "get-config" }, sender())).enabled, false);
  assert.equal((await env.send(attempt, sender())).recorded, false);
  assert.deepEqual(env.data.local, {});
  env.chrome.storage.sync.get = async () => { throw new Error("Unavailable"); };
  assert.equal((await env.send({ type: "get-config" }, sender())).enabled, false);
});

test("simultaneous frame attempts retain every aggregate and per-tab count", async () => {
  const env = environment();
  const responses = await Promise.all(Array.from({ length: 40 }, (_, i) =>
    env.send(attempt, sender(i % 2 ? 3 : 8))));
  assert.ok(responses.every((response) => response.recorded));
  assert.equal(env.data.local.totalAttempts, 40);
  assert.deepEqual(env.data.session.tabAttempts, { 3: 20, 8: 20 });
  assert.deepEqual(Object.keys(env.data.local), ["totalAttempts"]);
  assert.deepEqual(Object.keys(env.data.session), ["tabAttempts"]);
});

test("worker restart retains page statistics and separates legacy hidden-banner counts", async () => {
  const first = environment({ local: { totalHandled: 900 } });
  await first.send(attempt, sender());
  const restarted = environment(first.data);
  await restarted.send(attempt, sender());
  assert.equal(restarted.data.local.totalHandled, 900);
  assert.equal(restarted.data.local.totalAttempts, 2);
  assert.equal(restarted.data.session.tabAttempts[3], 2);
  assert.equal(restarted.badgeCalls.at(-1).text, "2");
});

test("main navigation resets the page count; tab removal cleans session storage", async () => {
  const env = environment();
  await env.send(attempt, sender());
  env.emit("updated", 3, { status: "loading" });
  await settle();
  assert.deepEqual(env.data.session.tabAttempts, {});
  assert.equal(env.badgeCalls.at(-1).text, "");
  assert.equal(env.data.local.totalAttempts, 1);
  await env.send(attempt, sender());
  env.emit("removed", 3);
  await settle();
  assert.deepEqual(env.data.session.tabAttempts, {});
  assert.equal(env.data.local.totalAttempts, 2);
});

test("site configuration changes broadcast to every tab and tolerate restricted pages", async () => {
  const env = environment();
  env.emit("changed", { totalAttempts: { newValue: 3 } }, "local");
  await settle();
  assert.equal(env.broadcasts.length, 0);
  env.emit("changed", { disabledSites: { newValue: ["news.example"] } }, "sync");
  await settle();
  assert.deepEqual(env.broadcasts.map((item) => item.tabId), [3, 8]);
  assert.ok(env.broadcasts.every((item) => item.message.type === "config-changed"));
});

test("obsolete messages and malformed attempts cannot inflate statistics", async () => {
  const env = environment();
  await env.send({ type: "banner-handled" }, sender());
  await env.send(attempt, {});
  await env.send({ type: "rejection-attempt", method: "" }, sender());
  await env.send({ type: "rejection-attempt", method: "x".repeat(101) }, sender());
  assert.deepEqual(env.data.local, {});
  assert.deepEqual(env.data.session, {});
});
