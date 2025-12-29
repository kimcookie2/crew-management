/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type MemberRow = { id: string; display_name: string | null; status: string | null; role: string | null };
type EventRow = { id: string; event_date: string; gym_name: string | null; crew_id: string };

export default function EventEditPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useParams<{ crewId: string; eventId: string }>();
  const crewId = params?.crewId;
  const eventId = params?.eventId;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [date, setDate] = useState("");
  const [gymName, setGymName] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!crewId || !eventId) return;

    (async () => {
      setMsg(null);

      // 이벤트 로드
      const { data: ev, error: evErr } = await sb
        .from("events")
        .select("id, crew_id, event_date, gym_name")
        .eq("id", eventId)
        .single();

      if (evErr) return setMsg(evErr.message);
      if (!ev) return setMsg("이벤트를 찾을 수 없습니다.");

      if (ev.crew_id !== crewId) return setMsg("크루가 일치하지 않습니다.");
      setEvent(ev as EventRow);
      setDate((ev as any).event_date);
      setGymName((ev as any).gym_name ?? "");

      // 멤버 목록
      const { data: ms, error: msErr } = await sb
        .from("crew_memberships")
        .select("id, display_name, status, role")
        .eq("crew_id", crewId)
        .neq("status", "exited")
        .order("joined_at", { ascending: true });

      if (msErr) return setMsg(msErr.message);
      setMembers((ms ?? []) as MemberRow[]);

      // 참석자 로드
      const { data: at, error: atErr } = await sb
        .from("attendances")
        .select("membership_id")
        .eq("event_id", eventId);

      if (atErr) return setMsg(atErr.message);

      const init: Record<string, boolean> = {};
      (ms ?? []).forEach((m: any) => (init[m.id] = false));
      (at ?? []).forEach((a: any) => (init[a.membership_id] = true));
      setSelected(init);
    })();
  }, [crewId, eventId]);

  const filteredMembers = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return members;
    return members.filter((m) => (m.display_name ?? "").toLowerCase().includes(kw));
  }, [members, q]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      filteredMembers.forEach((m) => (next[m.id] = checked));
      return next;
    });
  }

  async function onSave() {
    if (!crewId || !eventId) return;
    if (!date) return setMsg("날짜를 선택해주세요.");
    if (!gymName.trim()) return setMsg("장소를 입력해주세요.");

    setLoading(true);
    setMsg(null);

    // 1) 이벤트 수정
    const { error: uErr } = await sb.rpc("update_event", {
      p_crew_id: crewId,
      p_event_id: eventId,
      p_event_date: date,
      p_gym_name: gymName.trim(),
    });

    if (uErr) {
      setLoading(false);
      return setMsg(uErr.message);
    }

    // 2) 참석자 교체
    const { error: aErr } = await sb.rpc("set_event_attendees", {
      p_crew_id: crewId,
      p_event_id: eventId,
      p_membership_ids: selectedIds,
    });

    setLoading(false);
    if (aErr) return setMsg(aErr.message);

    router.push(`/${crewId}/events`);
  }

  async function onDelete() {
    if (!crewId || !eventId) return;
    if (!confirm("이 일정을 삭제할까요? (참석 기록도 함께 삭제됨)")) return;

    setLoading(true);
    setMsg(null);

    const { error } = await sb.rpc("delete_event", {
      p_crew_id: crewId,
      p_event_id: eventId,
    });

    setLoading(false);
    if (error) return setMsg(error.message);

    router.push(`/${crewId}/events`);
  }

  if (!event) {
    return <div style={{ padding: 16 }}>{msg ?? "로딩중..."}</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto", color: "black" }}>
      <h2 style={{ marginBottom: 12 }}>일정 수정</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={label}>
          날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
        </label>

        <label style={label}>
          장소
          <input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="예: 더클라임 연남" style={input} />
        </label>
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
        <div style={{ padding: 10, background: "#f1f5f9", fontSize: 13 }}>참석자</div>
        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {filteredMembers.map((m) => {
            const isHold = (m.status ?? "active") !== "active";
            const name = `${m.role === "admin" ? "★" : ""}${m.display_name ?? "(이름없음)"}`;
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
                    onChange={(e) => setSelected((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                  />
                  <strong>{name}</strong>
                  {isHold && <span style={{ fontSize: 12, opacity: 0.8 }}>정지</span>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button style={{ ...btn, fontWeight: 800 }} disabled={loading} onClick={onSave}>
          {loading ? "저장중..." : "저장"}
        </button>
        <button style={btn} onClick={() => router.push(`/${crewId}/events`)}>취소</button>
        <button style={{ ...btn, borderColor: "#ef4444", color: "#ef4444" }} disabled={loading} onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const input: React.CSSProperties = { padding: 8, border: "1px solid #cbd5e1", borderRadius: 10 };
const btn: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" };
