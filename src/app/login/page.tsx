"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const sb = supabaseBrowser();
  const sp = useSearchParams();

  async function onGoogle() {
    const next = sp.get("next") ?? "/app"; // 기본은 /app
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) alert(error.message);
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto", color: "black" }}>
      <h1>로그인</h1>
      <button
        onClick={onGoogle}
        style={{ width: "100%", padding: 12, marginTop: 12, background: "white", color: "black", border: "1px solid #cbd5e1", borderRadius: 12 }}
      >
        Google로 계속하기
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "black" }}>로딩중...</div>}>
      <LoginInner />
    </Suspense>
  );
}
