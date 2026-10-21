/* Consent decisions stay in the isolated world. Banners are never merely hidden. */
(() => {
  'use strict';
  const rules = globalThis.CookieConsentRules;
  if (!rules) return;
  const CONTROL = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  const TOGGLE = 'input[type="checkbox"], [role="switch"], [role="checkbox"]';
  const CANDIDATE = 'dialog, [role="dialog"], [role="alertdialog"], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i]';
  const roots = new Map();
  const contexts = new Map();
  const normalize = rules.normalizeLabel;
  const necessaryLabels = new Set(rules.labels.necessary.map(normalize));
  const optionalLabels = new Set((rules.labels.optional || []).map(normalize));
  let enabled = false, configRevision = 0, timer = null, poll = null;
  let discoveryTimer = null, discovery = [], nextDiscovery = 0, lastSweep = 0;
  let visibilityCache = new WeakMap(), kindCache = new WeakMap(), contextCache = new WeakMap();

  function query(root, selector) {
    try { return Array.from(root.querySelectorAll(selector)); } catch { return []; }
  }
  function parentOf(el) { return el.parentElement || el.getRootNode()?.host || null; }
  function visible(el) {
    if (visibilityCache.has(el)) return visibilityCache.get(el);
    const result = visibleUncached(el);
    if (el) visibilityCache.set(el, result);
    return result;
  }
  function visibleUncached(el) {
    if (!el?.isConnected || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    for (let node = el; node; node = parentOf(node)) {
      if (node.hidden || node.inert || node.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function available(el) {
    return !el.disabled && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[inert]');
  }
  function names(el) {
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => el.getRootNode().getElementById?.(id)?.textContent || '').join(' ');
    return [el.getAttribute('aria-label'), labelled, el.tagName === 'INPUT' ? el.value : el.innerText || el.textContent, el.getAttribute('title')]
      .filter(text => text && text.trim() && text.length <= 180).map(normalize);
  }
  function kind(el) {
    if (kindCache.has(el)) return kindCache.get(el);
    const kinds = new Set(names(el).map(rules.classifyLabel).filter(Boolean));
    const result = kinds.size === 1 ? [...kinds][0] : null;
    kindCache.set(el, result);
    return result;
  }
  function safeLink(el) {
    if (el.tagName !== 'A' || !el.hasAttribute('href')) return true;
    const href = el.getAttribute('href').trim();
    return !el.hasAttribute('download') && (!href || href.startsWith('#'));
  }
  function clickable(el) { return visible(el) && available(el) && safeLink(el); }
  function hasTerm(text, terms) {
    return terms.some(term => {
      const needle = normalize(term), index = text.indexOf(needle);
      if (index < 0) return false;
      if (/^[a-z\s]+$/.test(needle)) {
        return (index === 0 || !/[a-z]/.test(text[index - 1])) &&
          (index + needle.length === text.length || !/[a-z]/.test(text[index + needle.length]));
      }
      return true;
    });
  }
  function genericContext(el) {
    if (!el || ['HTML', 'BODY', 'MAIN'].includes(el.tagName)) return false;
    if (contextCache.has(el)) return contextCache.get(el);
    const result = genericContextUncached(el);
    contextCache.set(el, result);
    return result;
  }
  function genericContextUncached(el) {
    const hint = `${el.id} ${typeof el.className === 'string' ? el.className : ''}`;
    const style = getComputedStyle(el);
    const dedicated = /^(consent\.google\.com|consent\.youtube\.com)$/.test(location.hostname) && el.tagName === 'FORM';
    const shape = dedicated || el.matches('dialog, [role="dialog"], [role="alertdialog"]') ||
      style.position === 'fixed' || style.position === 'sticky' ||
      /(?:cookie|consent|gdpr)[-_ ]?(?:banner|modal|dialog|notice|settings|preferences)|(?:banner|modal|dialog)[-_ ]?(?:cookie|consent)|consent/i.test(hint);
    if (!shape || !visible(el)) return false;
    const raw = (dedicated ? document.body?.textContent : el.textContent) || '';
    if (raw.length > 16000) return false;
    const text = normalize((dedicated ? document.body?.innerText : el.innerText) || raw);
    const cookieTerms = rules.labels.cookieContext || rules.labels.consent;
    if (!hasTerm(text, cookieTerms)) return false;
    const technicalTerms = rules.labels.consent.filter(term => !cookieTerms.includes(term));
    // A shopping dialog about edible cookies is not a consent banner.
    return dedicated || /cookie[-_ ]?(?:banner|modal|dialog|notice|settings|preferences|consent)|consent|gdpr/i.test(hint) ||
      hasTerm(text, technicalTerms) || /\b(?:use|uses|using|manage|optional|essential|necessary|tracking) (?:the |our |these )?cookies\b/.test(text);
  }
  function collectContexts(root) {
    const found = new Map();
    for (const provider of rules.providers) {
      for (const selector of provider.roots) {
        // Some CMPs use the known root as the shadow host itself.
        if (root.host?.matches(selector) && visible(root.host)) found.set(root, provider);
        for (const el of query(root, selector)) {
          if (el !== document.body && el !== document.documentElement && visible(el)) found.set(el, provider);
        }
      }
    }
    for (const el of query(root, CANDIDATE)) if (!found.has(el) && genericContext(el)) found.set(el, null);
    // Custom banners without identifying attributes can be found through their controls.
    for (const el of query(root, CONTROL)) {
      if (!['reject', 'manage'].includes(kind(el))) continue;
      let container = parentOf(el);
      for (let level = 0; container && level < 6; level++, container = parentOf(container)) {
        if (genericContext(container)) {
          if (!found.has(container)) found.set(container, null);
          break;
        }
      }
    }
    const entries = [...found];
    // Nested wrappers represent one workflow. Prefer a verified provider root;
    // otherwise retain the outer container so saving checks every category.
    return entries.filter(([el, provider]) => !entries.some(([other, otherProvider]) =>
      other !== el && ((otherProvider && !provider && (other.contains(el) || el.contains(other))) ||
        (!!provider === !!otherProvider && other.contains(el)))));
  }
  function findAction(container, provider, action) {
    for (const selector of provider?.[action] || []) for (const el of query(container, selector)) {
      const kinds = new Set(names(el).map(rules.classifyLabel).filter(Boolean));
      if (clickable(el) && [...kinds].every(detected => detected === action)) return el;
    }
    return query(container, CONTROL).find(el => kind(el) === action && clickable(el));
  }
  function stateFor(container) {
    const previous = contexts.get(container);
    if (previous?.lastControl && !container.contains(previous.lastControl)) contexts.delete(container);
    if (!contexts.has(container)) contexts.set(container, { lastAction: 0, rejectTries: 0, manageTries: 0, toggleTries: new WeakMap(), reported: false, changes: 0 });
    return contexts.get(container);
  }
  function report(state, method) {
    if (state.reported) return;
    state.reported = true;
    try { chrome.runtime.sendMessage({ type: 'rejection-attempt', method }).catch(() => {}); } catch { /* extension reloaded */ }
  }
  function click(el, state) {
    if (!enabled || !available(el)) return false;
    state.lastAction = Date.now();
    state.lastControl = el;
    try { el.click(); schedule(250); return true; } catch { return false; }
  }
  function toggleCategory(el) {
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => el.getRootNode().getElementById?.(id)?.textContent || '').join(' ');
    const directLabels = [el.getAttribute('aria-label') || '', labelled,
      el.tagName === 'INPUT' ? '' : el.innerText || el.textContent || '',
      ...[...(el.labels || [])].map(label => label.innerText || label.textContent)].map(normalize).filter(Boolean);
    const labels = [...directLabels];
    const directCategory = directLabels.some(text => necessaryLabels.has(text) || optionalLabels.has(text));
    let row = el.parentElement;
    for (let i = 0; row && i < 3; i++, row = row.parentElement) {
      if (query(row, TOGGLE).length > 1) break;
      const rowText = normalize(row.innerText || row.textContent || '');
      // An explanatory paragraph such as "If you do not allow these cookies"
      // does not invert an explicitly named positive category switch.
      if (!directCategory && rowText.length <= 500) labels.push(rowText);
      for (const heading of query(row, 'h2, h3, h4, h5, legend, [class*="title" i], [class*="heading" i]')) labels.push(normalize(heading.textContent || ''));
    }
    // Only exact positive category labels carry semantics. IDs and names cannot
    // tell whether a checkbox enables tracking or opts out of it.
    const inverted = /\b(do not|don't|don t|opt out|opt-out|object to|disable|disabled|block|blocked|disallow|prevent|stop|turn off|ne pas|desactiver|deaktivieren|disattiva|desactivar|niet toestaan|nicht verkaufen)\b/;
    if (labels.some(text => inverted.test(text))) return null;
    if (directLabels.some(text => !necessaryLabels.has(text) && !optionalLabels.has(text) && !['on', 'off'].includes(text))) return null;
    const isNecessary = labels.some(text => necessaryLabels.has(text));
    const isOptional = labels.some(text => optionalLabels.has(text));
    if (isNecessary && isOptional) return null;
    if (isNecessary) return 'necessary';
    if (isOptional) return 'optional';
    return null;
  }
  function preferenceAction(container, provider, state) {
    const toggles = query(container, TOGGLE);
    if (!toggles.length || toggles.length > 100 || state.changes >= 100 || query(container, 'input[type="radio"], [role="radio"]').length) return false;
    let optional = 0;
    for (const el of toggles) {
      const ariaChecked = el.getAttribute('aria-checked');
      if (el.indeterminate || ariaChecked === 'mixed') return false;
      const utilityPanel = provider?.id === 'onetrust' ? el.closest('#ot-pc-lst') : null;
      if (el.tagName === 'INPUT' && el.type === 'checkbox' && !el.checked &&
          utilityPanel && container.contains(utilityPanel) && !visible(utilityPanel) &&
          !el.hasAttribute('data-optanongroupid') && !el.hasAttribute('data-purposeid') &&
          (ariaChecked === null || ariaChecked === 'false') && !el.closest('.line-through') &&
          (provider?.ignoreUncheckedToggles || []).some(selector => el.matches(selector)) &&
          !visible(el) && ![...(el.labels || [])].some(visible)) continue;
      const category = toggleCategory(el);
      if (!category) return false;
      if (category === 'necessary') continue;
      optional++;
      const checked = el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-checked') === 'true';
      if (el.tagName !== 'INPUT' && !['true', 'false'].includes(el.getAttribute('aria-checked'))) return false;
      if (!checked) continue;
      const labelVisible = [...(el.labels || [])].some(visible);
      if (!available(el) || (!visible(el) && !labelVisible)) return false;
      const tries = state.toggleTries.get(el) || 0;
      if (tries >= 2) return false;
      state.toggleTries.set(el, tries + 1);
      state.changes++;
      return click(el, state);
    }
    if (!optional || state.saved) return false;
    const save = findAction(container, provider, 'save');
    if (!save) return false;
    state.saved = true;
    if (click(save, state)) { report(state, `${provider?.id || 'generic'}:preferences`); return true; }
    return false;
  }
  function handle(container, provider) {
    const state = stateFor(container);
    if (Date.now() - state.lastAction < 600) { schedule(650); return false; }
    const reject = findAction(container, provider, 'reject');
    if (reject && state.rejectTries < 3) {
      state.rejectTries++;
      if (click(reject, state)) { report(state, `${provider?.id || 'generic'}:reject`); return true; }
    }
    if (preferenceAction(container, provider, state)) return true;
    const manage = findAction(container, provider, 'manage');
    if (manage && state.manageTries < 1 && !state.saved) { state.manageTries++; return click(manage, state); }
    return false;
  }
  function shadowOf(el) {
    if (el.shadowRoot) return el.shadowRoot;
    try { return chrome.dom?.openOrClosedShadowRoot(el) || null; } catch { return null; }
  }
  function observe(root) {
    if (roots.has(root)) return;
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) queueDiscovery(node);
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'disabled', 'aria-hidden', 'aria-disabled', 'aria-checked', 'aria-label', 'aria-labelledby', 'value', 'id', 'role', 'inert'] });
    roots.set(root, observer);
    queueDiscovery(root);
  }
  function queueDiscovery(node) {
    if (!enabled || discovery.length >= 500) return;
    discovery.push({ first: node.nodeType === 1 ? node : null, walker: document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT) });
    if (!discoveryTimer) discoveryTimer = setTimeout(discover, 30);
  }
  function discover() {
    discoveryTimer = null;
    if (!enabled) return;
    let budget = 750, found = false;
    while (discovery.length && budget-- > 0) {
      const job = discovery[0], el = job.first || job.walker.nextNode();
      job.first = null;
      if (!el) { discovery.shift(); continue; }
      const shadow = shadowOf(el);
      if (shadow && !roots.has(shadow)) { observe(shadow); found = true; }
    }
    if (discovery.length) discoveryTimer = setTimeout(discover, 30);
    if (found) schedule();
  }
  function sweep() {
    timer = null;
    if (!enabled || document.visibilityState === 'hidden') return;
    lastSweep = Date.now();
    visibilityCache = new WeakMap(); kindCache = new WeakMap(); contextCache = new WeakMap();
    for (const [container] of contexts) if (!container.isConnected || !visible(container.host || container)) contexts.delete(container);
    for (const [root, observer] of roots) {
      if (root !== document && !root.host.isConnected) { observer.disconnect(); roots.delete(root); continue; }
      for (const [container, provider] of collectContexts(root)) if (handle(container, provider)) return;
    }
  }
  function schedule(delay = 180) {
    if (!enabled || timer) return;
    timer = setTimeout(sweep, Math.max(delay, 250 - (Date.now() - lastSweep)));
  }
  function stop() {
    enabled = false;
    clearTimeout(timer); timer = null;
    clearInterval(poll); poll = null;
    clearTimeout(discoveryTimer); discoveryTimer = null;
    discovery = [];
    for (const observer of roots.values()) observer.disconnect();
    roots.clear(); contexts.clear();
  }
  async function refreshConfig() {
    const revision = ++configRevision;
    // No actions while settings are unresolved, including inside third-party frames.
    stop();
    try {
      const config = await chrome.runtime.sendMessage({ type: 'get-config' });
      if (revision !== configRevision || !config?.enabled) return;
      enabled = true;
      observe(document);
      schedule(0);
      nextDiscovery = Date.now() + 5000;
      poll = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        schedule();
        if (Date.now() >= nextDiscovery && !discovery.length) { nextDiscovery = Date.now() + 5000; queueDiscovery(document); }
      }, 1500);
    } catch { /* extension unavailable; leave the page alone */ }
  }
  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'config-changed') refreshConfig(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.enabled || changes.disabledSites)) refreshConfig();
  });
  document.addEventListener('visibilitychange', () => schedule(0));
  window.addEventListener('pageshow', () => { if (!enabled) refreshConfig(); else schedule(0); });
  window.addEventListener('pagehide', () => { configRevision++; stop(); });
  refreshConfig();
})();
