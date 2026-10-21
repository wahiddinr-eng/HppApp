export type TransactionalEmailKind = "activation" | "password_reset" | "access_given";

const messages = {
  activation: {
    subject: "Aktifkan akun KulinerKit",
    preheader: "Satu langkah lagi untuk mulai memakai KulinerKit.",
    eyebrow: "SELAMAT DATANG",
    title: "Akun KulinerKit Anda siap diaktifkan",
    description: "Terima kasih sudah bergabung. Buat password untuk mengaktifkan akun dan mulai menjelajahi fitur bisnis kuliner yang tersedia untuk Anda.",
    button: "Aktifkan akun",
    note: "Tautan aktivasi berlaku 24 jam dan hanya dapat digunakan sekali.",
    security: "Jika Anda tidak merasa mendaftar atau membeli akses KulinerKit, abaikan email ini. Jangan bagikan tautan aktivasi kepada siapa pun.",
  },
  password_reset: {
    subject: "Atur ulang password KulinerKit",
    preheader: "Gunakan tautan aman untuk membuat password baru.",
    eyebrow: "KEAMANAN AKUN",
    title: "Atur ulang password Anda",
    description: "Kami menerima permintaan untuk mengatur ulang password akun KulinerKit Anda. Gunakan tombol di bawah untuk membuat password baru.",
    button: "Atur ulang password",
    note: "Tautan ini berlaku 60 menit dan hanya dapat digunakan sekali.",
    security: "Jika Anda tidak meminta pengaturan ulang password, abaikan email ini. Password lama Anda tidak berubah.",
  },
  access_given: {
    subject: "Akses KulinerKit Anda sudah aktif",
    preheader: "Akses baru Anda sudah siap digunakan.",
    eyebrow: "AKSES SIAP DIGUNAKAN",
    title: "Selamat, akses Anda sudah aktif",
    description: "Pembelian Anda telah diproses dan akses KulinerKit sudah ditambahkan ke akun Anda. Masuk untuk melihat fitur yang tersedia.",
    button: "Masuk ke KulinerKit",
    note: "Gunakan email dan password akun KulinerKit Anda untuk masuk.",
    security: "Jika Anda tidak mengenali pemberian akses ini, hubungi tim bantuan kami.",
  },
} as const;

function safeUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("EMAIL_INVALID_URL");
  }
  return url.href;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function buildTransactionalEmail(kind: TransactionalEmailKind, actionUrl: string, supportUrl: string) {
  const message = messages[kind];
  if (!message) throw new Error("EMAIL_INVALID_KIND");
  const action = safeUrl(actionUrl);
  const support = safeUrl(supportUrl);
  const actionHref = escapeHtml(action);
  const supportHref = escapeHtml(support);
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(message.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f8f5;color:#1c2c2b;font-family:Arial,Helvetica,sans-serif;">
  <span style="display:none!important;font-size:1px;line-height:1px;color:#f5f8f5;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(message.preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f8f5;">
    <tr><td align="center" style="padding:32px 16px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3ebe5;border-radius:16px;overflow:hidden;">
        <tr><td style="height:6px;background-color:#127960;font-size:1px;line-height:1px;">&nbsp;</td></tr>
        <tr><td style="padding:30px 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="42" height="42" align="center" valign="middle" style="width:42px;height:42px;border-radius:11px;background-color:#127960;color:#ffffff;font-size:23px;font-weight:700;">K</td>
            <td style="padding-left:12px;"><span style="display:block;color:#173b31;font-size:20px;line-height:24px;font-weight:700;letter-spacing:-0.5px;">KulinerKit</span><span style="display:block;color:#6e8277;font-size:11px;line-height:17px;">Teman usaha kuliner Anda</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 36px 0;">
          <span style="display:inline-block;padding:7px 11px;border-radius:20px;background-color:#e9f5ed;color:#127960;font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.2px;">${escapeHtml(message.eyebrow)}</span>
          <h1 style="margin:18px 0 12px;color:#1c2c2b;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.6px;">${escapeHtml(message.title)}</h1>
          <p style="margin:0;color:#53675e;font-size:15px;line-height:24px;">${escapeHtml(message.description)}</p>
        </td></tr>
        <tr><td style="padding:28px 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#127960" style="border-radius:10px;background-color:#127960;"><a href="${actionHref}" style="display:inline-block;padding:15px 23px;color:#ffffff;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">${escapeHtml(message.button)} &rarr;</a></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:25px 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f2f8f3;border:1px solid #dfebe1;border-radius:10px;"><tr><td style="padding:14px 17px;color:#36594a;font-size:13px;line-height:20px;">${escapeHtml(message.note)}</td></tr></table>
        </td></tr>
        <tr><td style="padding:25px 36px 0;">
          <p style="margin:0 0 6px;color:#718278;font-size:12px;line-height:18px;">Jika tombol tidak berfungsi, salin tautan ini ke browser:</p>
          <a href="${actionHref}" style="color:#127960;font-size:12px;line-height:19px;text-decoration:underline;word-break:break-all;">${actionHref}</a>
        </td></tr>
        <tr><td style="padding:30px 36px 34px;">
          <div style="border-top:1px solid #e9eee9;padding-top:21px;color:#718278;font-size:12px;line-height:19px;">${escapeHtml(message.security)}</div>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;"><tr><td align="center" style="padding:20px 12px 0;color:#89988e;font-size:11px;line-height:18px;">
        KulinerKit &middot; Toolkit untuk usaha kuliner<br>
        Butuh bantuan? <a href="${supportHref}" style="color:#127960;text-decoration:underline;">Hubungi tim bantuan</a>.<br>
        Email otomatis ini tidak perlu dibalas.
      </td></tr></table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    message.subject, "", message.description, "", `${message.button}: ${action}`, "",
    message.note, "", message.security, "", `Bantuan: ${support}`,
  ].join("\n");
  return { subject: message.subject, html, text };
}
