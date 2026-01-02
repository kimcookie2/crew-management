import StatsClient from "./StatsClient";

export default async function StatsPage({ params }: { params: Promise<{ crewId: string }> }) {
  const { crewId } = await params;
  return (
    <div style={{ padding: 0 }}>
      <StatsClient crewId={crewId} />
    </div>
  );
}