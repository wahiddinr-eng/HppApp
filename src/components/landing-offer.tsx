"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./landing.module.css";
import { MetaPageEvent } from "./meta-page-event";
const money=(n:number)=>"Rp"+n.toLocaleString("id-ID");
export function LandingOffer(){
  const [offer,setOffer]=useState({price:125000,comparePrice:299000});
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{void api<{price:number;comparePrice:number}>("/api/checkout").then(value=>{setOffer(value);setLoaded(true);}).catch(()=>undefined);},[]);
  return <>{loaded&&<MetaPageEvent name="ViewContent" price={offer.price}/>}<div className={styles.offerPrice}><del>{money(offer.comparePrice)}</del><strong>{money(offer.price)}</strong><span>sekali bayar · seluruh fitur</span></div><Link href="/checkout" className={styles.primaryButton}>Beli akses KulinerKit <ArrowUpRight size={18}/></Link></>;
}
