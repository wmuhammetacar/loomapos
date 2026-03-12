import { AdminResellerDetailPanel } from "@/components/admin/admin-detail-panels";

interface ResellerDetailPageProps {
  params: Promise<{ resellerId: string }>;
}

export default async function AdminResellerDetailPage({ params }: ResellerDetailPageProps) {
  const { resellerId } = await params;
  return <AdminResellerDetailPanel resellerId={resellerId} />;
}
