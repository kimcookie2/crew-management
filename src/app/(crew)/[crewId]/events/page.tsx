import CrewCalendar from "@/components/CrewCalendar";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  return (
    <div style={{ padding: 16 }}>
      <CrewCalendar crewId={crewId} />
    </div>
  );
}
