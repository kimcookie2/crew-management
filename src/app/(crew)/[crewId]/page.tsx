import Link from "next/link";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h2>이벤트</h2>
      <div style={{ marginTop: 10 }}>
        <Link href={`/${crewId}/events/new`}>+ 참석 입력(새 이벤트)</Link>
      </div>
    </div>
  );
}
