import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // eslint-disable-next-line prefer-const
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 중요: 이 호출이 세션을 갱신하고 쿠키를 세팅해줌
  await supabase.auth.getUser();

  return response;
}

// 정적파일 등 제외
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
