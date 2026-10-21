export type AdminGrant = {
  id:string; source:string; purchase_id:string; item_id:string; product_id:string;
  feature_key:string; status:string; reason:string|null;
};

export function groupAccessGrants(grants:AdminGrant[]){
  const purchases=new Map<string,{source:string;purchaseId:string;grants:AdminGrant[]}>();
  for(const grant of grants){
    const key=JSON.stringify([grant.source,grant.purchase_id]);
    let purchase=purchases.get(key);
    if(!purchase){purchase={source:grant.source,purchaseId:grant.purchase_id,grants:[]};purchases.set(key,purchase);}
    purchase.grants.push(grant);
  }
  return [...purchases.values()];
}

export function featureLabel(key:string){
  if(key==="hpp_calculator")return "Kalkulator HPP";
  if(key==="prompt_gallery")return "Galeri Prompt";
  return key;
}
