import Link from "next/link";

/** Shown in place of a Growth-only page/section when a school is still on Starter. */
export default function UpgradeRequired({ feature, isAdmin }: { feature: string; isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-medium">{feature} is a Growth feature</h2>
      <p className="mt-2 max-w-md text-sm text-white/50">
        Your school is currently on the Starter plan, which doesn't include {feature.toLowerCase()}. Upgrade to
        Growth to unlock it, along with the parent portal and analytics.
      </p>
      {isAdmin ? (
        <Link
          href="/dashboard/billing"
          className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent2"
        >
          Go to Billing
        </Link>
      ) : (
        <p className="mt-4 text-sm text-white/40">Ask your school admin to upgrade from the Billing page.</p>
      )}
    </div>
  );
}
