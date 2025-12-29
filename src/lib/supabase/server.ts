import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        // setAll(cookiesToSet) {
        //   try {
        //     cookiesToSet.forEach(async ({ name, value, options }) =>
        //       (await cookieStore).set(name, value, options)
        //     );
        //   } catch {
        //     // Server Components에서 set이 막힐 수 있음 (미들웨어에서 갱신)
        //   }
        // },
      },
    }
  );
}
