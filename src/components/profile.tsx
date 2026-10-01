"use client";
import {useEffect,useState} from "react";
import {Building2,Save,ShieldCheck} from "lucide-react";
import {api} from "@/lib/api";
import {PageTop,Shell} from "./shell";
export function Profile(){
  const [business,setBusiness]=useState("");const [name,setName]=useState("");const [email,setEmail]=useState("");
  const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
  const [currentPassword,setCurrentPassword]=useState("");const [newPassword,setNewPassword]=useState("");
  useEffect(()=>{void api<{user:{businessName:string;name:string;email:string}}>("/api/profile").then(({user})=>{setBusiness(user.businessName||"");setName(user.name);setEmail(user.email);}).catch(error=>setNotice(error.message));},[]);
  const save=async()=>{
    setBusy(true);try{const result=await api<{message:string}>("/api/profile",{method:"PATCH",body:JSON.stringify({businessName:business,displayName:name})});setNotice(result.message);}
    catch(error){setNotice(error instanceof Error?error.message:"Gagal menyimpan.");}finally{setBusy(false);}
  };
  const logout=async()=>{try{await api("/api/auth/sign-out",{method:"POST",body:"{}"});window.location.assign("/login");}catch(error){setNotice(error instanceof Error?error.message:"Gagal keluar.");}};
  const changePassword=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);
    try{await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword,revokeOtherSessions:true})});setCurrentPassword("");setNewPassword("");setNotice("Password diubah. Sesi pada perangkat lain diakhiri.");}
    catch(error){setNotice(error instanceof Error?error.message:"Gagal mengubah password.");}finally{setBusy(false);}
  };
  return <Shell><PageTop eyebrow="PENGATURAN / PROFIL" title="Profil usaha" description="Nama usaha default akan terisi otomatis saat membuat perhitungan baru."/>
    {notice&&<div className="form-message" role="status">{notice}</div>}
    <div className="profile-layout"><section className="panel profile-panel"><div className="section-heading"><div className="section-icon"><Building2 size={20}/></div><div><h2>Identitas usaha</h2><p>{email}</p></div></div><div className="section-body">
      <label className="field"><span className="field-label">Nama tampilan</span><span className="input-wrap"><input value={name} onChange={event=>setName(event.target.value)} maxLength={120}/></span></label>
      <label className="field"><span className="field-label">Nama usaha atau UMKM</span><span className="input-wrap"><input value={business} onChange={event=>setBusiness(event.target.value)} placeholder="Contoh: Dapur Rasa" maxLength={120}/></span></label>
      <button disabled={busy} className="button primary" onClick={save}><Save size={17}/> Simpan profil</button> <button className="button secondary" onClick={()=>void logout()}>Keluar akun</button>
      <form onSubmit={changePassword} className="password-form"><h3>Ubah password</h3><label className="field"><span>Password saat ini</span><span className="input-wrap"><input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required maxLength={128}/></span></label><label className="field"><span>Password baru (12–128 karakter)</span><span className="input-wrap"><input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} required minLength={12} maxLength={128}/></span></label><button disabled={busy} className="button secondary" type="submit">Ubah password</button></form>
    </div></section><aside className="profile-aside"><ShieldCheck size={25}/><h3>Data tersimpan di akun Anda</h3><p>Perhitungan disimpan di server dan hanya dapat dibuka oleh pemiliknya saat akses aktif. Mengubah profil tidak mengubah laporan yang sudah difinalkan.</p><p>Email akun mengikuti transaksi pembelian dan tidak dapat diubah di sini.</p></aside></div></Shell>;
}
