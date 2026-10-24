import { apiError, privateJson } from "@/server/http";
import { getCheckoutSettings, getPromoStatus, publicCheckoutSettings } from "@/server/checkout";
export async function GET(){try{const settings=await getCheckoutSettings();return privateJson(publicCheckoutSettings(settings,await getPromoStatus(settings)));}catch(error){return apiError(error);}}
