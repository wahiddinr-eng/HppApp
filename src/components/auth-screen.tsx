"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight,Eye,EyeOff,LockKeyhole,Mail} from "lucide-react";
import {api} from "@/lib/api";
type Mode="login"|"activate"|"forgot"|"reset";
const copy={
  login:{eyebrow:"SELAMAT DATANG KEMBALI",title:"Masuk ke ruang kerja Anda",description:"Buka kalkulator HPP atau Galeri Prompt sesuai produk yang Anda beli.",submit:"Masuk"},
  activate:{eyebrow:"AKTIVASI AKUN",title:"Siapkan akun Anda",description:"Buat password 12–128 karakter setelah menerima tautan aktivasi.",submit:"Aktifkan akun"},
  forgot:{eyebrow:"PEMULIHAN AKUN",title:"Lupa password?",description:"Masukkan email akun untuk meminta tautan pengaturan ulang.",submit:"Kirim tautan"},
  reset:{eyebrow:"PASSWORD BARU",title:"Atur ulang password",description:"Gunakan password baru 12–128 karakter. Semua sesi lama akan diakhiri.",submit:"Simpan password"}
};
export function AuthScreen({mode}:{mode:Mode}){
  const router=useRouter();
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [confirmation,setConfirmation]=useState("");
  const [visible,setVisible]=useState(false);const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
  const [token,setToken]=useState("");const [validToken,setValidToken]=useState(false);const [done,setDone]=useState(false);
  const tokenMode=mode==="activate"||mode==="reset";const info=copy[mode];
  useEffect(()=>{
    if(!tokenMode)return;
    let cancelled=false;const value=new URLSearchParams(window.location.search).get("token")||"";setToken(value);
    void api<{email:string}>("/api/account/token?"+new URLSearchParams({token:value,kind:mode==="activate"?"activation":"password_reset"}))
      .then(result=>{if(!cancelled){setEmail(result.email);setValidToken(true);}})
      .catch(error=>{if(!cancelled)setNotice(error.message);});
    return()=>{cancelled=true;};
  },[mode,tokenMode]);
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setNotice("");
    if(tokenMode&&password!==confirmation){setNotice("Konfirmasi password tidak sama.");return;}
    setBusy(true);
    try{
      if(mode==="login"){
        await api("/api/auth/sign-in/email",{method:"POST",body:JSON.stringify({email:email.trim().toLowerCase(),password})});
        const profile=await api<{user:{role:string;status:string};features:string[];guideCompletedAt:string|null}>("/api/profile");
        router.replace(profile.user.role==="admin"?"/admin":profile.user.status==="active"&&!profile.guideCompletedAt?"/app/guide":profile.features.includes("hpp_calculator")?"/app/calculations":profile.features.includes("prompt_gallery")?"/app/prompts":"/app/access");router.refresh();
      }else{
        const action=mode==="forgot"?"forgot-password":mode==="activate"?"activate":"reset-password";
        const result=await api<{message:string}>("/api/account/"+action,{method:"POST",body:JSON.stringify(mode==="forgot"?{email:email.trim().toLowerCase()}:{token,password})});
        setNotice(result.message);if(tokenMode){setDone(true);setPassword("");setConfirmation("");}
      }
    }catch(error){setNotice(error instanceof Error?error.message:"Permintaan gagal. Coba kembali.");}
    finally{setBusy(false);}
  };
  const resend=async()=>{
    if(!email.trim()){setNotice("Isi alamat email untuk mengirim ulang aktivasi.");return;}
    setBusy(true);
    try{const result=await api<{message:string}>("/api/account/resend-activation",{method:"POST",body:JSON.stringify({email:email.trim().toLowerCase()})});setNotice(result.message);}
    catch(error){setNotice(error instanceof Error?error.message:"Gagal meminta aktivasi.");}finally{setBusy(false);}
  };
  return <main className="auth-page"><div className="auth-orb one"/><div className="auth-orb two"/><div className="auth-layout">
    <div className="auth-story"><Link href="/login" className="auth-brand" aria-label="KulinerKit by LRMobileID — masuk"><span className="brand-mark" aria-hidden="true">k<span>k</span></span><span className="auth-brand-name">KulinerKit<small>by LRMobileID</small></span></Link><div className="auth-story-main"><div className="auth-story-line"/><span>USAHA KULINER LEBIH TERARAH</span><h2>Dari resep,<br/>hingga hasil<br/><em>penjualan.</em></h2><p>Hitung HPP, tentukan harga, siapkan promosi, dan pantau hasil jualan dalam satu ruang kerja.</p><div className="auth-story-figure"><span>Contoh HPP per satuan</span><strong>Rp10.000</strong><div><i/> Bahan baku <b>70%</b></div><div><i/> Biaya lainnya <b>30%</b></div></div></div><div className="auth-story-foot">KulinerKit · Akses khusus pembeli</div></div>
    <div className="auth-form-side"><div className="auth-form-inner"><div className="auth-mobile-brand"><span className="brand-mark" aria-hidden="true">k<span>k</span></span><span className="auth-brand-name">KulinerKit<small>by LRMobileID</small></span></div><div className="eyebrow">{info.eyebrow}</div><h1>{info.title}</h1><p className="auth-description">{info.description}</p>
      {!done&&<form onSubmit={submit}><label className="auth-field"><span>Alamat email</span><div><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="nama@email.com" readOnly={tokenMode&&validToken} required maxLength={254}/></div></label>
      {mode!=="forgot"&&<label className="auth-field"><span>{mode==="login"?"Password":"Password baru"}</span><div><LockKeyhole size={17}/><input type={visible?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={event=>setPassword(event.target.value)} minLength={tokenMode?12:undefined} maxLength={128} required/><button type="button" aria-label={visible?"Sembunyikan password":"Tampilkan password"} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
      {tokenMode&&<label className="auth-field"><span>Konfirmasi password</span><div><LockKeyhole size={17}/><input type={visible?"text":"password"} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} minLength={12} maxLength={128} required/></div></label>}
      {mode==="login"&&<Link href="/forgot-password" className="forgot-link">Lupa password?</Link>}<button className="button primary full auth-submit" type="submit" disabled={busy||(tokenMode&&!validToken)}>{busy?"Memproses...":info.submit}<ArrowRight size={17}/></button></form>}
      {notice&&<div className="auth-notice" role="status">{notice}</div>}
      {mode==="login"||mode==="activate"?<button className="button secondary full" type="button" disabled={busy} onClick={resend}>Kirim ulang aktivasi</button>:null}
      {mode!=="login"&&<Link href="/login" className="button secondary full">Kembali masuk <ArrowRight size={16}/></Link>}
      <div className="auth-bottom"><LockKeyhole size={15}/> Akun dibuat otomatis dari pembelian yang memenuhi syarat. Tidak ada pendaftaran umum.</div>
    </div></div></div></main>;
}
