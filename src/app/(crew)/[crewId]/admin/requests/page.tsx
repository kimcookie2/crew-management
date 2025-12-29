import AdminJoinRequests from "@/components/AdminJoinRequests";

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;
  return (
    <div style={{ padding: 16 }}>
      <h2>가입 요청</h2>
      <AdminJoinRequests crewId={crewId} />
    </div>
  );
}
