import CrewNav from "@/components/CrewNav";

export default async function CrewLayout({
  params,
  children,
}: {
  params: Promise<{ crewId: string }>;
  children: React.ReactNode;
}) {
  const { crewId } = await params;

  return (
    <div style={{ minHeight: "100vh", background: "white" }}>
      <CrewNav crewId={crewId} />
      <main style={{ padding: 16 }}>{children}</main>
    </div>
  );
}
