import assert from "node:assert/strict";
import test from "node:test";
import { featureLabel, groupAccessGrants, type AdminGrant } from "../src/lib/admin-access";

const grant=(purchase:string,feature:string):AdminGrant=>({id:`${purchase}:${feature}`,source:"app.lrmobileid.com",purchase_id:purchase,item_id:`${purchase}:main`,product_id:"prd_bundle",feature_key:feature,status:"active",reason:"purchase_paid"});

test("dua fitur dalam satu bundle ditampilkan sebagai satu pembelian",()=>{
  const groups=groupAccessGrants([grant("trx_1","hpp_calculator"),grant("trx_1","prompt_gallery"),grant("trx_2","hpp_calculator")]);
  assert.equal(groups.length,2);
  assert.deepEqual(groups[0].grants.map(item=>featureLabel(item.feature_key)),["Kalkulator HPP","Galeri Prompt"]);
  assert.equal(groups[0].purchaseId,"trx_1");
  assert.equal(groups[1].purchaseId,"trx_2");
});
