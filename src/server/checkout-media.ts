import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectPromptImage } from "./prompt-media";
import { DomainError } from "./http";

function root(){return resolve(/* turbopackIgnore: true */ process.cwd(),process.env.CHECKOUT_MEDIA_ROOT||".data/checkout");}
export async function storeQrisImage(bytes:Uint8Array){
  const {mime,ext}=detectPromptImage(bytes);
  const key=`${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
  await mkdir(root(),{recursive:true,mode:0o700});
  try{await writeFile(resolve(/* turbopackIgnore: true */ root(),key),bytes,{flag:"wx",mode:0o600});}
  catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;}
  return {key,mime};
}
export async function readQrisImage(key:string,mime:string){
  if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(key)||!["image/jpeg","image/png","image/webp"].includes(mime))throw new DomainError(404,"QRIS_NOT_FOUND","Gambar QRIS tidak ditemukan.");
  try{return await readFile(resolve(/* turbopackIgnore: true */ root(),key));}
  catch{throw new DomainError(404,"QRIS_NOT_FOUND","Gambar QRIS tidak ditemukan.");}
}
