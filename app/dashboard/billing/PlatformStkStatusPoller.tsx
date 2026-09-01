"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlatformStkStatusAction } from "@/app/actions/billing";

type Status = "pending" | "success" | "failed" | "cancelled";

const MESSAGES: Record<Status, string> = {
  pending: "Check your phone and enter your M-Pesa PIN to complete the payment…",
  success: "Payment received — your plan has been upgraded.",
  failed: "The payment didn't go through.",
  cancelled: "The payment prompt was cancelled or timed out.",
};

const STYLES: Record<Status, string> = {
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default function PlatformStkStatusPoller({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("pending");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      const result = await getPlatformStkStatusAction(requestId);
      if (cancelled || !result) return;

      attempts += 1;
      if (result.status !== "pending") {
        setStatus(result.status as Status);
        setDetail(result.mpesaReceiptNumber ? `M-Pesa receipt: ${result.mpesaReceiptNumber}` : result.resultDesc);
        router.refresh(); // pick up the school's updated plan/subscription status
        return;
      }
      if (attempts < 40) {
        setTimeout(poll, 3000);
      } else {
        setStatus("failed");
        setDetail("This is taking too long — check your phone, or try again.");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [requestId, router]);

  return (
    <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${STYLES[status]}`}>
      <div className="font-medium">{MESSAGES[status]}</div>
      {detail && <div className="mt-1 text-xs opacity-80">{detail}</div>}
    </div>
  );
}
