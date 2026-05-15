"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: "active" | "hold" | string;
  note: string | null;
  joined_at: string | null;
};

type ModalMode = "add" | "hold" | "leave" | "kick" | "drop" | "inactive" | "restore" | "note";

type ModalState =
  | { open: false }
  | {
      open: true;
      mode: ModalMode;
      target?: Row;
      date: string;
      nickname: string;
      reason: string;
    };

const todayYmd = () => new Date().toISOString().slice(0, 10);

function statusLabel(s: string) {
  if (s === "hold") return "정지";
  if (s === "active") return "활동";
  if (s === "inactive") return "임시퇴장";
  if (s === "left") return "탈퇴";
  if (s === "kicked") return "추방";
  if (s === "dropped") return "이탈";
  return s;
}

function modeLabel(m: ModalMode) {
  if (m === "add") return "크루원 추가";
  if (m === "hold") return "정지";
  if (m === "leave") return "탈퇴";
  if (m === "kick") return "추방";
  if (m === "drop") return "이탈";
  if (m === "inactive") return "임시퇴장";
  if (m === "note") return "비고 수정";
  return "복귀";
}

export default function CrewManagementClient({
  crewId,
  initialRows,
}: {
  crewId: string;
  initialRows: Row[];
}) {
  const sb = supabaseBrowser();

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (r.display_name ?? "").toLowerCase().includes(t));
  }, [rows, q]);

  async function refresh() {
    const { data, error } = await sb.rpc("get_crew_members_admin", { p_crew_id: crewId });
    if (error) return alert(error.message);
    setRows((data ?? []) as Row[]);
  }

  function openAdd() {
    setModal({
      open: true,
      mode: "add",
      date: todayYmd(),
      nickname: "",
      reason: "",
    });
  }

  function openAction(mode: Exclude<ModalMode, "add">, target: Row) {
    setModal({
      open: true,
      mode,
      target,
      date: todayYmd(),
      nickname: "",
      reason: "",
    });
  }

  function openNote(target: Row) {
    setModal({
      open: true,
      mode: "note",
      target,
      date: todayYmd(),
      nickname: "",
      reason: target.note ?? "",
    });
  }

  async function confirmModal() {
    if (!modal.open) return;

    setBusy(true);
    try {
      if (modal.mode === "add") {
        const name = modal.nickname.trim();
        if (!name) {
          alert("닉네임을 입력해주세요.");
          return;
        }

        const { error } = await sb.rpc("admin_add_member", {
          p_crew_id: crewId,
          p_display_name: name,
          p_joined_at: modal.date || null,
          p_note: modal.reason.trim() || null,
          p_role: "member",
        });
        if (error) return alert(error.message);
      }

      if (modal.mode === "hold") {
        const target = modal.target!;
        const { error } = await sb.rpc("set_member_status", {
          p_membership_id: target.membership_id,
          p_status: "hold",
          p_reason: modal.reason.trim() || null,
          p_action_date: modal.date || null,
        });
        if (error) return alert(error.message);
      }

      if (modal.mode === "inactive") {
        const target = modal.target!;
        const { error } = await sb.rpc("set_member_inactive", {
          p_membership_id: target.membership_id,
          p_reason: modal.reason.trim() || null,
          p_effective_date: modal.date || null,
        });
        if (error) return alert(error.message);
      }

      if (modal.mode === "restore") {
        const target = modal.target!;
        const { error } = await sb.rpc("restore_member_active", {
          p_membership_id: target.membership_id,
          p_reason: modal.reason.trim() || null,
          p_effective_date: modal.date || null,
        });
        if (error) return alert(error.message);
      }

      if (modal.mode === "note") {
        const target = modal.target!;
        const { error } = await sb.rpc("update_member_note", {
          p_membership_id: target.membership_id,
          p_note: modal.reason.trim() || null,
        });
        if (error) return alert(error.message);
      }

      if (modal.mode === "leave" || modal.mode === "kick" || modal.mode === "drop") {
        const target = modal.target!;
        const { error } = await sb.rpc("remove_member_with_log", {
          p_membership_id: target.membership_id,
          p_exit_type: modal.mode,
          p_reason: modal.reason.trim() || null,
          p_exit_date: modal.date || null,
        });
        if (error) return alert(error.message);
      }

      setModal({ open: false });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unhold(r: Row) {
    if (!confirm("정지를 해제할까요?")) return;
    setBusy(true);

    const { error } = await sb.rpc("set_member_status", {
      p_membership_id: r.membership_id,
      p_status: "active",
      p_reason: null,
      p_action_date: todayYmd(),
    });

    setBusy(false);
    if (error) return alert(error.message);
    await refresh();
  }

  return (
    <div style={{ padding: 16, color: "black" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>크루원 관리</h2>
        <div style={{ flex: 1 }} />
        <Link
          href={`/${crewId}/crew-hidden`}
          style={{ ...btn, textDecoration: "none", display: "inline-block" }}
        >
          임시퇴장 관리
        </Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
        />
        <button onClick={openAdd} disabled={busy} style={btn}>
          + 추가
        </button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.map((r) => {
          const isHold = r.status === "hold";

          return (
            <div
              key={r.membership_id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 12,
                background: isHold ? "#FEF3C7" : "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {r.role === "admin" ? "★" : ""}
                  {r.display_name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{statusLabel(r.status)}</div>
              </div>

              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                입장: {r.joined_at ?? "-"} · 권한: {r.role ?? "member"}
              </div>

              {r.note && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  비고: {r.note}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button style={btn} disabled={busy} onClick={() => openNote(r)}>
                  비고 수정
                </button>

                {!isHold ? (
                  <button style={btnWarn} disabled={busy} onClick={() => openAction("hold", r)}>
                    정지
                  </button>
                ) : (
                  <button style={btn} disabled={busy} onClick={() => unhold(r)}>
                    정지 해제
                  </button>
                )}

                <button style={btn} disabled={busy} onClick={() => openAction("inactive", r)}>
                  임시퇴장
                </button>

                <button style={btn} disabled={busy} onClick={() => openAction("leave", r)}>
                  탈퇴
                </button>

                <button style={btnDanger} disabled={busy} onClick={() => openAction("kick", r)}>
                  추방
                </button>

                <button style={btn} disabled={busy} onClick={() => openAction("drop", r)}>
                  이탈
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal.open && (
        <ActionModal
          modal={modal}
          busy={busy}
          setModal={setModal}
          onClose={() => setModal({ open: false })}
          onConfirm={confirmModal}
        />
      )}
    </div>
  );
}

function ActionModal({
  modal,
  busy,
  setModal,
  onClose,
  onConfirm,
}: {
  modal: Extract<ModalState, { open: true }>;
  busy: boolean;
  setModal: React.Dispatch<React.SetStateAction<ModalState>>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isAdd = modal.mode === "add";
  const isNote = modal.mode === "note";
  const title = modeLabel(modal.mode);

  return (
    <div style={backdrop} onClick={onClose} role="presentation">
      <div style={modalBox} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={xBtn} disabled={busy}>
            닫기
          </button>
        </div>

        {!isAdd && modal.target && (
          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.85 }}>
            대상: <strong>{modal.target.display_name}</strong>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {isAdd && (
            <label style={label}>
              닉네임
              <input
                value={modal.nickname}
                onChange={(e) =>
                  setModal((prev) => (prev.open ? { ...prev, nickname: e.target.value } : prev))
                }
                style={input}
                placeholder="예: 시우"
              />
            </label>
          )}

          {!isNote && (
            <label style={label}>
              {isAdd ? "입장일" : "처리일"}
              <input
                type="date"
                value={modal.date}
                onChange={(e) =>
                  setModal((prev) => (prev.open ? { ...prev, date: e.target.value } : prev))
                }
                style={input}
              />
            </label>
          )}

          <label style={label}>
            {isNote ? "비고" : "사유(선택)"}
            <textarea
              value={modal.reason}
              onChange={(e) =>
                setModal((prev) => (prev.open ? { ...prev, reason: e.target.value } : prev))
              }
              style={{ ...input, minHeight: 84, resize: "vertical" }}
              placeholder={isNote ? "비고 내용 입력" : "비워도 됩니다"}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btnFull} disabled={busy}>
            취소
          </button>
          <button onClick={onConfirm} style={btnPrimary} disabled={busy}>
            {busy ? "저장중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  color: "black",
};

const btnWarn: React.CSSProperties = {
  ...btn,
  borderColor: "#f59e0b",
};

const btnDanger: React.CSSProperties = {
  ...btn,
  borderColor: "#ef4444",
};

const btnFull: React.CSSProperties = {
  flex: 1,
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  color: "black",
};

const btnPrimary: React.CSSProperties = {
  ...btnFull,
  background: "#111827",
  color: "white",
  borderColor: "#111827",
};

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
  padding: 16,
};

const modalBox: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "white",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  padding: 14,
  boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  color: "black",
};

const xBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  color: "black",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 800,
  fontSize: 13,
};

const input: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
};