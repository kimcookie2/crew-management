import Link from "next/link";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  return (
    <div style={{ padding: 16 }}>
      
    </div>
  );
}
