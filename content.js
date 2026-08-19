/**
 * Auto Reject Cookies - content script
 * Runs in every frame of every page. Tries, in order:
 *   1) Known selectors for the most common consent-management platforms (CMPs)
 *   2) Generic text-based matching ("Reject all", "Decline", "Necessary only", etc.)
 *   3) If a banner is clearly present but no reject option can be found,
 *      hide the banner/overlay so it stops blocking the page.
 *
 * It watches the DOM continuously (MutationObserver) because many banners
 * are injected after a delay, after other scripts load, or live inside iframes.
 */

(function () {
  "use strict";

  const STATE = {
    enabled: true,
    handledNodes: new WeakSet(),
    attempts: 0,
    maxAttempts: 40, // ~ keeps trying for the first ~20s after load, then relies on MutationObserver
  };

  // -----------------------------
  // 1. Known CMP "reject all" selectors
  // -----------------------------
  const KNOWN_REJECT_SELECTORS = [
    // OneTrust
    "#onetrust-reject-all-handler",
    ".ot-pc-refuse-all-handler",
    "button.ot-pc-refuse-all-handler",
    // Cookiebot
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
    "#CybotCookiebotDialogBodyButtonDecline",
    "button#CybotCookiebotDialogBodyLevelButtonAccept, button#CybotCookiebotDialogBodyLevelButtonDecline",
    // Quantcast Choice / TCF
    ".qc-cmp2-summary-buttons button[mode='secondary']",
    // Didomi
    "#didomi-notice-disagree-button",
    ".didomi-continue-without-agreeing",
    "button.didomi-components-button.didomi-button-highlight-secondary",
    // TrustArc
    "#truste-consent-required",
    ".trustarc-agree-btn-decline",
    // Cookie-Script.com
    "#cookiescript_reject",
    // Osano
    ".osano-cm-denyAll",
    ".osano-cm-button--type_denyAll",
    // Termly
    ".t-declineAllButton",
    // Complianz (WordPress)
    ".cmplz-btn.cmplz-deny",
    ".cmplz-deny",
    // Iubenda
    ".iubenda-cs-reject-btn",
    // Borlabs Cookie
    "._brlbs-btn-refuse-all",
    ".brlbs-btn-refuse",
    // Klaro
    ".cm-btn-decline",
    // Usercentrics
    "button[data-testid='uc-deny-all-button']",
    "#uc-btn-deny-banner",
    // Sourcepoint (generic pattern used across many sites)
    "button[title='Reject All']",
    "button[title='Reject all']",
    // Google's own consent dialog (used on google.com, youtube.com)
    "form[action*='consent'] button:nth-of-type(1)",
  ];

  // -----------------------------
  // 2. Generic text matching (fallback for custom / homegrown banners)
  // -----------------------------
  const REJECT_TEXT_RE =
    /^(reject all|reject cookies|reject|decline all|decline|refuse all|refuse|disagree|deny|deny all|only necessary|necessary only|necessary cookies only|essential only|essential cookies only|do not accept|no,? thanks|continue without accepting|use necessary cookies only)$/i;

  const ACCEPT_TEXT_RE = /^(accept|agree|allow|ok|got it|enable)/i;

  // Words used to identify a container as a cookie/consent banner
  const BANNER_HINT_RE = /(cookie|consent|gdpr|privacy[-_ ]?(choice|preference)|ccpa)/i;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function clickElement(el) {
    try {
      el.click();
      return true;
    } catch (e) {
      try {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function reportHandled(method) {
    try {
      chrome.runtime.sendMessage({ type: "banner-handled", method });
    } catch (e) {
      /* extension context may be gone on navigation; ignore */
    }
  }

  // Try each known selector across the whole document
  function tryKnownSelectors() {
    for (const sel of KNOWN_REJECT_SELECTORS) {
      let el;
      try {
        el = document.querySelector(sel);
      } catch (e) {
        continue;
      }
      if (el && isVisible(el) && !STATE.handledNodes.has(el)) {
        STATE.handledNodes.add(el);
        if (clickElement(el)) {
          reportHandled("known-selector: " + sel);
          return true;
        }
      }
    }
    return false;
  }

  // Look at all clickable elements, find ones whose visible text matches a "reject" phrase
  function tryTextMatch() {
    const clickable = document.querySelectorAll(
      "button, a[role='button'], [role='button'], input[type='button'], input[type='submit']"
    );
    for (const el of clickable) {
      if (STATE.handledNodes.has(el)) continue;
      if (!isVisible(el)) continue;
      const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
      if (!text || text.length > 40) continue; // avoid matching long paragraphs
      if (REJECT_TEXT_RE.test(text)) {
        STATE.handledNodes.add(el);
        if (clickElement(el)) {
          reportHandled("text-match: " + text);
          return true;
        }
      }
    }
    return false;
  }

  // Find likely banner containers (fixed/sticky positioned, cookie-related id/class, contains an accept button)
  function findBannerContainers() {
    const candidates = new Set();
    const all = document.querySelectorAll("div, section, aside, dialog, [role='dialog'], [role='alertdialog']");
    for (const el of all) {
      if (!isVisible(el)) continue;
      const idClass = (el.id || "") + " " + (el.className && el.className.toString ? el.className.toString() : "");
      if (!BANNER_HINT_RE.test(idClass)) continue;

      const style = window.getComputedStyle(el);
      const looksLikeOverlay =
        style.position === "fixed" || style.position === "sticky" || style.zIndex && parseInt(style.zIndex, 10) > 100;

      // has some button inside that looks like accept/reject -> strong signal it's a consent banner
      const hasConsentButtons = Array.from(el.querySelectorAll("button, a, [role='button']")).some((btn) => {
        const t = (btn.innerText || "").trim();
        return REJECT_TEXT_RE.test(t) || ACCEPT_TEXT_RE.test(t);
      });

      if (looksLikeOverlay || hasConsentButtons) {
        candidates.add(el);
      }
    }
    return Array.from(candidates);
  }

  // Last resort: if a banner exists but no reject control could be found/clicked,
  // hide it and remove any scroll-lock so it stops obstructing the page.
  function hideResidualBanners() {
    const containers = findBannerContainers();
    let hidAny = false;
    for (const el of containers) {
      if (STATE.handledNodes.has(el)) continue;
      // Only hide it if it still contains a live accept/reject control (i.e. wasn't already handled)
      const stillHasButton = el.querySelector("button, a[role='button'], [role='button']");
      if (!stillHasButton) continue;

      STATE.handledNodes.add(el);
      el.style.setProperty("display", "none", "important");
      hidAny = true;
    }

    if (hidAny) {
      // Common "no-scroll" locks added by CMPs
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      document.documentElement.classList.remove("no-scroll", "overflow-hidden", "modal-open");
      document.body.classList.remove("no-scroll", "overflow-hidden", "modal-open");
      reportHandled("hidden-residual-banner");
    }
    return hidAny;
  }

  function sweep() {
    if (!STATE.enabled) return;
    if (tryKnownSelectors()) return;
    if (tryTextMatch()) return;
    hideResidualBanners();
  }

  function init() {
    chrome.storage.sync.get({ enabled: true, disabledSites: [] }, (cfg) => {
      const host = location.hostname;
      STATE.enabled = cfg.enabled && !cfg.disabledSites.includes(host);
      if (!STATE.enabled) return;

      sweep();

      // Keep sweeping for a while since many banners load asynchronously after
      // analytics/ad scripts or A/B test tools initialize.
      const interval = setInterval(() => {
        STATE.attempts++;
        sweep();
        if (STATE.attempts >= STATE.maxAttempts) clearInterval(interval);
      }, 500);

      // Also react instantly whenever the DOM changes (covers late-injected banners
      // without waiting for the next interval tick).
      const observer = new MutationObserver(() => sweep());
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
