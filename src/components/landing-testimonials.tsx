"use client";
import { useEffect,useState } from "react";
import { Quote } from "lucide-react";
import { api } from "@/lib/api";
import styles from "./landing.module.css";

type Testimonial={id:string;customer_name:string;business_name:string;quote:string};
export function LandingTestimonials(){
  const [items,setItems]=useState<Testimonial[]>([]);
  useEffect(()=>{void api<Testimonial[]>("/api/landing/testimonials").then(setItems).catch(()=>undefined);},[]);
  if(!items.length)return null;
  return <section className={`${styles.container} ${styles.testimonialsSection}`} id="testimoni" aria-labelledby="testimonials-title"><div className={styles.testimonialsHead}><div><span className={styles.eyebrow}>CERITA PENGGUNA</span><h2 id="testimonials-title">Lebih yakin melangkah,<br/><em>dari dapur sendiri.</em></h2></div><p>Pengalaman nyata dari pengguna KulinerKit. Setiap usaha punya perjalanan berbeda; hasil Anda bergantung pada cara menggunakannya.</p></div><div className={styles.testimonialsGrid}>{items.map(item=><article key={item.id} className={styles.testimonialCard}><Quote size={25} aria-hidden="true"/><blockquote>“{item.quote}”</blockquote><div className={styles.testimonialAuthor}><span aria-hidden="true">{item.customer_name.slice(0,1).toUpperCase()}</span><div><strong>{item.customer_name}</strong>{item.business_name&&<small>{item.business_name}</small>}</div></div></article>)}</div></section>;
}
