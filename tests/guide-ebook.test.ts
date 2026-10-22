import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

test("ebook PDF tersedia dan memuat seluruh bab panduan pelanggan", () => {
  const source = readFileSync("docs/PANDUAN-PENGGUNA-KULINERKIT.md", "utf8");
  const pdf = readFileSync("public/panduan-kulinerkit.pdf");
  const chapters = [...source.matchAll(/^## \d{2} — /gm)];

  assert.equal(chapters.length, 10);
  for (const topic of ["Apa itu HPP kuliner?", "Aktivasi dan masuk", "Bahan dan riwayat harga", "Harga per kanal", "Target untung", "Galeri Prompt", "Penjualan Harian", "Analisis Penjualan"]) {
    assert.match(source, new RegExp(topic, "i"));
  }
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 20_000, "PDF tidak boleh berupa file kosong atau placeholder");
  const objects = new Map([...pdf.toString("latin1").matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)]
    .map(match => [Number(match[1]), match[2]]));
  const pages = [...objects.values()].filter(body => /\/Type \/Page\b/.test(body));
  const pageCount = pages.length;
  assert.ok(pageCount >= chapters.length + 2);
  assert.ok(pageCount <= chapters.length + 8, `PDF memiliki ${pageCount} halaman; periksa halaman kosong dari footer`);
  for (const [index, page] of pages.entries()) {
    const contentId = Number(page.match(/\/Contents (\d+) 0 R/)?.[1]);
    const compressed = objects.get(contentId)?.match(/stream\r?\n([\s\S]*?)\r?\nendstream/)?.[1];
    assert.ok(compressed, `Halaman ${index + 1} tidak memiliki isi`);
    const decoded = inflateSync(Buffer.from(compressed, "latin1")).toString("latin1");
    assert.ok((decoded.match(/\bBT\b/g) ?? []).length >= 5, `Halaman ${index + 1} tampak kosong`);
  }
});
