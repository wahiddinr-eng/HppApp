import { Report } from "@/components/report";
export default async function Page({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{revision?:string}> }) {
  const { id } = await params;
  const search=await searchParams;
  return <Report id={id} revision={search.revision===undefined?undefined:Number(search.revision)} />;
}
