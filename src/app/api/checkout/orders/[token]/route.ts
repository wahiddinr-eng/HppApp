import { findCheckoutOrder } from "@/server/checkout";
import { apiError, privateJson } from "@/server/http";
import { purchaseBrowserEvent } from "@/server/meta";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){try{
  const {token}=await params;
  const order=await findCheckoutOrder(token);
  const {id,...publicOrder}=order;
  const metaPurchase=order.status==="complete"?await purchaseBrowserEvent(id):null;
  return privateJson({...publicOrder,metaPurchase});
}catch(error){return apiError(error);}}
