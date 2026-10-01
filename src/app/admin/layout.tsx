import { protectPage } from "@/server/page-access";
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}){return await protectPage("admin")||children;}
