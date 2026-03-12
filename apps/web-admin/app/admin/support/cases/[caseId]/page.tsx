import { AdminSupportCaseDetailPanel } from "@/components/admin/admin-detail-panels";

interface SupportCaseDetailPageProps {
  params: Promise<{ caseId: string }>;
}

export default async function AdminSupportCaseDetailPage({ params }: SupportCaseDetailPageProps) {
  const { caseId } = await params;
  return <AdminSupportCaseDetailPanel caseId={caseId} />;
}
