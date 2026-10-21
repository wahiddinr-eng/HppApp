import { protectPage } from "@/server/page-access";
import { AdminShell } from "@/components/admin-shell";
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}){
  const denied=await protectPage("admin");
  return denied||<AdminShell>{children}</AdminShell>;
}
