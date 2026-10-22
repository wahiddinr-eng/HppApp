import { apiError, privateJson } from "@/server/http";
import { getCheckoutSettings, publicCheckoutSettings } from "@/server/checkout";
export async function GET(){try{return privateJson(publicCheckoutSettings(await getCheckoutSettings()));}catch(error){return apiError(error);}}
