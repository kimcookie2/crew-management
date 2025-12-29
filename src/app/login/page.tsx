"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const sb = supabaseBrowser();

  async function onGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`, // 우리 앱으로 돌아오는 곳
      },
    });
    if (error) alert(error.message);
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
      <h1>로그인</h1>
      <button onClick={onGoogle} style={{ width: "100%", padding: 12, marginTop: 12 }}>
        Google로 계속하기
      </button>
    </div>
  );
}
