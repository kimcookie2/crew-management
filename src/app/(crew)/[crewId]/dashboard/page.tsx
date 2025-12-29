/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseServer } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";


function fmtYMD(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${day}일`;
}

function fmtMD(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${m}월 ${day}일`;
}

export default async function Dashboard({
  params,
}: {
  params: Promise<{ crewId: string }>;
}) {
  const { crewId } = await params;

  const sb = supabaseServer();

  // 기준월: "이번달" 기준으로 표에 '12월 / 전월' 같은 식으로 보여줌
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1~12
  const monthStr = `${y}-${String(m).padStart(2, "0")}-01`; 
  const monthStart = new Date(`${monthStr}T00:00:00`);


  const { data, error } = await sb.rpc("get_crew_dashboard", {
    p_crew_id: crewId,
    p_month: monthStr,
  });

  if (error) return <div style={{ padding: 16 }}>에러: {error.message}</div>;
  
  const { data: meta, error: metaErr } = await sb.rpc("get_crew_month_event_counts", {
    p_crew_id: crewId,
    p_month: monthStr,
  });

  if (metaErr) return <div style={{ padding: 16 }}>에러: {metaErr.message}</div>;

  const monthEvents = meta?.[0]?.month_events ?? 0;
  const prevEvents = meta?.[0]?.prev_events ?? 0;

  const rows = data ?? [];
  const monthLabel = `${monthStart.getMonth() + 1}월`;
  const prev = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const prevLabel = `전월`;
  
  const monthTotal = rows.reduce((s: number, r: any) => s + (r.month_count ?? 0), 0);
  const prevTotal = rows.reduce((s: number, r: any) => s + (r.prev_count ?? 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <div className={styles.tableWrap}>
        <table className={styles.crewTable}>
          <thead>
            <tr style={{ background: "#0b4aa2", color: "white" }}>
              <th rowSpan={2} style={th}>구분</th>
              <th rowSpan={2} style={th}>닉네임</th>
              <th rowSpan={2} style={th}>입장 일자</th>
              <th rowSpan={2} style={th}>최근 참여 일자</th>
              <th rowSpan={2} style={th}>남은 활동 유지 기간</th>
              <th rowSpan={2} style={th}>총 참여횟수</th>
              <th rowSpan={2} style={th}>참여 순위</th>
              <th style={th}>{monthLabel}</th>
              <th style={th}>{prevLabel}</th>
              <th rowSpan={2} style={th}>비고</th>
            </tr>
            <tr style={{ background: "#0b4aa2", color: "white" }}>
              <th style={thSub}>{monthEvents}회</th>
              <th style={thSub}>{prevEvents}회</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r:any, idx:number) => {
              const isHold = r.status && r.status !== "active";
              const remain = isHold ? "정지" : (r.remain_days ?? "").toString();

              const bg = isHold ? "#e5e7eb" : idx % 2 === 0 ? "#eaf2ff" : "white";

              return (
                <tr
                  key={r.membership_id}
                  style={{
                    background: bg,
                    borderTop: "1px solid #d7dbe3",
                    color: "black",
                  }}
                >
                  <td style={tdCenter}>{idx + 1}</td>
                  <td style={tdCenter}>
                    {r.role === "admin" ? "★" : ""}
                    {r.display_name}
                  </td>
                  <td style={tdCenter}>{fmtYMD(r.joined_at)}</td>
                  <td style={tdCenter}>{fmtMD(r.last_attended_date)}</td>
                  <td style={tdCenter}>{remain}</td>
                  <td style={tdCenter}>{r.total_attendances ?? 0}</td>
                  <td style={tdCenter}>{r.total_rank ?? ""}</td>
                  <td style={tdCenter}>{r.month_count ?? 0}</td>
                  <td style={tdCenter}>{r.prev_count ?? 0}</td>
                  <td style={tdLeft}>{r.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    
  );
}

const th: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 13,
  fontWeight: 700,
  borderRight: "1px solid rgba(255,255,255,0.25)",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const thSub: React.CSSProperties = {
  ...th,
  fontWeight: 600,
  padding: "6px 8px",
};

const tdCenter: React.CSSProperties = {
  padding: "8px 8px",
  fontSize: 13,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdLeft: React.CSSProperties = {
  padding: "8px 8px",
  fontSize: 13,
  textAlign: "left",
  whiteSpace: "nowrap",
};