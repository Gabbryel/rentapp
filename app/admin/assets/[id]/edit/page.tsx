import { notFound } from "next/navigation";
import { getAssetById } from "@/lib/assets";
import EditAssetClient from "./EditAssetClient";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetById(id);
  if (!asset) return notFound();
  return <EditAssetClient asset={asset} />;
}
