import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfigured } from "./db";
import { DomainError,requireActor } from "./http";
export async function protectPage(access:"session"|"calculator"|"admin"){
  if(!databaseConfigured())return <div className="missing-page"><h1>Backend belum dikonfigurasi</h1><p>Siapkan koneksi database dan konfigurasi aplikasi sesuai README proyek.</p></div>;
  try{const h=await headers();await requireActor(new Request(process.env.APP_BASE_URL!,{headers:new Headers(h)}),access);return null;}
  catch(error){
    if(error instanceof DomainError&&error.status===401)redirect("/login");
    if(error instanceof DomainError&&error.status===403&&access==="calculator")redirect("/app/access");
    return <div className="missing-page"><h1>Akses tidak tersedia</h1><p>{error instanceof DomainError?error.message:"Server belum dapat memuat akun."}</p><Link href="/login" className="button secondary">Kembali ke login</Link></div>;
  }
}
