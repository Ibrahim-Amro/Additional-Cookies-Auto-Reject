"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RUNTIME_FILES = Object.freeze([
  "manifest.json", "background.js", "consent-rules.js", "content.js", "popup.html", "popup.js"
]);

function readLocalFile(root, filename) {
  assert.ok(RUNTIME_FILES.includes(filename), `Unexpected runtime path: ${filename}`);
  const absolutePath = path.resolve(root, filename);
  const relative = path.relative(path.resolve(root), absolutePath);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `Path escapes the repository: ${filename}`);
  assert.ok(fs.lstatSync(absolutePath).isFile(), `Runtime file must be a regular file: ${filename}`);
  return fs.readFileSync(absolutePath, "utf8");
}

function checkRepository(root = path.resolve(__dirname, "..")) {
  const source = new Map(RUNTIME_FILES.map((filename) => [filename, readLocalFile(root, filename)]));
  const manifest = JSON.parse(source.get("manifest.json"));
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3, "Use Manifest V3");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "Use a numeric three-part extension version");
  assert.equal(packageMetadata.version, manifest.version, "Package and extension versions must agree");
  assert.deepEqual(manifest.permissions, ["storage", "tabs"], "Unexpected extension permissions");
  assert.deepEqual(manifest.host_permissions, ["http://*/*", "https://*/*"], "Keep host access scoped to HTTP(S)");
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.equal(manifest.action?.default_popup, "popup.html");
  assert.equal(manifest.content_scripts?.length, 1);
  const contentScript = manifest.content_scripts[0];
  assert.deepEqual(contentScript.matches, ["http://*/*", "https://*/*"], "Keep content scripts scoped to HTTP(S)");
  assert.deepEqual(contentScript.js, ["consent-rules.js", "content.js"], "Load rules before the consent engine");
  assert.equal(contentScript.run_at, "document_start");
  assert.equal(contentScript.all_frames, true);
  assert.equal(contentScript.match_about_blank, true);
  assert.equal(contentScript.match_origin_as_fallback, true);
  assert.ok(!contentScript.world || contentScript.world === "ISOLATED", "Keep content scripts isolated from page JavaScript");
  assert.equal(Object.keys(packageMetadata.dependencies || {}).length, 0, "Runtime dependencies are not bundled");
  assert.equal(Object.keys(packageMetadata.optionalDependencies || {}).length, 0, "Optional runtime dependencies are not bundled");

  for (const filename of RUNTIME_FILES.filter((file) => file.endsWith(".js"))) {
    new vm.Script(source.get(filename), { filename });
  }
  const popup = source.get("popup.html");
  const scriptTags = Array.from(popup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi));
  assert.equal(scriptTags.length, 1, "The popup should load one local script");
  for (const [, attributes, inlineCode] of scriptTags) {
    const scriptSource = attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    assert.equal(scriptSource?.[2], "popup.js", "Popup scripts must use the bundled popup.js");
    assert.equal(inlineCode.trim(), "", "Avoid inline popup JavaScript");
  }
  assert.ok(!/\son[a-z]+\s*=/i.test(popup), "Avoid inline popup event handlers");

  const context = vm.createContext({});
  new vm.Script(source.get("consent-rules.js"), { filename: "consent-rules.js" }).runInContext(context, { timeout: 1000 });
  const rules = context.CookieConsentRules;
  assert.ok(rules && Array.isArray(rules.providers) && rules.providers.length > 0, "Rules must expose consent providers");
  assert.equal(typeof rules.normalizeLabel, "function");
  assert.equal(typeof rules.classifyLabel, "function");
  const ids = new Set();
  for (const provider of rules.providers) {
    assert.ok(typeof provider.id === "string" && provider.id.length > 0, "Providers need IDs");
    assert.ok(!ids.has(provider.id), `Duplicate provider ID: ${provider.id}`);
    ids.add(provider.id);
    if (provider.strictActions !== undefined) assert.equal(typeof provider.strictActions, 'boolean', `${provider.id}: invalid strictActions flag`);
    for (const field of ["roots", "reject", "accept", "manage", "save", "ignoreUncheckedToggles"]) {
      if (provider[field] === undefined && !["roots", "reject"].includes(field)) continue;
      assert.ok(Array.isArray(provider[field]) && provider[field].length > 0, `${provider.id}: missing ${field} selectors`);
      assert.ok(provider[field].every((selector) => typeof selector === "string" && selector.trim()), `${provider.id}: invalid ${field} selector`);
    }
  }
  for (const category of ["reject", "manage", "save", "accept", "necessary", "consent", "cookieContext", "optional"]) {
    assert.ok(Array.isArray(rules.labels?.[category]) && rules.labels[category].length > 0, `Missing ${category} labels`);
    assert.ok(rules.labels[category].every((label) => typeof label === "string" && label.trim()), `Invalid ${category} label`);
  }
  return { manifest, runtimeFiles: RUNTIME_FILES, providerCount: ids.size };
}

if (require.main === module) {
  try {
    const result = checkRepository();
    console.log(`Checked ${result.runtimeFiles.length} runtime files, Manifest V3, and ${result.providerCount} provider rules.`);
  } catch (error) {
    console.error(`Check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { checkRepository, RUNTIME_FILES };
