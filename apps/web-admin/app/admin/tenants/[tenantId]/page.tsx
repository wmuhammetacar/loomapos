import { AdminTenantDetailPanel } from "@/components/admin/admin-detail-panels";

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function AdminTenantDetailPage({ params }: TenantDetailPageProps) {
  const { tenantId } = await params;
  return <AdminTenantDetailPanel tenantId={tenantId} />;
}
