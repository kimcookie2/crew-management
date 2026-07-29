"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import * as htmlToImage from "html-to-image";

type TotalRow = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: string | null;
  total_attendances: number;
  total_rank: number;
};

type MonthRow = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: string | null;
  month_count: number;
  month_rank: number;
  prev_count: number;
  prev_rank: number | null;
  rank_delta: number | null;
};

type GymStatRow = {
  gym_id: string;
  gym_name: string;
  branch_id: string | null;
  branch_name: string | null;
  event_count: number;
  attendee_count: number;
};

type Tab = "total" | "month" | "gym";

function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 암장 통계 집계 시작일(모임에 암장을 기록하기 시작한 날)
const GYM_DATA_START = "2025-11-21";
function toDot(ymd: string) {
  return ymd.split("-").join("."); // YYYY-MM-DD → YYYY.MM.dd
}
function monthStartFromYm(ym: string) {
  // ym: "2026-01"
  return `${ym}-01`;
}
function fmtYM(monthStart: string) {
  const d = new Date(`${monthStart}T00:00:00`);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export default function StatsClient({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();

  const [tab, setTab] = useState<Tab>("total");

  // ✅ 기준일(컷) - 대시보드랑 통일
  const [asof, setAsof] = useState(ymdToday());

  // ✅ 월 선택(월 탭에서만)
  const [ym, setYm] = useState(() => ymdToday().slice(0, 7)); // "YYYY-MM"

  const [totalRows, setTotalRows] = useState<TotalRow[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);

  // ✅ 암장 통계 (기간 필터)
  const [gymRows, setGymRows] = useState<GymStatRow[]>([]);
  const [from, setFrom] = useState(""); // "" = 전체 범위
  const [to, setTo] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [years, setYears] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const monthStart = useMemo(() => monthStartFromYm(ym), [ym]);

  // ✅ 캡처용 ref
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  async function loadTotal() {
    setLoading(true);
    setErr(null);
    const { data, error } = await sb.rpc("get_crew_stats_total_rank", {
      p_crew_id: crewId,
      p_asof: asof,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setTotalRows((data ?? []) as TotalRow[]);
  }

  async function loadMonth() {
    setLoading(true);
    setErr(null);
    const { data, error } = await sb.rpc("get_crew_stats_month_rank", {
      p_crew_id: crewId,
      p_month: monthStart,
      p_asof: asof,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setMonthRows((data ?? []) as MonthRow[]);
  }

  async function loadGym() {
    setLoading(true);
    setErr(null);
    const { data, error } = await sb.rpc("get_crew_gym_stats", {
      p_crew_id: crewId,
      p_from: from || null,
      p_to: to || null,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setGymRows((data ?? []) as GymStatRow[]);
  }

  // 기간 빠른선택 / 연·월 선택 → from·to 세팅
  function applyAll() {
    setFrom("");
    setTo("");
    setYear("");
    setMonth("");
  }
  function applyRecentMonths(n: number) {
    const t = new Date();
    const f = new Date();
    f.setMonth(f.getMonth() - n);
    setFrom(ymdLocal(f));
    setTo(ymdLocal(t));
    setYear("");
    setMonth("");
  }
  function applyYearMonth(y: string, m: string) {
    setYear(y);
    setMonth(m);
    if (!y) {
      setFrom("");
      setTo("");
      return;
    }
    if (m) {
      const mm = Number(m);
      const last = new Date(Number(y), mm, 0).getDate();
      setFrom(`${y}-${String(mm).padStart(2, "0")}-01`);
      setTo(`${y}-${String(mm).padStart(2, "0")}-${String(last).padStart(2, "0")}`);
    } else {
      setFrom(`${y}-01-01`);
      setTo(`${y}-12-31`);
    }
  }
  function branchLabel(gymName: string, branchName: string | null) {
    return branchName ? `${gymName} ${branchName}` : gymName;
  }

  // 브랜드+지점별 Top10 (RPC 가 이미 정렬) / 브랜드별 Top10 (gym_id 합산)
  const branchTop10 = useMemo(() => gymRows.slice(0, 10), [gymRows]);
  const brandTop10 = useMemo(() => {
    const map = new Map<
      string,
      { gym_id: string; gym_name: string; event_count: number; attendee_count: number }
    >();
    for (const r of gymRows) {
      const cur =
        map.get(r.gym_id) ??
        { gym_id: r.gym_id, gym_name: r.gym_name, event_count: 0, attendee_count: 0 };
      cur.event_count += r.event_count;
      cur.attendee_count += r.attendee_count;
      map.set(r.gym_id, cur);
    }
    return [...map.values()]
      .sort((a, b) => b.event_count - a.event_count || b.attendee_count - a.attendee_count)
      .slice(0, 10);
  }, [gymRows]);

  // 연도 선택지: 가장 오래된 이벤트 연도 ~ 올해
  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("events")
        .select("event_date")
        .eq("crew_id", crewId)
        .not("gym_id", "is", null)
        .order("event_date", { ascending: true })
        .limit(1);
      const cy = new Date().getFullYear();
      const sy = data?.[0]?.event_date ? Number(String(data[0].event_date).slice(0, 4)) : cy;
      const list: number[] = [];
      for (let y = cy; y >= sy; y--) list.push(y);
      setYears(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

  function rankDeltaLabel(prevRank: number | null, delta: number | null) {
    if (prevRank == null) return { text: "-", color: "#6B7280" }; // 회색
    if (delta == null || delta === 0) return { text: "-", color: "#6B7280" };
    if (delta > 0) return { text: `▲${delta}`, color: "#EF4444" }; // 상승=빨강
    return { text: `▼${Math.abs(delta)}`, color: "#3B82F6" }; // 하락=파랑
  }

  // 탭/기준일/월 변경에 따라 로드
  useEffect(() => {
    if (tab === "total") loadTotal();
    else if (tab === "month") loadMonth();
    else loadGym();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, asof, monthStart, from, to, crewId]);

  // ✅ 내보내기
  async function onExport() {
    if (!scrollBoxRef.current || !captureRef.current) return;

    setBusy(true);

    const scrollBox = scrollBoxRef.current;
    const el = captureRef.current;

    const prevBox = {
      overflow: scrollBox.style.overflow,
      overflowX: scrollBox.style.overflowX,
      overflowY: scrollBox.style.overflowY,
      maxHeight: scrollBox.style.maxHeight,
      height: scrollBox.style.height,
      width: scrollBox.style.width,
    };

    const prevEl = {
      width: el.style.width,
      minWidth: el.style.minWidth,
      maxWidth: el.style.maxWidth,
      padding: el.style.padding,
      boxSizing: el.style.boxSizing,
    };

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      // 스크롤 제한 풀기
      scrollBox.style.overflow = "visible";
      scrollBox.style.overflowX = "visible";
      scrollBox.style.overflowY = "visible";
      scrollBox.style.maxHeight = "none";
      scrollBox.style.height = "auto";

      // 레이아웃 반영
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const SIDE_PAD = 20; // 내보내기 이미지 좌우 여백
      const fullW = scrollBox.scrollWidth + SIDE_PAD * 2 + 10;
      const fullH = scrollBox.scrollHeight + 10;

      // 캡처 DOM을 강제로 전체 폭으로 (+ 좌우 여백)
      el.style.boxSizing = "border-box";
      el.style.padding = `10px ${SIDE_PAD}px`;
      el.style.maxWidth = "none";
      el.style.width = `${fullW}px`;
      el.style.minWidth = `${fullW}px`;

      const MAX = 16000;
      const pr = Math.min(2, MAX / fullW, MAX / fullH);

      const dataUrl = await htmlToImage.toPng(el, {
        cacheBust: true,
        pixelRatio: pr,
        backgroundColor: "white",
        width: fullW,
        height: fullH,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      const title =
        tab === "total"
          ? `stats-total-${crewId}-${asof}`
          : tab === "month"
          ? `stats-month-${crewId}-${monthStart}-${asof}`
          : `stats-gym-${crewId}-${from || "all"}_${to || "all"}`;

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title}.png`;
      a.click();
    } catch (e: any) {
      alert(e?.message ?? "내보내기에 실패했습니다.");
    } finally {
      // 원복
      scrollBox.style.overflow = prevBox.overflow;
      scrollBox.style.overflowX = prevBox.overflowX;
      scrollBox.style.overflowY = prevBox.overflowY;
      scrollBox.style.maxHeight = prevBox.maxHeight;
      scrollBox.style.height = prevBox.height;
      scrollBox.style.width = prevBox.width;

      el.style.width = prevEl.width;
      el.style.minWidth = prevEl.minWidth;
      el.style.maxWidth = prevEl.maxWidth;
      el.style.padding = prevEl.padding;
      el.style.boxSizing = prevEl.boxSizing;

      setBusy(false);
    }
  }

  return (
    <div style={{ color: "black" }}>
      {/* ✅ 상단 컨트롤 + 내보내기 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTab("total")}
            style={{ ...tabBtn, ...(tab === "total" ? tabBtnOn : tabBtnOff) }}
          >
            전체
          </button>
          <button
            onClick={() => setTab("month")}
            style={{ ...tabBtn, ...(tab === "month" ? tabBtnOn : tabBtnOff) }}
          >
            월별
          </button>
          <button
            onClick={() => setTab("gym")}
            style={{ ...tabBtn, ...(tab === "gym" ? tabBtnOn : tabBtnOff) }}
          >
            암장 통계
          </button>
        </div>

      </div>

      {tab === "month" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            padding: "0 16px",
          }}
        >
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            style={input}
          />
        </div>
      )}

      {tab === "gym" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            padding: "0 16px",
          }}
        >
          <button style={rangeBtn} onClick={applyAll}>전체</button>
          <button style={rangeBtn} onClick={() => applyRecentMonths(1)}>최근 1달</button>
          <button style={rangeBtn} onClick={() => applyRecentMonths(3)}>최근 3달</button>
          <button style={rangeBtn} onClick={() => applyRecentMonths(12)}>최근 1년</button>

          <select value={year} onChange={(e) => applyYearMonth(e.target.value, month)} style={input}>
            <option value="">연도</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => applyYearMonth(year, e.target.value)}
            style={input}
            disabled={!year}
          >
            <option value="">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m).padStart(2, "0")}>{m}월</option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          justifyContent: "end",
          padding: "0 16px",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center"}}>
          <button
            onClick={onExport}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
              color: "black",
            }}
          >
            {busy ? "내보내는 중..." : "내보내기"}
          </button>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 10, padding: "0 16px" }}>{err}</div>}

      {/* ✅ 스크롤 래퍼 + 캡처 대상 */}
      <div
        ref={scrollBoxRef}
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "auto",
          background: "white",
          padding: "0 16px",
        }}
      >
        <div ref={captureRef} style={{ background: "white", color: "black", padding: "10px 0" }}>
          <div style={{ position: "relative" }}>
            {loading && (
              <div style={overlay}>
                <div style={spinnerBox}>
                  <div style={spinner} />
                  <div style={{ fontSize: 12, marginTop: 8, fontWeight: 800 }}>불러오는 중...</div>
                </div>
              </div>
            )}

            {tab === "total" && (
              <div style={card}>
                <div style={cardTitle}>전체 활동참여 기준 순위</div>
                <table style={table}>
                  <thead>
                    <tr style={theadTr}>
                      <th style={th}>순위</th>
                      <th style={th}>닉네임</th>
                      <th style={th}>총 참여</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalRows.map((r) => {
                      const isHold = r.status && r.status !== "active";
                      return (
                        <tr key={r.membership_id} style={{ background: isHold ? "white" : "white" }}>
                          <td style={tdCenter}>{r.total_rank}</td>
                          <td style={tdCenter}>
                            <span style={{ color: "#FF00FF" }}>{r.role === "admin" ? "★" : ""}</span>
                            {r.display_name}
                          </td>
                          <td style={tdCenter}>{r.total_attendances ?? 0}</td>
                        </tr>
                      );
                    })}
                    {totalRows.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>
                          데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "month" && (
              <div style={card}>
                <div style={cardTitle}>월별 참여 순위 · {fmtYM(monthStart)}</div>
                <table style={table}>
                  <thead>
                    <tr style={theadTr}>
                      <th style={th}>순위</th>
                      <th style={th}>닉네임</th>
                      <th style={th}>이번달</th>
                      <th style={th}>전월</th>
                      <th style={th}>변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((r) => {
                      const isHold = r.status && r.status !== "active";
                      const mv = rankDeltaLabel(r.prev_rank, r.rank_delta);

                      return (
                        <tr key={r.membership_id} style={{ background: isHold ? "white" : "white" }}>
                          <td style={tdCenter}>{r.month_rank}</td>
                          <td style={tdCenter}>
                            <span style={{ color: "#FF00FF" }}>{r.role === "admin" ? "★" : ""}</span>
                            {r.display_name}
                          </td>
                          <td style={tdCenter}>{r.month_count ?? 0}</td>
                          <td style={tdCenter}>{r.prev_count ?? 0}</td>
                          <td style={{ ...tdCenter, fontWeight: 900, color: mv.color }}>{mv.text}</td>
                        </tr>
                      );
                    })}
                    {monthRows.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>
                          데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "gym" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={card}>
                  <div style={cardTitle}>브랜드+지점별 순위 (Top 10)</div>
                  <table style={table}>
                    <thead>
                      <tr style={theadTr}>
                        <th style={th}>순위</th>
                        <th style={th}>암장</th>
                        <th style={th}>모임 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchTop10.map((r, i) => (
                        <tr key={`${r.gym_id}-${r.branch_id ?? "none"}`}>
                          <td style={tdCenter}>{i + 1}</td>
                          <td style={tdCenter}>{branchLabel(r.gym_name, r.branch_name)}</td>
                          <td style={tdCenter}>{r.event_count}</td>
                        </tr>
                      ))}
                      {branchTop10.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>
                            데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={card}>
                  <div style={cardTitle}>브랜드별 순위 (Top 10)</div>
                  <table style={table}>
                    <thead>
                      <tr style={theadTr}>
                        <th style={th}>순위</th>
                        <th style={th}>브랜드</th>
                        <th style={th}>모임 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandTop10.map((r, i) => (
                        <tr key={r.gym_id}>
                          <td style={tdCenter}>{i + 1}</td>
                          <td style={tdCenter}>{r.gym_name}</td>
                          <td style={tdCenter}>{r.event_count}</td>
                        </tr>
                      ))}
                      {brandTop10.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>
                            데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, marginTop: 10, color: "black", opacity: 0.9 }}>
              {tab === "gym" ? (
                <>
                  <div>※ 2025.11.21 이후 생성된 모임에서 집계된 데이터입니다.</div>
                  <div>
                    ※ 집계 기간 : {toDot(from || GYM_DATA_START)} ~ {toDot(to || ymdLocal(new Date()))}
                  </div>
                </>
              ) : (
                "※ 통계는 2인 이상 참여한 이벤트만, 하루 1회 인정 기준으로 집계됩니다."
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ spinner keyframes (프로젝트에 글로벌로 없으면 추가 필요) */}
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/* styles */
const tabBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  fontWeight: 900,
  cursor: "pointer",
};
const tabBtnOn: React.CSSProperties = { background: "#111827", color: "white", borderColor: "#111827" };
const tabBtnOff: React.CSSProperties = { background: "white", color: "black" };

const rangeBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "black",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const input: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "black",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const theadTr: React.CSSProperties = {
  background: "#002060",
  color: "white",
};

const th: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "center",
  borderRight: "1px solid black",
  whiteSpace: "nowrap",
};

const tdCenter: React.CSSProperties = {
  padding: "8px 8px",
  textAlign: "center",
  borderTop: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  color: "black",
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(255,255,255,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  zIndex: 20,
};

const spinnerBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid #e5e7eb",
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "3px solid #cbd5e1",
  borderTopColor: "#111827",
  animation: "spin 0.9s linear infinite",
};
