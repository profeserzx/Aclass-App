import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Aclass",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ink bg-grid-glow px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-9 w-auto" />
        </Link>

        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-200">
          This is a working draft written to match how Aclass actually operates today — it is not legal advice.
          You should have a Kenyan lawyer review and customize this before relying on it for paying schools and
          real payments.
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="text-lg font-medium text-white">1. Agreement</h2>
            <p className="mt-3">
              These Terms govern use of Aclass, a school management platform ("Services") operated by Aclass
              ("Aclass," "we," "us"). By creating a workspace, you ("Customer," typically a school) agree to these
              Terms on behalf of your organization. Individuals your school gives access to — staff, parents,
              students — are "Users" and are bound by these Terms while using the Services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">2. The Service</h2>
            <p className="mt-3">Aclass provides tools for managing students, staff, attendance, grades, discipline records, fees, payments, and communication with parents, delivered as a hosted web application. We may add, change, or remove features over time.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">3. Accounts</h2>
            <p className="mt-3">You're responsible for the accuracy of information entered into Aclass and for keeping login credentials secure. Notify us promptly if you believe an account has been compromised. Each school's data is only accessible to that school's own staff, parents, and students.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">4. Plans and billing</h2>
            <p className="mt-3">Aclass offers Starter (free, capped student count, core features only), Growth (paid monthly subscription, unlocks the parent portal, M-Pesa fee collection, SMS alerts, and analytics), and District (custom pricing for groups of schools). Current pricing is shown on our website and may change with notice.</p>
            <p className="mt-3">Growth subscriptions are billed monthly via M-Pesa. If a subscription lapses or payment isn't renewed, the school's account reverts to Starter-tier access — data isn't deleted, but Growth-only features become unavailable until payment resumes. Fees already paid are non-refundable except where required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">5. Your data</h2>
            <p className="mt-3">You own the data you enter into Aclass. You're responsible for having the right to collect and process it — including, where students are minors, obtaining any consent required from parents or guardians under your own enrollment process. Our Privacy Policy explains how we handle that data on your behalf. See our <Link href="/privacy" className="text-accent hover:text-accent2">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">6. Acceptable use</h2>
            <p className="mt-3">You agree not to: use the Services for anything unlawful; attempt to access another school's data or bypass access controls; reverse-engineer, scrape, or resell the Services without our written permission; or upload content that infringes someone else's rights or violates a student's privacy beyond what's needed for legitimate school administration.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">7. Intellectual property</h2>
            <p className="mt-3">Aclass retains all rights to the software, branding, and platform itself. You retain all rights to the data you enter. We don't claim ownership of your school's records.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">8. Termination</h2>
            <p className="mt-3">You may stop using Aclass at any time. We may suspend or terminate an account for violating these Terms or for non-payment (after reverting to Starter access first, except in cases of serious misuse). On request, we'll provide a reasonable window to export your data before deletion.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">9. Disclaimer</h2>
            <p className="mt-3">The Services are provided "as is." We work to keep Aclass reliable and secure but don't guarantee uninterrupted or error-free operation, except where a specific service-level commitment has been separately agreed (for example, under a District plan).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">10. Limitation of liability</h2>
            <p className="mt-3">To the extent permitted by law, Aclass's total liability for any claim relating to the Services is limited to the fees your school paid us in the 12 months before the claim arose. We aren't liable for indirect, incidental, or consequential damages.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">11. Changes to these Terms</h2>
            <p className="mt-3">We may update these Terms as the Services evolve. We'll post the updated version here with a new "last updated" date; continued use of Aclass after a change means you accept the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">12. Governing law</h2>
            <p className="mt-3">These Terms are governed by the laws of the Republic of Kenya, and any dispute will be subject to the exclusive jurisdiction of the courts of Kenya.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">13. Contact</h2>
            <p className="mt-3">
              Questions about these Terms:{" "}
              <a href="mailto:aclassschoolmanagement@gmail.com" className="text-accent hover:text-accent2">
                aclassschoolmanagement@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-accent hover:text-accent2">
            ← Back to Aclass
          </Link>
        </div>
      </div>
    </main>
  );
}
