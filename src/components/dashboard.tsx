"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Archive, BookOpenText, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleCheck, Copy, Ellipsis, FolderOpen, PackageCheck, Plus, RotateCcw, Search, Sparkles } from "lucide-react";
import { calculate, Calculation, rupiah, today, uid } from "@/lib/hpp";
import { duplicateCalculation, archiveCalculation, useCalculations } from "@/lib/store";
import { PageTop, Shell } from "./shell";

const date = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Makassar" }).format(new Date(value));

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [page,setPage]=useState(1);
  const [actionError,setActionError]=useState("");
  const {items,ready,refresh,total,stats,error}=useCalculations({search:query,status:filter,page});
  const [menu, setMenu] = useState<string | null>(null);
  const router = useRouter();
  const visible = useMemo(() => items.filter(item => item.archived === (filter === "archived") && `${item.name} ${item.business}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), [items, query, filter]);
  const active = items.filter(item => !item.archived);
  const finals = active.filter(item => item.state === "final");
  const average = stats.average;
  const latest = finals.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const duplicate = async (item: Calculation) => {
    try{const copy=await duplicateCalculation(item.id);router.push("/app/calculations/"+copy.id+"/edit");}
    catch(error){setActionError(error instanceof Error?error.message:"Gagal menduplikasi.");}
  };
  const toggleArchive = async (item: Calculation) => {try{await archiveCalculation(item.id,!item.archived);await refresh();setMenu(null);}catch(error){setActionError(error instanceof Error?error.message:"Gagal mengubah arsip.");}};

  return <Shell><PageTop eyebrow="DASHBOARD / RINGKASAN" title="Selamat datang di ruang hitung Anda" description="Lihat biaya produksi, temukan harga yang pas, dan simpan setiap keputusan dengan rapi." actions={<Link href="/app/calculations/new" className="button primary"><Plus size={18} /> Perhitungan baru</Link>} />
    {(error||actionError)&&<div className="form-message error" role="alert">{error||actionError}</div>}
    <section className="metric-grid" aria-label="Ringkasan perhitungan">
      <div className="metric-card"><div className="metric-icon green"><BookOpenText size={20} /></div><span>Total perhitungan</span><strong>{stats.active.toString().padStart(2, "0")}</strong><small><ArrowUpRight size={14} /> Resep aktif</small></div>
      <div className="metric-card"><div className="metric-icon blue"><PackageCheck size={20} /></div><span>Hasil tersimpan</span><strong>{stats.final.toString().padStart(2, "0")}</strong><small><CircleCheck size={14} /> Siap dilihat kembali</small></div>
      <div className="metric-card"><div className="metric-icon amber"><ChartNoAxesCombined size={20} /></div><span>Rata-rata HPP per unit</span><strong className="metric-money">{rupiah(average)}</strong><small><ArrowDownRight size={14} /> Dari hasil tersimpan</small></div>
    </section>
    <div className="dashboard-lower"><section className="panel calculations-panel"><div className="panel-head"><div><h2>Perhitungan saya</h2><p>Semua biaya produk dalam satu tempat.</p></div><div className="panel-head-icon"><FolderOpen size={21} /></div></div>
      <div className="list-toolbar"><label className="search-box"><Search size={18} /><span className="sr-only">Cari produk atau usaha</span><input value={query} onChange={event => {setQuery(event.target.value);setPage(1);}} placeholder="Cari produk atau usaha..." /></label><div className="segmented"><button className={filter === "active" ? "selected" : ""} onClick={() => {setFilter("active");setPage(1);}}>Aktif</button><button className={filter === "archived" ? "selected" : ""} onClick={() => {setFilter("archived");setPage(1);}}>Arsip</button></div></div>
      <div className="calculation-list">{ready && visible.length ? visible.map(item => { const result = calculate(item); return <div className="calculation-row" key={item.id}><div className="product-emblem">{item.name.trim().slice(0,1).toUpperCase() || "?"}</div><div className="calculation-identity"><Link href={item.state === "final" ? `/app/calculations/${item.id}/report` : `/app/calculations/${item.id}/edit`}>{item.name || "Tanpa nama"}</Link><span>{item.business || "Usaha belum diisi"} <i>•</i> {item.batch || "—"} {item.outputUnit}</span></div><div className="calculation-price"><b>{item.state === "final" ? rupiah(result.C, 2) : "—"}</b><span>HPP per {item.outputUnit}</span></div><div className="calculation-date"><CalendarDays size={14} /> {date(item.updatedAt)}</div><span className={`status-pill ${item.state}`}>{item.state === "final" ? "Selesai" : "Draft"}</span><div className="row-menu"><button className="icon-button" aria-label={`Opsi ${item.name}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}><Ellipsis size={19} /></button>{menu === item.id && <div className="menu-pop"><Link href={item.state === "final" ? `/app/calculations/${item.id}/report` : `/app/calculations/${item.id}/edit`}>{item.state === "final" ? "Lihat report" : "Lanjutkan draft"}</Link><Link href={`/app/calculations/${item.id}/edit`}>Edit perhitungan</Link><button onClick={() => duplicate(item)}><Copy size={15} /> Duplikat</button><button onClick={() => toggleArchive(item)}>{item.archived ? <RotateCcw size={15} /> : <Archive size={15} />}{item.archived ? "Pulihkan" : "Arsipkan"}</button></div>}</div></div>; }) : <div className="empty-state"><div className="empty-icon"><BookOpenText size={24} /></div><h3>{ready ? "Belum ada perhitungan" : "Memuat perhitungan..."}</h3><p>{query ? "Coba kata kunci lain." : "Mulai dengan menghitung biaya satu produk unggulan Anda."}</p><Link href="/app/calculations/new" className="button primary"><Plus size={16} /> Perhitungan baru</Link></div>}</div>
      <div className="panel-footer"><span>Menampilkan {visible.length} dari {total} perhitungan · halaman {page}</span><div><button className="button secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Sebelumnya</button> <button className="button secondary" disabled={page*20>=total} onClick={()=>setPage(page+1)}>Berikutnya</button></div></div>
    </section><aside className="dashboard-aside"><div className="insight-card"><div className="insight-overline"><span className="insight-spark"><Sparkles size={15} /></span> MULAI DARI SINI</div><h2>Kenali biaya,<br /><em>tetapkan harga.</em></h2><p>Isi bahan dan biaya per batch. Kami bantu hitung HPP dan simulasi harga berdasarkan target margin Anda.</p><Link href="/app/calculations/new">Mulai hitung sekarang <ArrowRight size={17} /></Link><div className="insight-decoration"><span /><span /><span /><span /></div></div><div className="latest-card"><div className="latest-heading"><span>TERAKHIR DIHITUNG</span><ChartNoAxesCombined size={18} /></div>{latest ? <><h3>{latest.name}</h3><div className="latest-numbers"><div><span>Total biaya batch</span><b>{rupiah(calculate(latest).T)}</b></div><div><span>Saran harga jual</span><b>{rupiah(calculate(latest).suggested)}</b></div></div><Link href={`/app/calculations/${latest.id}/report`}>Lihat report <ArrowRight size={16} /></Link></> : <p>Belum ada hasil tersimpan.</p>}</div></aside></div>
  </Shell>;
}
