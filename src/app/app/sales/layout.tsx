import { protectPage } from "@/server/page-access";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return await protectPage("calculator") || children;
}
