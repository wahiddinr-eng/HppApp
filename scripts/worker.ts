import { setTimeout } from "node:timers/promises";
import { processOneWebhook } from "../src/server/worker";
import { processOneEmail } from "../src/server/email";
import { getPool,query,requireBackendConfig } from "../src/server/db";
import {maintainRetention} from "../src/server/maintenance";
import {processOneMetaEvent} from "../src/server/meta";
import {processOneAdminPush} from "../src/server/admin-push";
requireBackendConfig();let running=true;
let lastMaintenance=0;
process.on("SIGTERM",()=>{running=false;});process.on("SIGINT",()=>{running=false;});
while(running){
  try{
    if(Date.now()-lastMaintenance>60000){await maintainRetention();lastMaintenance=Date.now();}
    await query("INSERT INTO worker_health(name,last_seen) VALUES('main',now()) ON CONFLICT(name) DO UPDATE SET last_seen=now()");
    const work=await processOneWebhook();const email=await processOneEmail();const meta=await processOneMetaEvent();const push=await processOneAdminPush();
    if(!work&&!email&&!meta&&!push)await setTimeout(2000);
  }catch{console.error("Worker database unavailable; retrying.");await setTimeout(5000);}
}
await getPool().end();
