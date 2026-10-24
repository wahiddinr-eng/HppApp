import { publicTestimonials } from "@/server/landing-testimonials";
import { apiError,privateJson } from "@/server/http";
export async function GET(){try{return privateJson(await publicTestimonials());}catch(error){return apiError(error);}}
