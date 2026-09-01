const nav = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
];

const features = [
  {
    title: "Student Information System",
    desc: "One record per student — enrollment, class, guardians, and history — searchable in seconds instead of buried in a filing cabinet.",
    icon: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 20a8 8 0 0116 0",
  },
  {
    title: "Digital Attendance",
    desc: "Teachers mark attendance in under a minute per class. Admins see school-wide patterns before they become problems.",
    icon: "M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Gradebook & Report Cards",
    desc: "Teachers enter marks once. Averages, rankings, and report cards generate themselves — no more midnight spreadsheet math.",
    icon: "M9 17v-2a4 4 0 014-4h4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    title: "Fee Management",
    desc: "Invoicing, M-Pesa payments, and overdue alerts in one ledger. Know exactly who owes what without chasing anyone down.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2",
  },
  {
    title: "Parent Portal",
    desc: "Parents see grades, attendance, and fee balances the moment they update — not just at the end of term.",
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z",
  },
  {
    title: "Multi-School, Multi-Tenant",
    desc: "Every school gets its own isolated data, its own admins, and its own branding — one platform running underneath all of them.",
    icon: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4",
  },
];

const steps = [
  {
    step: "01",
    title: "Your school signs up",
    desc: "Get a dedicated, secure workspace in minutes — no servers, no installs.",
  },
  {
    step: "02",
    title: "Import your students & staff",
    desc: "Bring in existing records, or start fresh with guided setup.",
  },
  {
    step: "03",
    title: "Teachers & parents log in",
    desc: "Role-based access means everyone sees exactly what they need — nothing more.",
  },
  {
    step: "04",
    title: "Run the term on Aclass",
    desc: "Attendance, grades, fees, and communication — handled, tracked, and reported automatically.",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "Free",
    tagline: "For schools piloting Aclass",
    features: ["Up to 150 students", "Core SIS & attendance", "Gradebook & report cards", "Email support"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "KES 15,000/mo",
    tagline: "For schools ready to go all-in",
    features: [
      "Unlimited students",
      "Fee management + M-Pesa",
      "Parent portal & SMS alerts",
      "Analytics dashboard",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "District",
    price: "Custom",
    tagline: "For groups of schools or counties",
    features: [
      "Multiple schools, one dashboard",
      "Custom integrations",
      "Dedicated onboarding",
      "SLA-backed support",
    ],
    highlight: false,
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink bg-grid-glow">
      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-14 w-auto" />
        </div>
        <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {nav.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white sm:block"
          >
            Log in
          </a>
          <a
            href="#contact"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-ink transition hover:bg-accent2"
          >
            Book a demo
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="product" className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-16 text-center section-fade">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-accent2" />
          Piloted at Dawamu School — built for what schools actually deal with
        </div>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Run your entire school
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent"> without the chaos</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          Aclass brings attendance, grades, fees, and parent communication into one system —
          built for schools that are done juggling spreadsheets, paper files, and apps that don&apos;t talk to each other.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#contact"
            className="w-full rounded-full bg-accent px-7 py-3 text-sm font-semibold text-ink transition hover:bg-accent2 sm:w-auto"
          >
            Book a free demo
          </a>
          <a
            href="#features"
            className="w-full rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-white/80 transition hover:border-white/30 hover:text-white sm:w-auto"
          >
            See what it does
          </a>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              stat: "3+ hrs/week",
              label: "lost by teachers to manual grade & attendance admin",
            },
            {
              stat: "0 visibility",
              label: "parents have into progress between termly meetings",
            },
            {
              stat: "Unclear fees",
              label: "owed vs. paid, tracked across notebooks and spreadsheets",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 card-hover"
            >
              <div className="text-2xl font-semibold text-accent2">{item.stat}</div>
              <div className="mt-2 text-sm text-white/60">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a school runs on. One platform.
          </h2>
          <p className="mt-4 text-white/60">
            Five core modules, built from three years of watching real classrooms, real parents, and real admin
            offices deal with real problems.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 card-hover"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.6}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From sign-up to running your term</h2>
          <p className="mt-4 text-white/60">No IT department required.</p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.step} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="text-sm font-semibold text-accent2">{s.step}</div>
              <h3 className="mt-3 text-base font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-white/60">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing, built for Kenyan schools</h2>
          <p className="mt-4 text-white/60">Start free. Pay as your school grows.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pricing.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 ${
                tier.highlight
                  ? "border-accent bg-gradient-to-b from-accent/10 to-transparent"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 text-xs font-medium text-ink">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-medium">{tier.name}</h3>
              <p className="mt-1 text-sm text-white/50">{tier.tagline}</p>
              <div className="mt-6 text-3xl font-semibold">{tier.price}</div>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent2" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-8 block rounded-full px-5 py-2.5 text-center text-sm font-medium transition ${
                  tier.highlight
                    ? "bg-accent text-ink hover:bg-accent2"
                    : "border border-white/15 text-white/80 hover:border-white/30 hover:text-white"
                }`}
              >
                Get started
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-14">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to run your school on Aclass?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Tell us about your school and we&apos;ll set up a free workspace so you can try it before you commit to
            anything.
          </p>
          <a
            href="mailto:aclassschoolmanagement@gmail.com"
            className="mt-8 inline-block rounded-full bg-accent px-7 py-3 text-sm font-semibold text-ink transition hover:bg-accent2"
          >
            Book a free demo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} Aclass. Built in Kenya.</span>
          <div className="flex items-center gap-5">
            <a href="/terms" className="hover:text-white/70">Terms of Service</a>
            <a href="/privacy" className="hover:text-white/70">Privacy Policy</a>
            <span>aclassschoolmanagement@gmail.com</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
