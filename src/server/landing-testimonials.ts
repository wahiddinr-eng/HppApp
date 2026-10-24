import { z } from "zod";
import { query } from "./db";

export const testimonialSchema=z.object({
  id:z.uuid().optional(),
  customerName:z.string().trim().min(2).max(100),
  businessName:z.string().trim().max(120),
  quote:z.string().trim().min(10).max(1000),
  consentConfirmed:z.boolean(),
  published:z.boolean(),
  sortOrder:z.number().int().min(0).max(100000),
}).refine(value=>!value.published||value.consentConfirmed,{path:["consentConfirmed"],message:"Konfirmasi izin pelanggan sebelum menerbitkan testimoni."});

export type TestimonialRow={id:string;customer_name:string;business_name:string;quote:string;consent_confirmed:boolean;published:boolean;sort_order:number;created_at:string;updated_at:string};

export async function publicTestimonials(){
  const result=await query<Pick<TestimonialRow,"id"|"customer_name"|"business_name"|"quote">>("SELECT id,customer_name,business_name,quote FROM landing_testimonial WHERE published=true AND consent_confirmed=true ORDER BY sort_order,created_at LIMIT 12");
  return result.rows;
}
