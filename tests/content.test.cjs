const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { launchExtensionContext } = require('./browser-launch.cjs');

let server, context, worker, page, base;
const pages = new Map();
const errors = [];
const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:16px sans-serif} section,div[role=dialog]{padding:20px} button{padding:8px;margin:4px}
</style></head><body><script>window.events=[];</script>${body}</body></html>`;
function banner(buttons, attrs = 'id="cookie-banner" role="dialog"') {
  return `<section ${attrs}><p>We use cookies and ask for your consent.</p>${buttons}</section>`;
}
function rejectButton(text = 'Reject all', attrs = '') {
  return `<button ${attrs} onclick="events.push('reject');this.closest('section').hidden=true">${text}</button>`;
}
async function load(body) {
  const route = `/case-${pages.size}`;
  pages.set(route, shell(body));
  await page.goto(base + route);
}
async function rejected() { await page.waitForFunction(() => events.includes('reject')); }
async function quiet() { await page.waitForTimeout(1000); }
async function getEvents() { return page.evaluate(() => events); }

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(pages.get(req.url) || shell('fixture'));
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const extension = path.resolve(__dirname, '..');
  context = await launchExtensionContext(extension);
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
}, { timeout: 30000 });
beforeEach(async () => {
  await worker.evaluate(async () => {
    await chrome.storage.sync.set({ enabled: true, disabledSites: [] });
  });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
});
afterEach(async () => { await page.close(); });
after(async () => {
  await context?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert.deepEqual(errors, [], 'No page/extension script errors');
});

test('real MV3 extension records a rejection attempt and never accepts', async () => {
  const before = await worker.evaluate(async () => (await chrome.storage.local.get({ totalAttempts: 0 })).totalAttempts);
  await load(banner(`<button onclick="events.push('accept')">Accept all</button>${rejectButton('Reject all', 'id="onetrust-reject-all-handler"')}`, 'id="onetrust-banner-sdk"'));
  await rejected();
  await page.waitForTimeout(300);
  assert.deepEqual(await getEvents(), ['reject']);
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('totalAttempts')).totalAttempts), before + 1);
});

test('Cookiebot accept-only fallback stays visible and unclicked', async () => {
  await load(banner('<button id="CybotCookiebotDialogBodyLevelButtonAccept" onclick="events.push(\'accept\')">Allow all</button>', 'id="CybotCookiebotDialog"'));
  await quiet();
  assert.deepEqual(await getEvents(), []);
  assert.equal(await page.locator('section').isVisible(), true);
});

for (const label of ['Reject all', 'Alle ablehnen', 'Tout refuser', 'Rechazar todo', 'Rifiuta tutti', 'Alles weigeren', 'رفض الكل', 'すべて拒否']) {
  test(`custom consent banner rejects ${label}`, async () => {
    await load(banner(rejectButton(label)));
    await rejected();
    assert.deepEqual(await getEvents(), ['reject']);
  });
}

test('unrelated Reject, No thanks and Save buttons remain untouched', async () => {
  await load('<main id="cookie-recipes"><h1>Cookie recipes</h1><button onclick="events.push(\'order\')">Reject</button><button>No thanks</button><button>Save</button></main>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

test('hidden duplicates, disabled fieldsets and inert ancestors are ignored', async () => {
  await load(banner('<div hidden><button id="onetrust-reject-all-handler" onclick="events.push(\'hidden\')">Reject all</button></div><fieldset disabled><button onclick="events.push(\'disabled\')">Reject all</button></fieldset><div inert><button onclick="events.push(\'inert\')">Reject all</button></div>' + rejectButton(), 'id="onetrust-banner-sdk"'));
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('conflicting accessible labels on a known reject selector are ignored', async () => {
  await load(banner('<button id="onetrust-reject-all-handler" aria-label="Accept all" onclick="events.push(\'wrong\')">Reject all</button>', 'id="onetrust-banner-sdk"'));
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

test('navigating preference links are not followed', async () => {
  await load(banner('<a href="/privacy" onclick="events.push(\'navigate\')">Cookie settings</a>'));
  const url = page.url();
  await quiet();
  assert.equal(page.url(), url);
  assert.deepEqual(await getEvents(), []);
});

test('opens preferences, turns optional categories off and saves, preserving necessary cookies', async () => {
  await load(banner('<button id="manage">Cookie settings</button>') + `<script>
  document.querySelector('#manage').onclick=()=>{
    events.push('manage');
    document.querySelector('section').innerHTML='<h2>Cookie preferences</h2><label><input id="necessary" type="checkbox" checked disabled>Strictly necessary cookies</label><label><input id="analytics" type="checkbox" checked>Analytics cookies</label><label><input id="marketing" type="checkbox" checked>Marketing cookies</label><button id="save">Save preferences</button>';
    document.querySelector('#save').onclick=()=>{events.push([necessary.checked,analytics.checked,marketing.checked]);document.querySelector('section').hidden=true;};
  };</script>`);
  await page.waitForFunction(() => events.some(Array.isArray), null, { timeout: 8000 });
  assert.deepEqual(await getEvents(), ['manage', [true, false, false]]);
});

for (const label of ['Disable analytics', 'Block marketing cookies', 'Opt-out of analytics', 'Do not sell my personal information', 'Mystery category']) {
  test(`ambiguous/inverted checkbox is preserved: ${label}`, async () => {
    await load(banner(`<label><input type="checkbox" checked>${label}</label><button onclick="events.push('save')">Save preferences</button>`));
    await quiet();
    assert.equal(await page.locator('input').isChecked(), true);
    assert.deepEqual(await getEvents(), []);
  });
}

test('asynchronous ARIA switches settle before preferences are saved', async () => {
  await load(banner(`<button role="switch" aria-label="Analytics cookies" aria-checked="true" onclick="setTimeout(()=>this.setAttribute('aria-checked','false'),300)">Analytics cookies</button><button onclick="events.push(document.querySelector('[role=switch]').getAttribute('aria-checked'));this.closest('section').hidden=true">Save preferences</button>`));
  await page.waitForFunction(() => events.length);
  assert.deepEqual(await getEvents(), ['false']);
});

test('late injected and attribute-revealed banners are handled', async () => {
  await load(banner(rejectButton(), 'id="cookie-banner" role="dialog" hidden'));
  await quiet();
  await page.locator('section').evaluate(el => { el.hidden = false; });
  await rejected();
});

test('SPA reuses a previously hidden banner', async () => {
  await load(banner(rejectButton()));
  await rejected();
  await page.waitForTimeout(1800);
  await page.locator('section').evaluate(el => { el.hidden = false; });
  await page.waitForFunction(() => events.length === 2);
});

test('open and nested shadow-root banners are handled', async () => {
  await load('<div id="host"></div>');
  await page.evaluate(html => {
    const root = document.querySelector('#host').attachShadow({ mode: 'open' });
    const child = document.createElement('div'); root.append(child);
    child.attachShadow({ mode: 'open' }).innerHTML = html;
  }, banner(rejectButton()));
  await rejected();
});

test('closed shadow-root banner attached to an existing host is found', async () => {
  await load('<div id="host"></div>');
  await quiet();
  await page.evaluate(html => { document.querySelector('#host').attachShadow({ mode: 'closed' }).innerHTML = html; }, banner(rejectButton()));
  await page.waitForFunction(() => events.includes('reject'), null, { timeout: 10000 });
});

test('cross-origin iframe and about:blank frame receive the extension', async () => {
  pages.set('/frame', shell(banner(rejectButton())));
  await load(`<iframe src="http://localhost:${server.address().port}/frame"></iframe><iframe id="blank"></iframe>`);
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 2);
  const frame = page.frames().find(item => item.url().includes('localhost'));
  await frame.waitForFunction(() => events.includes('reject'));
  const blank = page.frames().find(item => item.url() === 'about:blank');
  await blank.evaluate(html => { document.body.innerHTML = html; window.events = []; }, banner(rejectButton()));
  await blank.waitForFunction(() => events.includes('reject'));
});

test('top-site exemption pauses third-party frames and re-enables without reload', async () => {
  await worker.evaluate(async () => chrome.storage.sync.set({ disabledSites: ['127.0.0.1'] }));
  pages.set('/paused-frame', shell(banner(rejectButton())));
  await load(`<iframe src="http://localhost:${server.address().port}/paused-frame"></iframe>`);
  await quiet();
  const frame = page.frames().find(item => item.url().includes('localhost'));
  assert.deepEqual(await frame.evaluate(() => events), []);
  await worker.evaluate(async () => chrome.storage.sync.set({ disabledSites: [] }));
  await frame.waitForFunction(() => events.includes('reject'));
});

test('global pause applies immediately to an already loaded page', async () => {
  await load(banner(rejectButton(), 'id="cookie-banner" role="dialog" hidden'));
  await worker.evaluate(async () => chrome.storage.sync.set({ enabled: false }));
  await page.waitForTimeout(250);
  await page.locator('section').evaluate(el => { el.hidden = false; });
  await quiet();
  assert.deepEqual(await getEvents(), []);
  await worker.evaluate(async () => chrome.storage.sync.set({ enabled: true }));
  await rejected();
});

for (const label of ["Don't allow these cookies", 'No analytics', 'Не разрешать эти файлы cookie']) {
  test(`an explicit unknown toggle label cannot be overridden by a category heading: ${label}`, async () => {
    await load(banner(`<div><h3>Analytics</h3><label><input type="checkbox" checked onchange="events.push('toggle')">${label}</label></div><button onclick="events.push('save')">Save preferences</button>`));
    await quiet();
    assert.equal(await page.locator('input').isChecked(), true);
    assert.deepEqual(await getEvents(), []);
  });
}

test('conflicting necessary and optional category labels prevent saving', async () => {
  await load(banner(`<div><h3>Necessary</h3><label><input type="checkbox" checked onchange="events.push('toggle')">Analytics</label></div><label><input type="checkbox">Marketing</label><button onclick="events.push('save')">Save preferences</button>`));
  await quiet();
  assert.equal(await page.locator('input').first().isChecked(), true);
  assert.deepEqual(await getEvents(), []);
});

test('a checkbox submission value does not establish category semantics', async () => {
  await load(banner(`<input type="checkbox" value="analytics" checked onchange="events.push('toggle')"><button onclick="events.push('save')">Save preferences</button>`));
  await quiet();
  assert.equal(await page.locator('input').isChecked(), true);
  assert.deepEqual(await getEvents(), []);
});

test('indeterminate category checkboxes prevent automatic saving', async () => {
  await load(banner(`<label><input id="mixed" type="checkbox">Analytics</label><button onclick="events.push('save')">Save preferences</button>`) + '<script>document.querySelector("#mixed").indeterminate=true;</script>');
  await quiet();
  assert.equal(await page.locator('input').evaluate(el => el.indeterminate), true);
  assert.deepEqual(await getEvents(), []);
});

test('nested consent wrappers share retry limits and report one workflow', async () => {
  const before = await worker.evaluate(async () => (await chrome.storage.local.get({ totalAttempts: 0 })).totalAttempts);
  await load(banner('<div class="consent-panel"><p>Cookie settings</p><button onclick="events.push(\'reject\')">Reject all</button></div>'));
  await page.waitForFunction(() => events.length === 3);
  await quiet();
  assert.deepEqual(await getEvents(), ['reject', 'reject', 'reject']);
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('totalAttempts')).totalAttempts), before + 1);
});

test('large pages with ordinary preference controls remain responsive', async () => {
  await load('<div><h1>Account settings</h1>' + '<div>Record<button>Save preferences</button></div>'.repeat(5000) + '</div><script>const scanStart=performance.now();setTimeout(()=>window.scanDelay=performance.now()-scanStart,500);</script>');
  await page.waitForFunction(() => typeof window.scanDelay === 'number');
  assert.ok(await page.evaluate(() => scanDelay < 2500), 'Consent discovery must not block the page for several seconds');
  assert.deepEqual(await getEvents(), []);
});

test('a product-order dialog about edible cookies is not a cookie consent banner', async () => {
  await load('<div role="dialog"><p>Order a box of cookies?</p><button onclick="events.push(\'order\')">No thanks</button></div>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

test('a provider shadow host qualifies unknown-language explicit refusal controls', async () => {
  await load('<div id="usercentrics-root"></div>');
  await page.evaluate(() => {
    document.querySelector('#usercentrics-root').attachShadow({ mode: 'closed' }).innerHTML =
      '<section><button data-testid="uc-deny-all-button">Unlisted translation</button></section>';
    // Keep a fixture-only handle to observe the page outcome, not the closed root.
    document.querySelector('#usercentrics-root').addEventListener('click', () => {
      events.push('reject'); document.querySelector('#usercentrics-root').hidden = true;
    });
  });
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('Google full-page consent uses exact labels even when cookie text is outside the form', async () => {
  await page.route('https://consent.google.com/**', route => route.fulfill({
    contentType: 'text/html', body: shell('<p>We use cookies and data for our services.</p><form action="/save"><button onclick="events.push(\'accept\');event.preventDefault()">Accept all</button><button onclick="events.push(\'reject\');event.preventDefault();this.form.hidden=true">Reject all</button></form>')
  }));
  await page.goto('https://consent.google.com/test-fixture');
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

for (const subject of ['Do you consent to the medical procedure?', 'Please review the payment data processing consent.']) {
  test(`unrelated consent dialog remains untouched: ${subject}`, async () => {
    await load(`<div role="dialog"><p>${subject}</p><button onclick="events.push('reject-unrelated')">Reject</button><button>Accept</button></div>`);
    await quiet();
    assert.deepEqual(await getEvents(), []);
    assert.equal(await page.locator('[role="dialog"]').isVisible(), true);
  });
}

function oneTrustPreferences(utilityMarkup, root = 'onetrust-pc-sdk', listAttrs = 'style="display:none"', checked = '') {
  return banner(`<div class="category"><h4 id="performance-title">Performance cookies</h4>
    <div><input type="checkbox" id="performance" aria-labelledby="performance-title" ${checked} onchange="events.push('toggle')"><label for="performance">Performance cookies</label></div>
    <p>If you do not allow these cookies, we will not know when you visited.</p></div>
    <div id="ot-pc-lst" ${listAttrs}>${utilityMarkup}</div>
    <button class="save-preference-btn-handler" onclick="events.push('save');this.closest('section').hidden=true">Confirm my choices</button>`, `id="${root}" role="dialog"`);
}
const utilityTemplates = '<input id="chkbox-id" class="category-filter-handler" type="checkbox"><label for="chkbox-id">checkbox label</label>' +
  ['hosts-groups', 'vendor-groups', 'vendor-leg'].map(kind => `<input id="select-all-${kind}-handler" type="checkbox"><label for="select-all-${kind}-handler">checkbox label</label>`).join('');

test('OneTrust saves necessary-only preferences despite inactive hidden list templates', async () => {
  await load(oneTrustPreferences(utilityTemplates));
  await page.waitForFunction(() => events.includes('save'));
  assert.deepEqual(await getEvents(), ['save']);
});

test('positive category labels remain valid when descriptions explain not allowing cookies', async () => {
  await load(oneTrustPreferences(utilityTemplates, 'onetrust-pc-sdk', 'style="display:none"', 'checked'));
  await page.waitForFunction(() => events.includes('save'));
  assert.deepEqual(await getEvents(), ['toggle', 'save']);
  assert.equal(await page.locator('#performance').isChecked(), false);
});

for (const [name, markup, listAttrs = 'style="display:none"', root = 'onetrust-pc-sdk'] of [
  ['checked master', '<input id="select-all-hosts-groups-handler" type="checkbox" checked>'],
  ['mixed ARIA master', '<input id="select-all-hosts-groups-handler" type="checkbox" aria-checked="mixed">'],
  ['ARIA true master', '<input id="select-all-hosts-groups-handler" type="checkbox" aria-checked="true">'],
  ['partial selection class', '<span class="line-through"><input id="select-all-hosts-groups-handler" type="checkbox"></span>'],
  ['unknown hidden control', '<input id="unrecognized-checkbox" type="checkbox">'],
  ['non-native control', '<div id="select-all-hosts-groups-handler" role="checkbox" aria-checked="false"></div>'],
  ['real purpose metadata', '<input id="select-all-hosts-groups-handler" type="checkbox" data-purposeid="7">'],
  ['visible list control', '<input id="select-all-hosts-groups-handler" type="checkbox"><label for="select-all-hosts-groups-handler">checkbox label</label>', ''],
  ['same ID outside OneTrust', '<input id="select-all-hosts-groups-handler" type="checkbox">', 'style="display:none"', 'cookie-preferences'],
  ['unhidden list with invisible input', '<input style="opacity:0" id="select-all-hosts-groups-handler" type="checkbox">', ''],
]) {
  test(`OneTrust template exception leaves unsafe or unknown state unresolved: ${name}`, async () => {
    await load(oneTrustPreferences(markup, root, listAttrs));
    await quiet();
    assert.deepEqual(await getEvents(), []);
    assert.equal(await page.locator('section').isVisible(), true);
  });
}

test('OneTrust hidden template with a visible associated label still blocks saving', async () => {
  await load(oneTrustPreferences('<input id="select-all-hosts-groups-handler" type="checkbox">') + '<label for="select-all-hosts-groups-handler">Unclassified choice</label>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

test('native checkbox with mixed ARIA state cannot be saved as optional-off', async () => {
  await load(banner('<label><input type="checkbox" aria-checked="mixed">Analytics cookies</label><button onclick="events.push(\'save\')">Save preferences</button>'));
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

for (const fixture of require('./fixtures/recognition.json')) {
  test(`expanded accessible and typographic recognition: ${fixture.id}`, async () => {
    await load(fixture.html);
    if (fixture.expectClicks) await rejected(); else await quiet();
    assert.deepEqual(await getEvents(), fixture.expectClicks ? ['reject'] : []);
  });
}

test('relative-position alert cookie banners support Microsoft WCP-style controls', async () => {
  await load('<div id="wcpConsentBannerCtrl" role="alert" style="position:relative"><p>We use optional cookies to improve our services.</p><button onclick="events.push(\'accept\')">Accept</button><button onclick="events.push(\'reject\');this.parentElement.hidden=true">Reject</button><button>Manage cookies</button></div>');
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('zero-height CMP wrappers still expose visible fixed rejection controls', async () => {
  await load('<div id="onetrust-banner-sdk" style="height:0"><div style="position:fixed;bottom:0"><button id="onetrust-reject-all-handler" onclick="events.push(\'reject\');this.parentElement.parentElement.hidden=true">Unlisted translation</button></div></div>');
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('display-contents consent dialogs use their accessible name', async () => {
  await load('<div role="dialog" aria-label="Cookie consent" style="display:contents"><button onclick="events.push(\'reject\');this.parentElement.hidden=true">Reject all</button></div>');
  await rejected();
});

test('hidden CMP wrappers cannot expose their fixed child controls', async () => {
  await load('<div id="onetrust-banner-sdk" hidden><div style="position:fixed"><button id="onetrust-reject-all-handler" onclick="events.push(\'wrong\')">Reject all</button></div></div>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

for (const rejectClass of ['sp_choice_type_13', 'sp_choice_type_REJECT_ALL']) {
  test(`Sourcepoint chooses only its documented reject action: ${rejectClass}`, async () => {
    await load(`<section class="sp_message_container"><button class="sp_choice_type_11" onclick="events.push('accept')">Unlisted accept translation</button><button class="sp_choice_type_12" onclick="events.push('manage')">Open settings</button><button class="${rejectClass}" onclick="events.push('reject');this.closest('section').hidden=true">Unlisted refusal translation</button></section>`);
    await rejected();
    assert.deepEqual(await getEvents(), ['reject']);
  });
}

test('Sourcepoint documented action classes work in modern message templates', async () => {
  await load('<div class="message"><button class="sp_choice_type_11" onclick="events.push(\'accept\')">Accept all</button><button class="sp_choice_type_13" onclick="events.push(\'reject\');this.hidden=true">Unlisted refusal translation</button></div>');
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('Sourcepoint acceptance metadata overrides misleading button text', async () => {
  await load('<section class="sp_message"><button class="sp_choice_type_11" onclick="events.push(\'wrong\')">Reject all</button></section>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

test('Sourcepoint subscription and custom JavaScript choices are never guessed as rejection', async () => {
  await load('<section class="sp_message"><button class="sp_choice_type_9" onclick="events.push(\'wrong\')">Reject all and subscribe</button></section>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});

for (const choice of ['11', '9', '1', '15', '5']) {
  test(`modern Sourcepoint non-refusal metadata cannot be overridden by its label: ${choice}`, async () => {
    await load(`<div role="dialog" aria-label="Cookie consent"><button class="sp_choice_type_${choice}" onclick="events.push('wrong')">Reject all</button></div>`);
    await quiet();
    assert.deepEqual(await getEvents(), []);
  });
}

for (const label of ['Manage preferences', 'Save preferences']) {
  test(`Sourcepoint custom JavaScript is not a settings/save action merely because of its label: ${label}`, async () => {
    await load(`<section class="sp_message"><p>Cookie consent</p><label><input type="checkbox">Analytics cookies</label><button class="sp_choice_type_9" onclick="events.push('wrong')">${label}</button></section>`);
    await quiet();
    assert.deepEqual(await getEvents(), []);
  });
}

test('Sourcepoint explicit privacy-manager action can lead to its explicit refusal', async () => {
  await load('<section><button class="sp_choice_type_12" onclick="events.push(\'manage\');this.hidden=true;document.querySelector(\'#sp-refusal\').hidden=false">Open privacy options</button><button id="sp-refusal" class="sp_choice_type_REJECT_ALL" hidden onclick="events.push(\'reject\');this.closest(\'section\').hidden=true">Vendor refusal action</button></section>');
  await rejected();
  assert.deepEqual(await getEvents(), ['manage', 'reject']);
});

for (const fixture of require('./fixtures/providers.json')) {
  test(`source-verified provider adapter: ${fixture.caseId}`, async () => {
    const html = await page.evaluate(({ html, rejectSelectors }) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const targets = new Set(rejectSelectors.flatMap(selector => [...doc.querySelectorAll(selector)]));
      if (!targets.size) throw Error('Fixture has no source-verified reject control');
      for (const el of targets) {
        // Force the explicit provider route, independently of generic translation matching.
        el.textContent = 'Vendor refusal action';
        for (const attr of ['aria-label', 'aria-labelledby', 'title']) el.removeAttribute(attr);
      }
      return doc.body.innerHTML;
    }, fixture);
    await load(html);
    await rejected();
    assert.deepEqual(await getEvents(), ['reject']);
  });
}

test('legacy CookieConsent opens settings before using its explicit necessary-only control', async () => {
  await load(`<section><div id="cc_div"><div id="cm"><p>We use cookies.</p><button data-cc="c-settings" onclick="events.push('manage');document.querySelector('#cm').hidden=true;document.querySelector('#s-cnt').hidden=false">Open options</button></div><div id="s-cnt" hidden><button id="s-all-bn" onclick="events.push('accept')">Accept all</button><button id="s-rall-bn" onclick="events.push('reject');this.closest('section').hidden=true">Vendor refusal action</button></div></div></section>`);
  await rejected();
  assert.deepEqual(await getEvents(), ['manage', 'reject']);
});

test('Axeptio TCF explicit refusal is found inside a closed shadow root', async () => {
  await load('<div id="random-vendor-host"></div>');
  await page.evaluate(() => {
    document.querySelector('#random-vendor-host').attachShadow({ mode:'closed' }).innerHTML =
      '<div class="modal-dialog" role="dialog"><button id="axeptio_btn_acceptAll" onclick="window.events.push(\'accept\')">Accept all</button><button id="axeptio_btn_dismiss" onclick="window.events.push(\'reject\');this.parentElement.hidden=true">Vendor refusal action</button></div>';
  });
  await rejected();
  assert.deepEqual(await getEvents(), ['reject']);
});

test('unrelated sliding popups are not Drupal cookie consent', async () => {
  await load('<div id="sliding-popup" role="dialog"><p>Decline this purchase offer?</p><button class="decline-button" onclick="events.push(\'wrong\')">Decline</button></div>');
  await quiet();
  assert.deepEqual(await getEvents(), []);
});
