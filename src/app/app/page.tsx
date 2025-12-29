import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AppHome() {
  const sb = supabaseServer();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: crews, error: crewsErr } = await sb
    .from("crews")
    .select("id,name,slug,created_at")
    .order("created_at", { ascending: false });

  // 에러면 join으로 보내지 말고 에러를 보여주는 게 디버깅에 좋음
  if (crewsErr) {
    return (
      <div style={{ padding: 16 }}>
        <h2>크루 목록을 불러오지 못했어</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{crewsErr.message}</pre>
      </div>
    );
  }

  if (!crews || crews.length === 0) redirect("/join");

  return (
    <div style={{ padding: 16 }}>
      <h2>내 크루</h2>
      <ul style={{ paddingLeft: 18 }}>
        {crews.map((c) => (
          <li key={c.id} style={{ marginTop: 8 }}>
            <Link href={`/${c.id}/dashboard`}>{c.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}