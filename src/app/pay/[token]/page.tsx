import type { Metadata } from "next";
import { PaymentPage } from "@/components/payment-page";
export const metadata:Metadata={title:"Pembayaran KulinerKit",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <PaymentPage token={token}/>;}
