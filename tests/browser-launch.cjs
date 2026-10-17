"use strict";

const { chromium } = require("playwright");

async function launchExtensionContext(extensionPath) {
  try {
    // CI uses Playwright's bundled Chromium, including its extension launch flags.
    return await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });
  } catch (error) {
    // Some Windows test images cannot activate the downloaded Chromium assembly.
    // Keep manifest or extension errors visible; only fall back for a failed spawn.
    if (process.platform !== "win32" || !/spawn UNKNOWN|side.by.side|executable doesn.t exist/i.test(error.message)) throw error;
    let context;
    try {
      // A blank profile path creates a disposable Playwright profile. This never
      // opens or changes the user's Chrome profile or installed extensions.
      context = await chromium.launchPersistentContext("", {
        channel: "chrome",
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        args: ["--enable-unsafe-extension-debugging"]
      });
      // Branded Chrome no longer accepts --load-extension. Its debugging API
      // supports unpacked extensions in this isolated browser instead.
      const session = await context.browser().newBrowserCDPSession();
      await session.send("Extensions.loadUnpacked", { path: extensionPath });
      await session.detach();
      console.log(`Using isolated system Chrome ${context.browser().version()} after bundled Chromium failed to start.`);
      return context;
    } catch (fallbackError) {
      await context?.close();
      throw new AggregateError([error, fallbackError], "Neither bundled Chromium nor isolated system Chrome could run the extension tests");
    }
  }
}

module.exports = { launchExtensionContext };
