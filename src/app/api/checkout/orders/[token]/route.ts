import { findCheckoutOrder } from "@/server/checkout";
import { apiError, privateJson } from "@/server/http";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){try{
  const {token}=await params;
  const order=await findCheckoutOrder(token);
  return privateJson(order);
}catch(error){return apiError(error);}}
