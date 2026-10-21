"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Store } from "lucide-react";
import { useCalculations } from "@/lib/store";
import { PageTop, Shell } from "./shell";

export function ChannelIndex() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { items, ready, error, total } = useCalculations({ search, status: "final", page });
  return <Shell>
    <PageTop eyebrow="HARGA JUAL / KANAL" title="Pilih produk untuk dihitung" description="Ambil HPP dari resep yang sudah selesai, lalu bandingkan harga jual di setiap kanal." />
    {error && <div role="alert" className="form-message error">{error}</div>}
    <label className="search-box channel-search"><Search size={18} /><span className="sr-only">Cari produk</span><input placeholder="Cari produk..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
    <div className="channel-index-list">{items.map((item) => <Link key={item.id} className="panel channel-index-item" href={`/app/calculations/${item.id}/channels`}><Store size={20} /><span><strong>{item.name}</strong><small>{item.business} · revisi r{item.revision}</small></span><ArrowRight size={17} /></Link>)}</div>
    {ready && total === 0 && !error && <div className="panel channel-empty"><h2>{search ? "Produk tidak ditemukan" : "Belum ada resep yang selesai"}</h2><p>{search ? "Coba kata kunci lain." : "Hitung dan simpan HPP produk lebih dulu sebelum menentukan harga aplikasi pesan-antar."}</p>{!search && <Link href="/app/calculations/new" className="button primary">Buat perhitungan</Link>}</div>}
    <div className="channel-pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>Halaman {page}</span><button className="button secondary" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Berikutnya</button></div>
  </Shell>;
}
