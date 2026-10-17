"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { checkRepository } = require("./check.cjs");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A small, deterministic ZIP writer for this extension's local file allowlist.
// Uses standard STORE entries (no compression), UTF-8 names, and no ZIP64 features.
function createZip(entries) {
  if (entries.length > 0xffff) throw new Error("Too many files for a standard ZIP");
  const localParts = [];
  const centralParts = [];
  const names = new Set();
  let offset = 0;
  for (const entry of entries) {
    if (typeof entry.name !== "string" || !entry.name || entry.name.startsWith("/") ||
        /[\\:\u0000]/.test(entry.name) || entry.name.split("/").some((part) => !part || part === ".." || part === ".")) {
      throw new Error("ZIP entry names must be safe relative paths");
    }
    if (names.has(entry.name)) throw new Error(`Duplicate ZIP entry: ${entry.name}`);
    names.add(entry.name);
    const name = Buffer.from(entry.name, "utf8");
    const bytes = Buffer.from(entry.data);
    if (name.length > 0xffff || bytes.length > 0xffffffff) throw new Error("ZIP entry is too large");
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename.
    local.writeUInt16LE(0x0021, 12); // Fixed 1980-01-01 DOS date makes builds reproducible.
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + bytes.length;
    if (offset > 0xffffffff) throw new Error("ZIP archive is too large");
  }
  const directory = Buffer.concat(centralParts);
  if (directory.length > 0xffffffff || offset + directory.length > 0xffffffff) throw new Error("ZIP archive is too large");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

function buildPackage(root = path.resolve(__dirname, "..")) {
  const { manifest, runtimeFiles } = checkRepository(root);
  const filenames = [...runtimeFiles];
  for (const filename of ["README.md", "docs/RESEARCH.md"]) {
    const absolutePath = path.join(root, filename);
    if (fs.existsSync(absolutePath) && fs.lstatSync(absolutePath).isFile()) filenames.push(filename);
  }
  const zip = createZip(filenames.map((name) => ({ name, data: fs.readFileSync(path.join(root, name)) })));
  const outputDirectory = path.join(root, "dist");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `auto-reject-cookies-${manifest.version}.zip`);
  fs.writeFileSync(outputPath, zip);
  return { outputPath, fileCount: filenames.length, bytes: zip.length };
}

if (require.main === module) {
  try {
    const result = buildPackage();
    console.log(`Packaged ${result.fileCount} files (${result.bytes} bytes): ${result.outputPath}`);
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createZip, crc32, buildPackage };
