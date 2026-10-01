import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import { outputLabel, percent, rupiah } from "../lib/hpp";
import type { getReport } from "./calculations";

export type ReportSnapshot=Awaited<ReturnType<typeof getReport>>;
const sumProduct=(a:string,b:string)=>new Decimal(a||0).mul(b||0).toString();
const statuses={pending:"Belum dihitung",none:"Tidak ada biaya",filled:"Diisi"};
export function exportFilename(report:ReportSnapshot,format:string){
  const name=report.calculation.name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"produk";
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Makassar",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(report.calculation.updatedAt)).replaceAll("-","");
  return "HPP-"+name+"-"+date+"-r"+report.calculation.revision+"."+format;
}
export async function exportExcel(report:ReportSnapshot){
  const wb=new ExcelJS.Workbook();wb.creator="Kalkulator HPP Kuliner";wb.created=new Date();
  const c=report.input;const r=report.result;const unit=outputLabel(report.calculation);
  const sheet=(name:string,headers:string[],rows:(string|number)[][])=>{
    const ws=wb.addWorksheet(name,{views:[{state:"frozen",ySplit:1}]});
    ws.addRow(headers);rows.forEach(row=>ws.addRow(row));
    ws.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};ws.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF147D66"}};
    ws.columns=headers.map((header,index)=>({width:index===0?32:header.includes("canonical")?28:24}));
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,rows.length+1),column:headers.length}};
    ws.eachRow((row,index)=>{
      if(index<=1)return;
      row.eachCell((cell,column)=>{
        if(typeof cell.value!=="number")return;
        const label=String(row.getCell(1).value);
        const moneyColumn=name==="Bahan Baku"&&[4,5].includes(column)||name==="Kemasan"&&[3,4].includes(column)||name==="Tenaga Kerja"&&[3,4].includes(column)||name==="Biaya Produksi"&&column===3;
        const amountLabel=["Total biaya batch","HPP per satuan","Harga minimum menutup biaya","Saran harga","Harga pilihan efektif","Harga sebelum pajak","Pajak per satuan","Harga pelanggan","Pembulatan","target","suggested","effective","beforeTax","tax","customerPrice","difference"].includes(label);
        cell.numFmt=column===2&&(label.includes("(%)")||label==="actualMargin")?'0.##"%"':moneyColumn||column===2&&amountLabel?'"Rp"#,##0.######':"#,##0.######";
      });
    });
    return ws;
  };
  const numeric=(value:string)=>new Decimal(value||0).toDecimalPlaces(6).toNumber();
  const summary:(string|number)[][]=[
    ["Nama produk",c.name,""],["Nama usaha",c.business,""],["Jumlah batch",Number(c.batch),c.batch],["Satuan hasil",unit,""],["Revisi",report.calculation.revision,""],["Formula",report.formula_version,""],["Waktu WITA",new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Makassar",dateStyle:"long",timeStyle:"short"}).format(new Date(report.calculation.updatedAt)),""],
    ...["T","C","minimum","suggested","effective","beforeTax","tax","customerPrice","actualMargin"].map(key=>[({T:"Total biaya batch",C:"HPP per satuan",minimum:"Harga minimum menutup biaya",suggested:"Saran harga",effective:"Harga pilihan efektif",beforeTax:"Harga sebelum pajak",tax:"Pajak per satuan",customerPrice:"Harga pelanggan",actualMargin:"Margin aktual (%)"} as Record<string,string>)[key],numeric(String(r[key])),String(r[key])]),
    ["Status harga",String(r.priceStatus),""],["Kemasan",statuses[c.statuses.packages],""],["Tenaga kerja",statuses[c.statuses.labor],""],["Biaya lainnya",statuses[c.statuses.others],""],
    ["Catatan presisi","Nilai numeric adalah pendekatan bila melebihi 15 digit signifikan. Kolom canonical menjadi acuan.",""]
  ];
  sheet("Ringkasan",["Keterangan","Nilai","Decimal canonical"],summary);
  sheet("Bahan Baku",["Nama","Jumlah","Satuan","Harga per satuan","Subtotal","Jumlah canonical","Harga canonical","Subtotal canonical"],c.ingredients.filter(row=>row.name||row.quantity||row.price).map(row=>[row.name,numeric(row.quantity),row.unit,numeric(row.price),numeric(sumProduct(row.quantity,row.price)),row.quantity,row.price,sumProduct(row.quantity,row.price)]));
  sheet("Kemasan",["Nama","Jumlah","Harga per buah","Subtotal","Jumlah canonical","Harga canonical","Subtotal canonical"],c.packages.map(row=>[row.name,numeric(row.quantity),numeric(row.price),numeric(sumProduct(row.quantity,row.price)),row.quantity,row.price,sumProduct(row.quantity,row.price)]));
  sheet("Tenaga Kerja",["Keterangan","Orang","Upah per orang","Subtotal","Orang canonical","Upah canonical","Subtotal canonical"],c.labor.map(row=>[row.name,numeric(row.people),numeric(row.wage),numeric(sumProduct(row.people,row.wage)),row.people,row.wage,sumProduct(row.people,row.wage)]));
  sheet("Biaya Produksi",["Jenis biaya","Keterangan","Nominal batch","Decimal canonical"],c.others.map(row=>[row.type,row.note,numeric(row.amount),row.amount]));
  sheet("Harga dan Pajak",["Keterangan","Nilai","Decimal canonical"],[
    ["Target margin (%)",numeric(c.margin),c.margin],["Pembulatan",Number(c.rounding),c.rounding],["Status pajak",c.taxEnabled?"Aktif":"Nonaktif",""],["Nama pajak",c.taxEnabled?c.taxName:"",""],["Tarif pajak (%)",numeric(c.taxEnabled?c.taxRate:"0"),c.taxEnabled?c.taxRate:"0"],
    ...["target","suggested","effective","beforeTax","tax","customerPrice","difference","actualMargin"].map(key=>[key,numeric(String(r[key])),String(r[key])])
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
export async function exportPdf(report:ReportSnapshot):Promise<Buffer>{
  const doc=new PDFDocument({size:"A4",margin:40,bufferPages:true,info:{Title:"HPP "+report.calculation.name,Author:"Kalkulator HPP Kuliner"}});
  const buffers:Buffer[]=[];const done=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>buffers.push(chunk));doc.on("end",()=>resolve(Buffer.concat(buffers)));doc.on("error",reject);});
  const c=report.input;const r=report.result;const unit=outputLabel(report.calculation);const width=515;
  const room=(height:number)=>{if(doc.y+height>doc.page.height-65)doc.addPage();};
  const heading=(title:string)=>{room(45);doc.font("Helvetica-Bold").fontSize(12).fillColor("#147d66").text(title).moveDown(.5);doc.font("Helvetica").fillColor("#273b32");};
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#147d66").text("KALKULATOR HPP KULINER").moveDown();
  doc.fontSize(22).fillColor("#1c2c2b").text(c.name,{width}).moveDown(.3);
  doc.font("Helvetica").fontSize(10).text(c.business).text("Hasil: "+c.batch+" "+unit+" / batch | Revisi r"+report.calculation.revision+" | "+report.formula_version);
  doc.text("Waktu WITA: "+new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Makassar",dateStyle:"long",timeStyle:"short"}).format(new Date(report.calculation.updatedAt))).moveDown();
  heading("Ringkasan biaya dan harga");
  const labels:Record<string,string>={T:"Total biaya batch",C:"HPP per "+unit,minimum:"Harga minimum menutup biaya",suggested:"Saran harga jual",effective:"Harga pilihan efektif",beforeTax:"Harga jual sebelum pajak",tax:"Pajak per "+unit,customerPrice:"Total dibayar pelanggan",difference:"Estimasi selisih harga dan biaya / "+unit,actualMargin:"Margin aktual"};
  for(const [key,label]of Object.entries(labels)){room(22);const y=doc.y;doc.fontSize(10).text(label,40,y,{width:320});doc.font("Helvetica-Bold").text(key==="actualMargin"?percent(String(r[key])):rupiah(String(r[key]),2),360,y,{width:195,align:"right"});doc.font("Helvetica");doc.y=y+21;}
  doc.fontSize(10).text("Status: "+r.priceStatus).text("Target margin: "+percent(c.margin)+" | Pembulatan ke atas: "+rupiah(c.rounding));
  doc.text("Pajak: "+(c.taxEnabled?c.taxName+" "+percent(c.taxRate)+" ("+(c.taxMode==="inclusive"?"termasuk harga":"di luar harga")+")":"Nonaktif"));
  if((r.missing as string[]).length)doc.fillColor("#865315").text("Estimasi dengan biaya belum lengkap: "+(r.missing as string[]).join(", ")).fillColor("#273b32");
  doc.moveDown();
  const table=(title:string,headers:string[],rows:string[][],total:string)=>{
    heading(title+" - total "+rupiah(total,2));const widths=[220,85,105,105];
    const header=()=>{room(28);const y=doc.y;doc.rect(40,y,width,23).fill("#eef4ef");let x=40;headers.forEach((cell,i)=>{doc.fillColor("#344b3d").font("Helvetica-Bold").fontSize(8).text(cell,x+6,y+7,{width:widths[i]-12,align:i===3?"right":"left"});x+=widths[i];});doc.y=y+25;doc.font("Helvetica");};
    header();
    rows.forEach(row=>{
      doc.fontSize(9);const height=Math.max(...row.map((cell,i)=>doc.heightOfString(cell,{width:widths[i]-12})))+14;
      if(doc.y+height>doc.page.height-65){doc.addPage();heading(title+" (lanjutan)");header();}
      const y=doc.y;let x=40;row.forEach((cell,i)=>{doc.fillColor("#273b32").text(cell,x+6,y+6,{width:widths[i]-12,align:i===3?"right":"left"});x+=widths[i];});
      doc.moveTo(40,y+height).lineTo(555,y+height).strokeColor("#e4eae3").stroke();doc.y=y+height;
    });
    if(!rows.length)doc.fontSize(9).text("Tidak ada rincian. Periksa status kategori pada ringkasan.");
    doc.moveDown();
  };
  table("Bahan baku",["Nama","Jumlah / satuan","Harga / satuan","Subtotal"],c.ingredients.filter(row=>row.name).map(row=>[row.name,row.quantity+" "+row.unit,rupiah(row.price,2),rupiah(sumProduct(row.quantity,row.price),2)]),String(r.B));
  table("Kemasan",["Nama","Jumlah","Harga / buah","Subtotal"],c.packages.map(row=>[row.name,row.quantity,rupiah(row.price,2),rupiah(sumProduct(row.quantity,row.price),2)]),String(r.K));
  table("Tenaga kerja",["Pekerjaan","Orang","Upah / orang","Subtotal"],c.labor.map(row=>[row.name,row.people,rupiah(row.wage,2),rupiah(sumProduct(row.people,row.wage),2)]),String(r.L));
  table("Biaya produksi lainnya",["Jenis / keterangan","Batch","Biaya","Subtotal"],c.others.map(row=>[row.type+(row.note?" - "+row.note:""),"1",rupiah(row.amount,2),rupiah(row.amount,2)]),String(r.O));
  heading("Catatan");
  doc.fontSize(9).text("Kemasan: "+statuses[c.statuses.packages]+". Tenaga kerja: "+statuses[c.statuses.labor]+". Biaya lainnya: "+statuses[c.statuses.others]+".");
  doc.text("Simulasi selisih seluruh batch: "+rupiah(new Decimal(String(r.difference)).mul(c.batch),2)+", jika seluruh hasil terjual. Hasil ini adalah estimasi berdasarkan biaya yang dimasukkan, bukan laba bersih atau harga pasar. Pajak terpisah dari HPP. Angka tampilan dibulatkan hingga 2 desimal.");
  if(c.note)doc.text("Catatan produksi: "+c.note);
  const pages=doc.bufferedPageRange();const exported=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Makassar",dateStyle:"short",timeStyle:"short"}).format(new Date());
  for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font("Helvetica").fontSize(8).fillColor("#829184").text("r"+report.calculation.revision+" | Ekspor "+exported+" WITA | Halaman "+(i+1)+" / "+pages.count,40,doc.page.height-38,{width,align:"center",lineBreak:false});}
  doc.end();return done;
}
