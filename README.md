# Auto Reject Cookies

A Manifest V3 extension for Chrome and compatible Chromium browsers that **tries to reject optional cookie consent** on your behalf. Version 2 expands provider detection, languages, preference workflows, frames, and shadow DOM while removing unsafe accept and cosmetic-hide fallbacks.

## How it works

1. Detect a visible consent manager using locally bundled provider rules.
2. Prefer an explicit **reject all / necessary only** action. Button order, generic “secondary” styling, close icons, and “OK” are never treated as rejection.
3. For custom banners, match exact refusal phrases in a qualified cookie/consent container. Phrases cover over 30 languages; this is a phrase dictionary, not a claim of complete coverage in each language.
4. When needed, open preferences, turn recognized optional categories off, then save only after the readable controls are off. Necessary controls remain unchanged. Unknown, contradictory, inverted, indeterminate, or radio-based controls prevent automatic saving.
5. Observe late banners, visibility/label changes, and page updates. Inspect open and closed shadow roots when the browser exposes them, and run independently inside eligible frames. Work is throttled, shadow discovery runs in chunks, and hidden tabs pause scanning.

Provider rules and the primary documentation behind them are listed in [docs/RESEARCH.md](docs/RESEARCH.md). A matching provider family does not guarantee every custom configuration works. All extension code and rules are bundled locally; there are no remote rule updates, external services, or runtime dependencies.

Version **2.1.0** expands the rules from 19 to **34 provider adapters**, including Sourcepoint, CookieScript, Termly, TrustArc, Cookie Information, Securiti, Axeptio TCF, Orejime, Drupal EU Cookie Compliance, Civic Cookie Control and several open-source libraries. It also recognizes accessible dialog names, associated control labels, Microsoft WCP-style alerts, and visible consent interfaces inside zero-size wrappers. [Expansion sources and validation](docs/EXPANDED-COVERAGE.md) explain the supported interfaces and limits; adapter counts are not website success-rate measurements.

## Install or upgrade

Requires **Chrome 119+** or a compatible Chromium browser. Firefox and Safari are not currently supported or tested.

1. Download this repository, or extract the generated extension ZIP into a permanent folder.
2. Open `chrome://extensions` (or your browser's extension management page).
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. To upgrade an existing unpacked installation, replace its files and click **Reload** on its extension card. Reload websites that were already open to start the new scripts.

No Node.js, build step, account, or server is needed to use the extension. ZIP files must be extracted before loading them.

## Controls and statistics

The popup has global and per-site switches. Changes apply to existing pages and their consent frames without a reload. A site exemption applies to the exact top-level hostname, including when the consent UI is hosted in a third-party frame; other subdomains keep their own setting.

The badge and popup count **rejection attempts**, not verified cookie removals or tracking prevention. Preference navigation and individual toggle changes are not counted; a rejection or save action counts once per recognized workflow. The engine may retry an unresponsive rejection control up to three times. Page counts reset on navigation and survive service-worker restarts. All-time counts stay on this device. Historical v1 counts are shown separately because that version sometimes counted hidden banners.

## Limits

No extension can reliably reject every banner on every website. Sites change their markup, require trusted user interactions, present ambiguous choices, or offer no free refusal option. This extension leaves unresolved banners available for you to handle; it does not hide them and claim they were rejected.

This extension **does not delete existing cookies or block network requests**. It preserves necessary/session cookies and consent-memory cookies. A site may ignore rejection, track before a banner appears, or use other tracking methods. Refusing consent cannot prove that tracking stopped. It does not bypass paywalls or consent walls. Restricted browser pages, extension stores, frames the browser forbids accessing, and unavailable shadow roots remain outside coverage.

## Privacy and permissions

- `storage`: settings, aggregate attempt counts, and temporary per-tab counts. Browser sync can sync the enabled setting and hostname exemptions.
- `tabs`: determine the top-level hostname for frame exemptions, show the current site, reset page counts, and distribute setting changes.
- HTTP(S) host access: inspect and operate consent controls on sites you visit, including eligible embedded frames.

No browsing history, page text, rejection method, or page URL is stored or sent to a server. Hostname exemptions are stored because you explicitly select them. The extension does not request cookie, request-interception, or remote-code permissions.

## Development and verification

Use Node.js 22 or newer:

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run package
```

On Linux CI, install the browser dependencies with `npx playwright install --with-deps chromium`. `npm run test:unit` runs the non-browser tests. Browser tests load the real unpacked extension in an isolated Chromium profile and use local fixtures, including third-party frames and closed shadow roots. They do not establish a measured success rate across the live web.

The ZIP is written to `dist/auto-reject-cookies-2.1.0.zip`. Packaging uses an explicit allowlist, so tests, development dependencies, and local files are excluded. GitHub Actions runs validation, tests, and packaging and makes the ZIP available as a workflow artifact.

To contribute a missed banner, include the public URL, browser version, consent language, and which controls are offered. Redact personal information. Add a regression fixture with any new rule, verify its actual reject semantics against provider documentation or source, and retain the guards against accidental acceptance.
