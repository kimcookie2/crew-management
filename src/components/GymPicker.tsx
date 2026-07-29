"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Gym = { id: string; name: string };
type Branch = { id: string; gym_id: string; name: string };

type Props = {
  gymId: string | null;
  branchId: string | null;
  onChange: (next: { gymId: string | null; branchId: string | null }) => void;
};

// 암장(브랜드) → 지점 2단계 선택기.
// 카탈로그(gyms / gym_branches)에서만 선택. 새 암장은 관리자 카탈로그 페이지에서 등록.
export default function GymPicker({ gymId, branchId, onChange }: Props) {
  const sb = supabaseBrowser();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 미사용(is_active=false)은 일정등록 선택지에서 제외
      const [{ data: g, error: gErr }, { data: b, error: bErr }] = await Promise.all([
        sb.from("gyms").select("id, name").eq("is_active", true).order("name"),
        sb.from("gym_branches").select("id, gym_id, name").eq("is_active", true).order("name"),
      ]);
      if (gErr) return setMsg(gErr.message);
      if (bErr) return setMsg(bErr.message);
      setGyms((g ?? []) as Gym[]);
      setBranches((b ?? []) as Branch[]);
    })();
  }, []);

  const gymBranches = useMemo(
    () => branches.filter((b) => b.gym_id === gymId),
    [branches, gymId]
  );

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        암장
        <select
          value={gymId ?? ""}
          onChange={(e) => {
            const nextGym = e.target.value || null;
            // 암장이 바뀌면 지점 선택 초기화
            onChange({ gymId: nextGym, branchId: null });
          }}
          style={select}
        >
          <option value="">선택</option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {gymBranches.length > 0 && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          지점
          <select
            value={branchId ?? ""}
            onChange={(e) => onChange({ gymId, branchId: e.target.value || null })}
            style={select}
          >
            <option value="">선택</option>
            {gymBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {msg && <span style={{ color: "crimson", fontSize: 13 }}>{msg}</span>}
    </div>
  );
}

const select: React.CSSProperties = {
  padding: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "white",
  color: "black",
};
