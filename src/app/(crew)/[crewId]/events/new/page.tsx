"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import GymPicker from "@/components/GymPicker";

type MemberRow = {
  id: string;
  display_name: string | null;
  status: string | null;
  role: string | null;
  joined_at?: string | null;
};

export default function NewEventPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useParams<{ crewId: string }>();
  const crewId = params?.crewId;

  const [date, setDate] = useState<string>(() => {
    // 로컬 YYYY-MM-DD (toISOString 쓰지 말기)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!crewId) return;

    (async () => {
      setMsg(null);
      const { data, error } = await sb
        .from("crew_memberships")
        .select("id, display_name, status, role, joined_at")
        .eq("crew_id", crewId)
        .neq("status", "exited")
        .order("joined_at", { ascending: true });

      if (error) {
        setMsg(error.message);
        return;
      }

      const rows = (data ?? []) as MemberRow[];
      setMembers(rows);

      // 기본: active만 체크 상태로 시작(원하면 전부 false로 바꿔도 됨)
      const init: Record<string, boolean> = {};
      rows.forEach((r) => {
        init[r.id] = false;
      });
      setSelected(init);
    })();
  }, [crewId]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    members.forEach((m) => {
      // 정지(hold 등)는 기본 제외하고 싶으면 여기서 조건 걸기
      next[m.id] = checked;
    });
    setSelected(next);
  }

  const filteredMembers = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return members;

    return members.filter((m) => {
      const name = (m.display_name ?? "").toLowerCase();
      return name.includes(keyword);
    });
  }, [members, q]);

  async function onSubmit() {
    if (!crewId) return;
    if (!date) return setMsg("날짜를 선택해주세요.");
    if (!gymId) return setMsg("암장을 선택해주세요.");
    if (selectedIds.length === 0) return setMsg("참석자를 최소 1명 이상 선택해주세요.");

    setLoading(true);
    setMsg(null);

    const { data, error } = await sb.rpc("create_event_and_attendances", {
      p_crew_id: crewId,
      p_event_date: date,
      p_gym_id: gymId,
      p_branch_id: branchId,
      p_membership_ids: selectedIds,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }
    
    // 모임 달력 페이지로 이동
    router.push(`/${crewId}/events`);
  }

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto", color: "black" }}>
      <h2 style={{ marginBottom: 12 }}>일정 등록</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={label}>
          날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
        </label>

        <GymPicker
          gymId={gymId}
          branchId={branchId}
          onChange={({ gymId, branchId }) => {
            setGymId(gymId);
            setBranchId(branchId);
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
        * 목록에 없는 암장은 메뉴 &gt; 암장관리에서 먼저 등록하세요.
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={label}>
          이름 검색
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임" style={input} />
        </label>

        <button style={btn} onClick={() => toggleAll(true)}>검색결과 전체선택</button>
        <button style={btn} onClick={() => toggleAll(false)}>검색결과 전체해제</button>

        <div style={{ fontSize: 13, opacity: 0.8 }}>선택: {selectedIds.length}명</div>
      </div>

      {msg && <div style={{ marginTop: 10, color: "crimson" }}>{msg}</div>}

      <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 10, background: "#f1f5f9", fontSize: 13 }}>
          멤버 목록 (체크하면 해당 날짜 참석 처리)
        </div>

        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {filteredMembers.map((m) => {
            const isHold = (m.status ?? "active") !== "active";
            const label = `${m.role === "admin" ? "★" : ""}${m.display_name ?? "(이름없음)"}`;
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderTop: "1px solid #e2e8f0",
                  background: isHold ? "#e5e7eb" : "white",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!selected[m.id]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [m.id]: e.target.checked }))
                    }
                  />
                  <strong style={{ color: "black" }}>{label}</strong>
                  {isHold && <span style={{ fontSize: 12, opacity: 0.8 }}>정지</span>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button style={{ ...btn, fontWeight: 800 }} disabled={loading} onClick={onSubmit}>
          {loading ? "저장 중..." : "등록"}
        </button>
        <button style={btn} onClick={() => router.push(`/${crewId}/events`)}>취소</button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  color: "black"
};

const label: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const input: React.CSSProperties = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 10 };

