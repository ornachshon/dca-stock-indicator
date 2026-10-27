import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        await supabase.from("login_emails").upsert(
          {
            email: user.email.toLowerCase(),
            provider: user.app_metadata?.provider ?? "google",
            last_login_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
