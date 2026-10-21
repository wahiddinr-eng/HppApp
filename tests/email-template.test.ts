import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { buildTransactionalEmail } from "../src/server/email-template";

const action = "https://hpp.lrmobileid.com/activate?token=abc123&source=checkout";
const support = "https://lrmobileid.com/bantuan";

test("email aktivasi memiliki CTA, batas waktu, tautan cadangan, dan teks biasa", () => {
  const message = buildTransactionalEmail("activation", action, support);
  assert.equal(message.subject, "Aktifkan akun KulinerKit");
  assert.match(message.html, /<html lang="id">/);
  assert.match(message.html, /KulinerKit/);
  assert.match(message.html, /Aktifkan akun/);
  assert.match(message.html, /berlaku 24 jam/);
  assert.match(message.html, /token=abc123&amp;source=checkout/);
  assert.doesNotMatch(message.html, /token=abc123&source=checkout/);
  assert.match(message.text, /token=abc123&source=checkout/);
  assert.match(message.text, /Bantuan: https:\/\/lrmobileid\.com\/bantuan/);
  assert.doesNotMatch(message.html, /<img\b/i);
});

test("email reset password dan pemberian akses memakai pesan yang tepat", () => {
  const reset = buildTransactionalEmail("password_reset", "https://hpp.lrmobileid.com/reset-password?token=reset", support);
  const granted = buildTransactionalEmail("access_given", "https://hpp.lrmobileid.com/login", support);
  assert.match(reset.html, /Atur ulang password Anda/);
  assert.match(reset.text, /berlaku 60 menit/);
  assert.match(granted.html, /akses Anda sudah aktif/);
  assert.match(granted.text, /Masuk ke KulinerKit: https:\/\/hpp\.lrmobileid\.com\/login/);
  assert.doesNotMatch(granted.text, /24 jam|60 menit/);
});

test("tautan email hanya menerima URL HTTP(S) tanpa kredensial", () => {
  assert.throws(() => buildTransactionalEmail("activation", "javascript:alert(1)", support), /EMAIL_INVALID_URL/);
  assert.throws(() => buildTransactionalEmail("activation", "https://user:pass@example.com", support), /EMAIL_INVALID_URL/);
  assert.throws(() => buildTransactionalEmail("activation", action, "data:text/html,hi"), /EMAIL_INVALID_URL/);
});

test("MIME email berisi HTML dan alternatif teks tanpa menghubungi SMTP", async () => {
  const message = buildTransactionalEmail("activation", action, support);
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: "HppApp <akses@mailer.lrmobileid.com>", to: "test@example.invalid", ...message,
  });
  const mime = result.message.toString();
  assert.match(mime, /multipart\/alternative/);
  assert.match(mime, /text\/plain/);
  assert.match(mime, /text\/html/);
});
