import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "The confirmation link is incomplete or invalid.",
        )}`,
        request.url,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "That confirmation link is invalid or expired. Request a fresh confirmation email and try again.",
        )}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
