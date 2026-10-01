"use client";
export class ApiError extends Error {
  constructor(public code:string,message:string,public status:number,public fieldErrors?:Record<string,string>){super(message);}
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(path,{...options,cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json",...options.headers}});
  const body=await response.json().catch(()=>({message:"Respons server tidak dapat dibaca."}));
  if(!response.ok)throw new ApiError(body.code||"SERVER_ERROR",body.message||"Permintaan gagal.",response.status,body.field_errors);
  return body as T;
}
