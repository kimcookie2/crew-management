import Link from "next/link";

export default async function AdminHome({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <Link style={item} href={`/${crewId}/admin/requests`}>가입 허용(요청 목록)</Link>
        <Link style={item} href={`/${crewId}/admin/members`}>멤버 관리(추가/정지/권한)</Link>
        <Link style={item} href={`/${crewId}/admin/crew-exits`}>퇴장 멤버 리스트</Link>
        <Link style={item} href={`/${crewId}/admin/settings`}>설정(초대코드 등)</Link>
      </div>
    </div>
  );
}

const item: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "black",
};