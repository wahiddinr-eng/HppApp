import { z } from "zod";
import { blankCalculation, type Calculation, parseMoney, parseQuantity } from "./hpp";

const text = (max:number) => z.string().max(max);
const numberText = text(80);
const rowId = text(128);
export const inputSchema = z.object({
  name:text(120),business:text(120),batch:numberText,outputUnit:z.enum(["box","pack","cup","porsi","buah","botol","lainnya"]),customUnit:text(30),note:text(500),
  ingredients:z.array(z.object({id:rowId,name:text(100),quantity:numberText,unit:z.enum(["g","kg","ml","liter","buah"]),price:numberText,catalogId:z.uuid().optional()})).max(100),
  packages:z.array(z.object({id:rowId,name:text(100),quantity:numberText,price:numberText})).max(50),
  labor:z.array(z.object({id:rowId,name:text(100),people:numberText,wage:numberText})).max(50),
  others:z.array(z.object({id:rowId,type:z.enum(["Listrik","Gas","Air","Sewa ruang produksi","Penggunaan alat","Lainnya"]),note:text(200),amount:numberText})).max(50),
  statuses:z.object({packages:z.enum(["pending","none","filled"]),labor:z.enum(["pending","none","filled"]),others:z.enum(["pending","none","filled"])}),
  taxEnabled:z.boolean(),taxName:text(60),taxRate:numberText,taxMode:z.enum(["exclusive","inclusive"]),margin:numberText,rounding:z.enum(["1","500","1000"]),manualPrice:numberText
});
export type CalculationInput = z.infer<typeof inputSchema>;

export function toApiInput(c: Calculation): CalculationInput {
  return inputSchema.parse({
    ...c,batch:parseQuantity(c.batch),margin:parseQuantity(c.margin),taxRate:parseQuantity(c.taxRate),manualPrice:parseMoney(c.manualPrice),
    ingredients:c.ingredients.map(row=>({...row,quantity:parseQuantity(row.quantity),price:parseMoney(row.price)})),
    packages:c.packages.map(row=>({...row,quantity:parseQuantity(row.quantity),price:parseMoney(row.price)})),
    labor:c.labor.map(row=>({...row,people:parseQuantity(row.people),wage:parseMoney(row.wage)})),
    others:c.others.map(row=>({...row,amount:parseMoney(row.amount)}))
  });
}

export function toFormInput(input:CalculationInput): Calculation {
  const money = (value:string) => value.replace(".",",");
  return {...blankCalculation(),...input,manualPrice:money(input.manualPrice),
    ingredients:input.ingredients.map(row=>({...row,price:money(row.price)})),
    packages:input.packages.map(row=>({...row,price:money(row.price)})),
    labor:input.labor.map(row=>({...row,wage:money(row.wage)})),
    others:input.others.map(row=>({...row,amount:money(row.amount)}))};
}
