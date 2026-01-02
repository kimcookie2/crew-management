/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseServer } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";
import DashboardClient from "./DashboardClient";

function fmtYMD(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y.toString().slice(2)}년 ${m}월 ${day}일`;
}
function fmtMD(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${m}월 ${day}일`;
}
function fmtBaseWithDow(yyyyMmDd: string) {
  const dt = new Date(`${yyyyMmDd}T00:00:00`);
  const w = ["일","월","화","수","목","금","토"][dt.getDay()];
  return `${yyyyMmDd}(${w})`;
}

function remainDotColor(remain: number, role: string) {
  if (role === "admin") return "#22C55E";
  if (remain <= 10) return "#EF4444";
  if (remain <= 20) return "#F59E0B";
  return "#22C55E";
}

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ crewId: string }>;
  searchParams?: Promise<{ base?: string }>;
}) {
  const { crewId } = await params;
  const sp = (await searchParams) ?? {};

  // ✅ 기준일: URL ?base=YYYY-MM-DD 없으면 오늘
  const baseDate = sp.base && /^\d{4}-\d{2}-\d{2}$/.test(sp.base)
    ? sp.base
    : new Date().toISOString().slice(0, 10);

  const sb = supabaseServer();

  // ✅ 기준월 라벨은 기준일 기준으로 잡기
  const baseDt = new Date(`${baseDate}T00:00:00`);
  const monthStart = new Date(baseDt.getFullYear(), baseDt.getMonth(), 1);
  const monthLabel = `${monthStart.getMonth() + 1}월`;
  const prevLabel = `전월`;

  // (호환용 p_month는 그냥 기준일의 월 1일로 넘김)
  const monthStr = `${baseDt.getFullYear()}-${String(baseDt.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await sb.rpc("get_crew_dashboard", {
    p_crew_id: crewId,
    p_month: monthStr,
    p_base_date: baseDate,       // ✅ 핵심
  });

  if (error) return <div style={{ padding: 16 }}>에러: {error.message}</div>;

  const { data: meta, error: metaErr } = await sb.rpc("get_crew_month_event_counts", {
    p_crew_id: crewId,
    p_base_date: baseDate,       // ✅ 핵심
  });

  if (metaErr) return <div style={{ padding: 16 }}>에러: {metaErr.message}</div>;

  const monthEvents = meta?.[0]?.month_events ?? 0;
  const prevEvents = meta?.[0]?.prev_events ?? 0;

  const rows = data ?? [];
  const title = `dashboard-${crewId}-${baseDate}`;

  return (
    <DashboardClient title={title} initialBaseDate={baseDate}>
      <div style={{ marginBottom: "10px" }}>
        <div className={styles.tableWrap}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, height: "55px" }}>
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>아득바득 클라이밍 참여 현황</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                기준일 : {fmtBaseWithDow(baseDate)}
              </div>
            </div>
            <img
              src="/logo.png"
              alt="logo"
              style={{ height: "100%", width: "auto", alignSelf: "stretch", objectFit: "contain", display: "block" }}
            />
          </div>

          <table className={styles.crewTable}>
            <thead>
              <tr style={{ background: "#002060", color: "white" }}>
                <th rowSpan={2} style={{...th, width: "1%"}}>구분</th>
                <th rowSpan={2} style={{...th, width: "10%"}}>닉네임</th>
                <th rowSpan={2} style={{...th, width: "12%"}}>입장 일자</th>
                <th rowSpan={2} style={{...th, width: "10%"}}>최근 참여 일자</th>
                <th rowSpan={2} style={{...th, width: "10%"}}>남은 활동<br/>유지 기간</th>
                <th rowSpan={2} style={{...th, width: "6%"}}>총 참여<br/>횟수</th>
                <th rowSpan={2} style={{...th, width: "6%"}}>참여<br/>순위</th>
                <th style={{...th, width: "8%"}}>{monthLabel}</th>
                <th style={{...th, width: "8%"}}>{prevLabel}</th>
                <th rowSpan={2} style={th}>비고</th>
              </tr>
              <tr style={{ background: "#002060", color: "white" }}>
                <th style={thSub}>{monthEvents}회</th>
                <th style={thSub}>{prevEvents}회</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r: any, idx: number) => {
                const isHold = r.status && r.status !== "active";
                let remainNum = typeof r.remain_days === "number" ? r.remain_days : 0;
                if (r.role === "admin") remainNum = 40;

                const bg = isHold ? "#E7E6E6" : idx % 2 === 0 ? "#DDEBF7" : "white";

                return (
                  <tr key={r.membership_id} style={{ background: bg, borderTop: "1px solid #d7dbe3", color: "black" }}>
                    <td style={tdCenter}>{idx + 1}</td>
                    <td style={tdCenter}>
                      <span style={{ color: idx === 0 ? "blue" : "#FF00FF"}}>{r.role === "admin" ? "★" : ""}</span>
                      {r.display_name}
                    </td>
                    <td style={tdCenter}>{fmtYMD(r.joined_at)}</td>

                    {/* ✅ 기준일 기준으로 last_attended_date가 이미 계산됨 */}
                    <td style={tdCenter}>{fmtMD(r.last_attended_date)}</td>

                    <td style={{...tdCenter, paddingLeft: 0, paddingRight: 0}}>
                      <div style={{ 
                        position: "relative", 
                        paddingLeft: 16, width: "100%", 
                        display: "flex", 
                        justifyContent: "center", 
                        alignItems: "center" 
                      }}>
                        {!isHold && (
                          <span
                            style={{
                              position: "absolute",
                              left: 5,
                              top: "8px",
                              transform: "translateY(-50%)",
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              background: remainDotColor(remainNum, r.role),
                            }}
                          />
                        )}
                      </div>
                      <span>{isHold ? "정지" : String(remainNum)}</span>
                    </td>
                    <td style={{...tdCenter, fontWeight: "bold"}}>{r.total_attendances ?? 0}</td>
                    <td style={tdCenter}>{r.total_rank ?? ""}</td>
                    <td style={tdCenter}>{r.month_count ?? 0}</td>
                    <td style={tdCenter}>{r.prev_count ?? 0}</td>

                    {/* ✅ 정지 사유(note) 표시 */}
                    <td style={tdCenter}>{r.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardClient>
  );
}

const th: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 13,
  fontWeight: 700,
  borderRight: "1px solid black",
  textAlign: "center",
  whiteSpace: "nowrap",
};
const thSub: React.CSSProperties = { ...th, fontWeight: 600, padding: "6px 8px" };
const tdCenter: React.CSSProperties = { padding: "8px 8px", fontSize: 13, textAlign: "center", whiteSpace: "nowrap" };
