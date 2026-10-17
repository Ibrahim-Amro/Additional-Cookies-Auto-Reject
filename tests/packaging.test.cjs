const test = require("node:test");
const assert = require("node:assert/strict");
const { createZip, crc32 } = require("../scripts/package.cjs");

test("ZIP CRC-32 matches the standard reference vector", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test("ZIP entries retain bytes, UTF-8 filenames, and valid directory offsets", () => {
  const input = [
    { name: "manifest.json", data: Buffer.from('{"manifest_version":3}') },
    { name: "docs/caf\u00e9.txt", data: Buffer.from("\u00c9t\u00e9 \u2615") },
    { name: "empty.txt", data: Buffer.alloc(0) }
  ];
  const archive = createZip(input);
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50);
  assert.equal(archive.readUInt16LE(end + 10), input.length);
  const directoryStart = archive.readUInt32LE(end + 16);
  assert.equal(archive.readUInt32LE(end + 12), end - directoryStart);
  let centralOffset = directoryStart;
  for (const entry of input) {
    assert.equal(archive.readUInt32LE(centralOffset), 0x02014b50);
    const localOffset = archive.readUInt32LE(centralOffset + 42);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50);
    assert.equal(archive.readUInt16LE(localOffset + 6), 0x0800);
    assert.equal(archive.readUInt16LE(localOffset + 8), 0);
    const nameLength = archive.readUInt16LE(localOffset + 26);
    const filename = archive.subarray(localOffset + 30, localOffset + 30 + nameLength).toString("utf8");
    assert.equal(filename, entry.name);
    const size = archive.readUInt32LE(localOffset + 22);
    assert.equal(size, entry.data.length);
    const body = archive.subarray(localOffset + 30 + nameLength, localOffset + 30 + nameLength + size);
    assert.deepEqual(body, entry.data);
    assert.equal(archive.readUInt32LE(localOffset + 14), crc32(body));
    assert.equal(archive.readUInt32LE(centralOffset + 16), crc32(body));
    centralOffset += 46 + archive.readUInt16LE(centralOffset + 28);
  }
  assert.equal(centralOffset, end);
  assert.deepEqual(createZip(input), archive, "Archives are reproducible for the same input bytes");
});

test("ZIP writer rejects escaping paths and duplicate entries", () => {
  for (const name of ["../secret", "/absolute", "C:/file", "dir\\file", "a/../../b", "a//b", ".", ""]) {
    assert.throws(() => createZip([{ name, data: Buffer.alloc(0) }]), /safe relative paths/);
  }
  assert.throws(() => createZip([
    { name: "same.txt", data: Buffer.alloc(0) }, { name: "same.txt", data: Buffer.alloc(0) }
  ]), /Duplicate ZIP entry/);
});
