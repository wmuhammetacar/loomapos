import { AdminCrmLeadDetailPanel } from "@/components/admin/admin-crm-detail-panel";

interface AdminCrmLeadDetailPageProps {
  params: Promise<{ leadId: string }>;
}

export default async function AdminCrmLeadDetailPage({ params }: AdminCrmLeadDetailPageProps) {
  const { leadId } = await params;
  return <AdminCrmLeadDetailPanel leadId={leadId} />;
}
