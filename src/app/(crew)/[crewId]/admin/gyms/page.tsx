"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Gym = { id: string; name: string; is_active: boolean };
type Branch = { id: string; gym_id: string; name: string; is_active: boolean };

// 암장 카탈로그 관리 (전역 공유). 아무 크루의 admin 이면 등록/미사용 설정 가능.
// 삭제 대신 "미사용"으로 숨김 — 기존 이벤트 기록은 유지되고 일정등록 드롭다운에서만 빠짐.
export default function GymCatalogPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useParams<{ crewId: string }>();
  const crewId = params?.crewId;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newGym, setNewGym] = useState("");
  const [newBranch, setNewBranch] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    // 관리 화면은 미사용 항목도 함께 표시
    const [{ data: g, error: gErr }, { data: b, error: bErr }] = await Promise.all([
      sb.from("gyms").select("id, name, is_active").order("name"),
      sb.from("gym_branches").select("id, gym_id, name, is_active").order("name"),
    ]);
    if (gErr) return setMsg(gErr.message);
    if (bErr) return setMsg(bErr.message);
    setGyms((g ?? []) as Gym[]);
    setBranches((b ?? []) as Branch[]);
  }

  useEffect(() => {
    if (!crewId) return;
    (async () => {
      const { data } = await sb.rpc("is_crew_admin", { p_crew_id: crewId });
      setAllowed(!!data);
      if (data) await load();
    })();
  }, [crewId]);

  async function run(fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg(error.message);
    await load();
  }

  const addGym = () => {
    if (!newGym.trim()) return;
    run(async () => {
      const r = await sb.rpc("admin_add_gym", { p_name: newGym.trim() });
      if (!r.error) setNewGym("");
      return r;
    });
  };

  const addBranch = (gymId: string) => {
    const name = (newBranch[gymId] ?? "").trim();
    if (!name) return;
    run(async () => {
      const r = await sb.rpc("admin_add_gym_branch", { p_gym_id: gymId, p_name: name });
      if (!r.error) setNewBranch((prev) => ({ ...prev, [gymId]: "" }));
      return r;
    });
  };

  const toggleGym = (g: Gym) =>
    run(async () => await sb.rpc("admin_set_gym_active", { p_gym_id: g.id, p_active: !g.is_active }));

  const toggleBranch = (b: Branch) =>
    run(async () => await sb.rpc("admin_set_gym_branch_active", { p_branch_id: b.id, p_active: !b.is_active }));

  if (allowed === null) return <div style={{ padding: 16 }}>로딩중...</div>;
  if (!allowed) return <div style={{ padding: 16 }}>관리자만 접근할 수 있습니다.</div>;

  return (
    <div style={{ padding: 16, paddingTop: 0, maxWidth: 760, margin: "0 auto", color: "black" }}>
      {msg && <div style={{ marginTop: 10, color: "crimson" }}>{msg}</div>}

      {/* 암장(브랜드) 추가 */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <input
          value={newGym}
          onChange={(e) => setNewGym(e.target.value)}
          placeholder="새 암장 (예: 더클라임)"
          style={{...input, width: "auto"}}
          onKeyDown={(e) => e.key === "Enter" && addGym()}
        />
        <button style={{ ...btn, fontWeight: 700 }} disabled={busy} onClick={addGym}>
          암장 추가
        </button>
      </div>

      {/* 목록 */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {gyms.map((g) => {
          const gymBranches = branches.filter((b) => b.gym_id === g.id);
          return (
            <div key={g.id} style={{ ...card, opacity: g.is_active ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {g.name}
                  {!g.is_active && <span style={badge}>미사용</span>}
                </div>
                <button style={btn} disabled={busy} onClick={() => toggleGym(g)}>
                  {g.is_active ? "미사용 처리" : "다시 사용"}
                </button>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {gymBranches.length === 0 && (
                  <span style={{ fontSize: 13, opacity: 0.6 }}>지점 없음 (단일 지점)</span>
                )}
                {gymBranches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleBranch(b)}
                    title={b.is_active ? "클릭하면 미사용 처리" : "클릭하면 다시 사용"}
                    style={{
                      ...chip,
                      cursor: "pointer",
                      opacity: b.is_active ? 1 : 0.5,
                      textDecoration: b.is_active ? "none" : "line-through",
                    }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={newBranch[g.id] ?? ""}
                  onChange={(e) =>
                    setNewBranch((prev) => ({ ...prev, [g.id]: e.target.value }))
                  }
                  placeholder="지점 추가 (예: 신림)"
                  style={{ ...input, flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && addBranch(g.id)}
                />
                <button style={btn} disabled={busy} onClick={() => addBranch(g.id)}>
                  지점 추가
                </button>
              </div>
            </div>
          );
        })}
        {gyms.length === 0 && (
          <div style={{ fontSize: 14, opacity: 0.7 }}>등록된 암장이 없습니다.</div>
        )}
      </div>

      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 14 }}>
        지점 칩을 클릭하면 미사용/사용이 토글됩니다. (취소선 = 미사용)
      </p>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  color: "black",
};
const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  color: "black",
  whiteSpace: "nowrap",
  flexShrink: 0,
};
const card: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
};
const chip: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#f1f5f9",
  fontSize: 13,
  border: "1px solid #e2e8f0",
  color: "black",
};
const badge: React.CSSProperties = {
  marginLeft: 8,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 700,
};
