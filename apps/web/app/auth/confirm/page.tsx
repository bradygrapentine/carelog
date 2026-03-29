"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase";

export default function ConfirmPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state change — fires when hash token is processed
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push(next);
      } else if (event === "TOKEN_REFRESHED") {
        router.push(next);
      }
    });

    // Also try to get session directly (in case already signed in)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push(next);
      } else {
        // Give it 3 seconds to process the hash
        setTimeout(() => setStatus("error"), 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, [next, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Sign-in link expired or already used.
          </p>
          <a href="/signin" className="text-blue-600 hover:underline">
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
