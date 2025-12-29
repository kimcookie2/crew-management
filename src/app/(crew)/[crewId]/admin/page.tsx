import Link from "next/link";

export default async function AdminHome({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <Link href={`/${crewId}/admin/requests`}>가입 허용(요청 목록)</Link>
        <Link href={`/${crewId}/admin/members`}>멤버 관리(추가/정지/권한)</Link>
        <Link href={`/${crewId}/admin/settings`}>설정(초대코드 등)</Link>
      </div>
    </div>
  );
}
