import test from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {sampleCalculation,blankCalculation,calculate,validate,convertUnit,subtotalIngredient,moneyInput} from "../src/lib/hpp";
import {toApiInput,toFormInput} from "../src/lib/input";
import {snapshotResult} from "../src/server/calculations";
import {exportExcel,exportPdf,type ReportSnapshot} from "../src/server/export";
import ExcelJS from "exceljs";
test("Brownies PRD: HPP, margin, rounding and taxes",()=>{
  const c=sampleCalculation();assert.deepEqual(validate(c),{});const r=calculate(c);
  assert.equal(r.B.toString(),"70000");assert.equal(r.T.toString(),"100000");assert.equal(r.C.toString(),"10000");assert.equal(r.suggested.toString(),"14500");
  assert.ok(r.actualMargin.minus(new Decimal(4500).div(14500).mul(100)).abs().lt("0.0000000001"));
  const exclusive=calculate({...c,taxEnabled:true,taxName:"PBJT",taxRate:"10"});
  assert.equal(exclusive.tax.toString(),"1450");assert.equal(exclusive.customerPrice.toString(),"15950");
  const inclusive=calculate({...c,taxEnabled:true,taxName:"PBJT",taxRate:"10",taxMode:"inclusive"});
  assert.equal(inclusive.suggested.toString(),"16000");assert.equal(inclusive.minimum.toString(),"11000");
});
test("Repeated division does not misclassify boundary prices",()=>{
  const c={...sampleCalculation(),batch:"3",ingredients:[{id:"a",name:"Bahan",quantity:"1",unit:"buah" as const,price:"100"}],packages:[],labor:[],others:[],statuses:{packages:"none" as const,labor:"none" as const,others:"none" as const},margin:"0",manualPrice:"33,333333"};
  assert.equal(calculate(c).priceStatus,"Belum menutup biaya");c.manualPrice="33,333334";assert.equal(calculate(c).priceStatus,"Target margin tercapai");
});
test("Unit conversions retain subtotal including decimal prices",()=>{
  const ingredient={id:"x",name:"Tepung",quantity:"1",unit:"kg" as const,price:"1500"};
  const converted=convertUnit(ingredient,"g")!;assert.equal(converted.price,"1,5");assert.ok(subtotalIngredient(converted).equals(subtotalIngredient(ingredient)));
  assert.equal(convertUnit(ingredient,"ml"),null);
  assert.equal(moneyInput("999999999999,123456"),"999.999.999.999,123456");
});
test("Canonical input roundtrip and invalid final input",()=>{
  const c=sampleCalculation();c.ingredients[0].price="15.000,123456";const input=toApiInput(c);
  assert.equal(input.ingredients[0].price,"15000.123456");assert.deepEqual(toApiInput(toFormInput(input)),input);
  assert.throws(()=>snapshotResult(toApiInput(blankCalculation())));
  input.ingredients[0].price="15,000";assert.throws(()=>snapshotResult(input));
  const valid=toApiInput(sampleCalculation());valid.margin="100";assert.throws(()=>snapshotResult(valid));
});
test("Snapshot PDF and Excel preserve literals and numeric/canonical cells",async()=>{
  const c=sampleCalculation();c.name="=HYPERLINK(unsafe)";c.ingredients[0].name="+SUM(A1:A2)";
  const input=toApiInput(c);const snapshot:ReportSnapshot={calculation:{...c,state:"final"},input,result:snapshotResult(input),schema_version:"1",formula_version:"hpp-v1"};
  const excel=await exportExcel(snapshot);const wb=new ExcelJS.Workbook();await wb.xlsx.load(excel as unknown as Parameters<typeof wb.xlsx.load>[0]);
  assert.equal(wb.worksheets.length,6);assert.equal(wb.getWorksheet("Ringkasan")!.getCell("B2").value,c.name);
  assert.equal(wb.getWorksheet("Bahan Baku")!.getCell("A2").value,"+SUM(A1:A2)");
  assert.equal(typeof wb.getWorksheet("Bahan Baku")!.getCell("D2").value,"number");
  assert.equal(wb.getWorksheet("Bahan Baku")!.getCell("G2").value,"15000");
  const pdf=await exportPdf(snapshot);assert.equal(pdf.subarray(0,5).toString(),"%PDF-");assert.ok(pdf.length>2000);
});
test("Large valid inputs remain decimal strings without scientific notation",()=>{
  const c=sampleCalculation();c.batch="1";c.margin="99,99";c.packages=[];c.labor=[];c.others=[];c.statuses={packages:"none",labor:"none",others:"none"};
  c.ingredients=Array.from({length:100},(_,index)=>({id:String(index),name:"Bahan "+index,quantity:"1000000",unit:"kg",price:"1000000000000"}));
  const r=snapshotResult(toApiInput(c));assert.equal(r.T,"100000000000000000000");assert.equal(r.target,"1000000000000000000000000");assert.ok(!String(r.suggested).includes("e"));
});
test("A4 PDF paginates 100 long ingredient names",async()=>{
  const c=sampleCalculation();c.ingredients=Array.from({length:100},(_,index)=>({id:String(index),name:("Bahan dengan nama panjang untuk memeriksa pergantian halaman "+index).slice(0,100),quantity:"1",unit:"kg",price:"15000"}));
  const input=toApiInput(c);const pdf=await exportPdf({calculation:{...c,state:"final"},input,result:snapshotResult(input),formula_version:"hpp-v1",schema_version:"1"});
  assert.ok((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length>=3);
});
