export default async function EventDetail({
  params,
}: {
  params: Promise<{ crewId: string; eventId: string }>;
}) {
  const { crewId, eventId } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h2>이벤트 상세</h2>
      <div>crewId: {crewId}</div>
      <div>eventId: {eventId}</div>
    </div>
  );
}
