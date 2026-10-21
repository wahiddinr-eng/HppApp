import { ChannelPricing } from "@/components/channel-pricing";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChannelPricing id={id} />;
}
