// src/app/join/page.tsx
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function JoinPage() {
  const sb = supabaseBrowser();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onJoin() {
    setMsg(null);
    const { data, error } = await sb.rpc("accept_invite", { p_code: code });
    if (error) setMsg(error.message);
    else location.href = `/${data}/dashboard`; // data = crew_id
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <h1>크루 참가</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="초대코드(UUID)"
        style={{ width: "100%", padding: 10, marginTop: 12 }}
      />
      <button onClick={onJoin} style={{ width: "100%", padding: 12, marginTop: 12 }}>
        참가하기
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
