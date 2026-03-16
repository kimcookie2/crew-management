import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import CrewHiddenClient from "./CrewHiddenClient";

export default async function CrewHiddenPage({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;
  const sb = supabaseServer();

  const { data: isAdmin } = await sb.rpc("is_crew_admin", { p_crew_id: crewId });
  if (!isAdmin) redirect(`/${crewId}/dashboard`);

  const { data, error } = await sb.rpc("get_crew_hidden_members_admin", { p_crew_id: crewId });
  if (error) return <div style={{ padding: 16 }}>에러: {error.message}</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CrewHiddenClient crewId={crewId} initialRows={(data ?? []) as any[]} />;
}