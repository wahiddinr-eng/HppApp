import {createSmtpTransport} from "../src/server/smtp";
if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASSWORD)throw new Error("Konfigurasi SMTP belum lengkap.");
const transport=createSmtpTransport();
try{
  await transport.verify();
  console.log("Koneksi TLS dan autentikasi SMTP berhasil. Tidak ada email dikirim.");
  if(!process.env.EMAIL_FROM)console.log("EMAIL_FROM belum diisi. Alamat pengirim terverifikasi masih diperlukan.");
}catch(error){
  const failure=error as {code?:string;responseCode?:number};
  const code=/^[A-Z0-9_]{1,40}$/.test(failure.code||"")?failure.code:"SMTP_VERIFY_FAILED";
  console.error("Verifikasi SMTP gagal: "+code+(failure.responseCode?" (SMTP "+Number(failure.responseCode)+")":"")+".");
  process.exitCode=1;
}finally{transport.close();}
