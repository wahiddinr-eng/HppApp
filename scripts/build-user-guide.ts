import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";
import PDFDocument from "pdfkit";

const source = resolve("docs/PANDUAN-PENGGUNA-KULINERKIT.md");
const output = resolve("public/panduan-kulinerkit.pdf");
const markdown = readFileSync(source, "utf8");
const chapterTitles = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
const title = markdown.match(/^# (.+)$/m)?.[1] ?? "Panduan KulinerKit";
const green = "#116a54";
const dark = "#18332b";
const muted = "#61766b";
const line = "#dce8df";
const paper = "#fbfcf9";
const left = 55;
const right = 55;
const pageBottom = 755;

mkdirSync(dirname(output), { recursive: true });
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 84, right, bottom: 75, left },
  bufferPages: true,
  info: {
    Title: "KulinerKit — Panduan Penggunaan Lengkap",
    Author: "KulinerKit",
    Subject: "Edukasi HPP kuliner dan panduan fitur pelanggan KulinerKit",
    Keywords: "KulinerKit, HPP kuliner, panduan penggunaan, UMKM",
  },
});
const file = createWriteStream(output);
doc.pipe(file);
const width = doc.page.width - left - right;

function safe(value: string) {
  return value.replaceAll("→", "ke").replaceAll("÷", "/").replaceAll("**", "");
}

function newContentPage() {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(paper);
  doc.fillColor(green).font("Helvetica-Bold").fontSize(9)
    .text("KULINERKIT / PANDUAN PENGGUNA", left, 37, { characterSpacing: 1.1 });
  doc.moveTo(left, 59).lineTo(doc.page.width - right, 59).lineWidth(1).strokeColor(line).stroke();
  doc.y = 86;
}

function room(height: number) {
  if (doc.y + height > pageBottom) newContentPage();
}

function block(text: string, options: { size?: number; indent?: number; color?: string; font?: string; gap?: number; prefix?: string } = {}) {
  const size = options.size ?? 10.5;
  const indent = options.indent ?? 0;
  const content = safe(text);
  const textWidth = width - indent;
  doc.font(options.font ?? "Helvetica").fontSize(size);
  const height = doc.heightOfString(content, { width: textWidth, lineGap: 3 });
  room(height + (options.gap ?? 8) + 3);
  const y = doc.y;
  if (options.prefix) {
    doc.fillColor(green).font("Helvetica-Bold").fontSize(size).text(options.prefix, left, y, { width: indent - 7 });
  }
  doc.fillColor(options.color ?? dark).font(options.font ?? "Helvetica").fontSize(size)
    .text(content, left + indent, y, { width: textWidth, lineGap: 3 });
  doc.y += options.gap ?? 8;
}

// Cover. Vector-only artwork keeps the PDF crisp at any zoom level.
doc.rect(0, 0, doc.page.width, doc.page.height).fill("#0d4f42");
doc.save().opacity(0.12).circle(494, 145, 192).fill("#d7f0c4").restore();
doc.save().opacity(0.12).circle(38, 715, 164).fill("#d7f0c4").restore();
doc.roundedRect(55, 75, 143, 29, 14).fill("#e2f4c6");
doc.fillColor("#0d4f42").font("Helvetica-Bold").fontSize(10).text("PANDUAN LENGKAP", 68, 84);
doc.fillColor("#cbeacf").font("Helvetica-Bold").fontSize(15).text("KulinerKit", 55, 143);
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(37).text("Dari biaya resep\nke keputusan usaha.", 55, 197, { width: 475, lineGap: 8 });
doc.fillColor("#d9efe1").font("Helvetica").fontSize(15)
  .text("Belajar HPP kuliner, menata harga, menyiapkan promosi, dan membaca hasil jualan.", 55, 344, { width: 400, lineGap: 5 });
doc.moveTo(55, 617).lineTo(540, 617).lineWidth(1).strokeColor("#75ad94").stroke();
doc.fillColor("#d9efe1").font("Helvetica").fontSize(11)
  .text("Untuk pemilik usaha kuliner pemula dan yang sedang bertumbuh", 55, 638, { width: 450 });
doc.fillColor("#bad9c6").fontSize(9).text("EDISI OKTOBER 2026  •  KULINERKIT", 55, 744);

newContentPage();
doc.fillColor(green).font("Helvetica-Bold").fontSize(10).text("SEBELUM MEMULAI", left, doc.y, { characterSpacing: 1.2 });
doc.y += 14;
doc.fillColor(dark).font("Helvetica-Bold").fontSize(27).text("Cara memakai buku ini", left, doc.y, { width });
doc.y += 14;
block("Mulai dari dasar HPP, praktikkan satu produk, lalu lanjutkan ke harga kanal, target usaha, promosi, dan catatan penjualan. Setiap bab dapat dibaca terpisah saat Anda membutuhkannya.", { size: 11 });
block("Contoh angka adalah ilustrasi. Tarif platform, kewajiban pajak, dan harga yang cocok untuk usaha Anda perlu diverifikasi dari sumber yang berlaku.", { size: 10, color: muted });
doc.y += 15;
doc.fillColor(green).font("Helvetica-Bold").fontSize(10).text("DAFTAR ISI", left, doc.y, { characterSpacing: 1.2 });
doc.y += 22;
for (const chapter of chapterTitles) {
  room(42);
  const number = chapter.match(/^\d+/)?.[0] ?? "";
  const label = chapter.replace(/^\d+\s*[—-]\s*/, "");
  const y = doc.y;
  doc.roundedRect(left, y - 2, 34, 27, 6).fill("#e7f3e9");
  doc.fillColor(green).font("Helvetica-Bold").fontSize(10).text(number, left + 7, y + 6);
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11).text(label, left + 49, y + 5, { width: width - 55 });
  doc.y = y + 42;
}

const lines = markdown.split(/\r?\n/);
let started = false;
for (let index = 0; index < lines.length; index++) {
  const raw = lines[index].trim();
  if (!raw) continue;
  if (raw.startsWith("# ")) continue;
  if (!started) {
    if (!raw.startsWith("## ")) continue;
    started = true;
  }
  if (raw.startsWith("## ")) {
    newContentPage();
    const chapter = raw.slice(3);
    const number = chapter.match(/^\d+/)?.[0] ?? "";
    const heading = chapter.replace(/^\d+\s*[—-]\s*/, "");
    doc.fillColor(green).font("Helvetica-Bold").fontSize(11).text(`BAB ${number}`, left, doc.y, { characterSpacing: 1.3 });
    doc.y += 9;
    doc.fillColor(dark).font("Helvetica-Bold").fontSize(25).text(safe(heading), left, doc.y, { width, lineGap: 3 });
    doc.y += 18;
    continue;
  }
  if (raw.startsWith("### ")) {
    const heading = safe(raw.slice(4));
    doc.font("Helvetica-Bold").fontSize(13);
    room(doc.heightOfString(heading, { width }) + 26);
    doc.y += 7;
    doc.fillColor(green).text(heading, left, doc.y, { width });
    doc.y += 12;
    continue;
  }
  if (raw.startsWith("> ")) {
    const text = safe(raw.slice(2));
    doc.font("Helvetica").fontSize(10);
    const height = doc.heightOfString(text, { width: width - 35, lineGap: 3 }) + 22;
    room(height + 12);
    const y = doc.y;
    doc.roundedRect(left, y, width, height, 7).fill("#e7f3e9");
    doc.fillColor(dark).font("Helvetica").fontSize(10).text(text, left + 17, y + 11, { width: width - 34, lineGap: 3 });
    doc.y = y + height + 13;
    continue;
  }
  const ordered = raw.match(/^(\d+)\. (.+)$/);
  if (ordered) {
    block(ordered[2], { indent: 30, prefix: `${ordered[1]}.`, gap: 5 });
    continue;
  }
  if (raw.startsWith("- ")) {
    block(raw.slice(2), { indent: 23, prefix: "•", gap: 5 });
    continue;
  }
  block(raw, { gap: 11 });
}

const totalPages = doc.bufferedPageRange().count;
for (let page = 1; page < totalPages; page++) {
  doc.switchToPage(page);
  doc.moveTo(left, 778).lineTo(doc.page.width - right, 778).lineWidth(1).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(8)
    .text("KulinerKit  •  Panduan Penggunaan Lengkap", left, 790, { width: 360, height: 12 });
  doc.text(String(page).padStart(2, "0"), doc.page.width - right - 32, 790, { width: 32, height: 12, align: "right" });
}

if (doc.bufferedPageRange().count !== totalPages) {
  throw new Error("Footer menambah halaman PDF; periksa posisi dan tinggi teks footer.");
}
doc.end();
await finished(file);
process.stdout.write(`Ebook siap: ${output} (${totalPages} halaman)\n`);
