"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function JoinPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();

  const [code, setCode] = useState(sp.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setMsg(null);
    if (!code.trim()) return setMsg("초대코드를 입력해주세요.");
    if (!nickname.trim()) return setMsg("닉네임을 입력해주세요.");

    setLoading(true);
    const { error } = await sb.rpc("request_join_crew", {
      p_join_code: code.trim(),
      p_nickname: nickname.trim(),
    });
    setLoading(false);

    if (error) {
      // 메시지 매핑(원하면 더 예쁘게 다듬자)
      if (error.message.includes("invalid_code")) return setMsg("초대코드가 올바르지 않습니다.");
      if (error.message.includes("nickname_not_found")) return setMsg("등록된 닉네임이 없습니다. 운영자에게 문의해주세요.");
      if (error.message.includes("already_requested")) return setMsg("이미 가입 요청을 보냈습니다. 승인 대기 중입니다.");
      if (error.message.includes("already_claimed")) return setMsg("이미 다른 계정에 연결된 닉네임입니다.");
      return setMsg(error.message);
    }

    setMsg("요청이 접수됐습니다! 운영자가 승인하면 크루 활동을 확인 할 수 있습니다.");
    // 보통은 /app로 보내고, 거기서 주기적으로 크루 목록 갱신하도록
    setTimeout(() => router.push("/app"), 600);
  }

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto", color: "black" }}>
      <h2>크루 가입 요청</h2>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <label style={label}>
          초대코드
          <input value={code} onChange={(e) => setCode(e.target.value)} style={input} />
        </label>

        <label style={label}>
          닉네임
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 시우" style={input} />
        </label>

        <button onClick={onSubmit} disabled={loading} style={btn}>
          {loading ? "요청중..." : "가입 요청 보내기"}
        </button>

        {msg && <div style={{ fontSize: 13, opacity: 0.9 }}>{msg}</div>}
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "grid", gap: 6 };
const input: React.CSSProperties = { padding: 10, border: "1px solid #cbd5e1", borderRadius: 12 };
const btn: React.CSSProperties = { padding: 12, borderRadius: 12, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontWeight: 800 };
