const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../consent-rules.js'), 'utf8'), sandbox);
const rules = sandbox.CookieConsentRules;

test('exact refusal phrases normalize whitespace, Unicode width and punctuation', () => {
  for (const text of [' Reject\u00a0all! ', 'REJECT ALL', 'Ｒｅｊｅｃｔ ａｌｌ', 'رفض الكل', 'すべて拒否', 'Alle ablehnen', 'Accept only necessary cookies']) {
    assert.equal(rules.classifyLabel(text), 'reject', text);
  }
  for (const text of ['Reject all and subscribe', 'Accept all', 'Allow all cookies', 'All cookies accepted', 'I reject this order']) {
    assert.notEqual(rules.classifyLabel(text), 'reject', text);
  }
});

test('action categories do not overlap and configuration is deeply frozen', () => {
  const actions = ['reject', 'manage', 'save', 'accept'];
  const seen = new Map();
  for (const kind of actions) for (const label of rules.labels[kind]) {
    assert.equal(seen.has(label), false, `${label} appears in ${seen.get(label)} and ${kind}`);
    seen.set(label, kind);
    assert.equal(rules.classifyLabel(label), kind);
  }
  assert.equal(Object.isFrozen(rules), true);
  assert.equal(Object.isFrozen(rules.providers), true);
  assert.equal(Object.isFrozen(rules.labels), true);
  for (const provider of rules.providers) {
    assert.equal(Object.isFrozen(provider), true);
    assert.equal(Object.isFrozen(provider.reject), true);
  }
});

test('dangerous old accept, first-button and secondary selectors cannot return', () => {
  const selectors = rules.providers.flatMap(provider => provider.reject);
  for (const selector of selectors) {
    assert.doesNotMatch(selector, /nth-(?:child|of-type)|\[mode=['"]?secondary|CybotCookiebotDialogBodyLevelButtonAccept(?:\b|$)|didomi-button-highlight-secondary/);
  }
});
