import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Aclass",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink bg-grid-glow px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aclass-horizontal-dark.svg" alt="Aclass" className="h-9 w-auto" />
        </Link>

        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-200">
          This is a working draft written to match how Aclass actually operates today — it is not legal advice.
          Because Aclass processes personal data belonging to children, you should have a Kenyan lawyer review and
          customize this before relying on it for paying schools.
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="text-lg font-medium text-white">1. Who this policy covers</h2>
            <p className="mt-3">
              Aclass ("Aclass," "we," "us") provides school management software to schools ("Customers") in Kenya.
              This policy explains what personal data Aclass processes, why, and how it's protected. It applies to
              school staff (admins, deans, teachers), parents/guardians, and students whose information is entered
              into Aclass by a subscribing school.
            </p>
            <p className="mt-3">
              For students and other minors, the subscribing school is the primary data controller — it decides
              what student information to collect and is responsible for having the necessary parental/guardian
              consent under its own enrollment process. Aclass acts as a data processor: we process that data only
              to provide the software the school has signed up for, on the school's instructions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">2. What we collect</h2>
            <p className="mt-3">Depending on how a school uses Aclass, the following may be stored:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>School details: name, domain, tagline, subscription plan.</li>
              <li>Staff/admin accounts: name, email address, hashed password, role.</li>
              <li>Parent accounts: name, email address (or a generated login), hashed password.</li>
              <li>
                Student records: first and last name, admission number, date of birth, class/grade, guardian name,
                guardian phone number, guardian email.
              </li>
              <li>Academic records: attendance, grades, discipline case notes.</li>
              <li>
                Financial records: fee amounts, payment history, and M-Pesa transaction references (receipt
                number, amount, phone number used). Aclass never sees or stores M-Pesa PINs, card numbers, or bank
                credentials — those are handled directly by Safaricom.
              </li>
              <li>Communications: the content and delivery status of emails and SMS messages sent to guardians or staff through Aclass.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">3. How we use it</h2>
            <p className="mt-3">Data is used only to operate the service a school has signed up for: running the student information system, processing fee payments, sending email/SMS communications on the school's behalf, and billing the school itself for its Aclass subscription. We don't sell personal data, and we don't use student or guardian data for advertising.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">4. Who we share it with</h2>
            <p className="mt-3">Aclass uses a small number of service providers ("sub-processors") to operate the platform, each only receiving the data needed to perform their function:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li><span className="text-white/90">Neon</span> — hosts the database that stores all of the above.</li>
              <li><span className="text-white/90">Safaricom (Daraja/M-Pesa)</span> — processes fee and subscription payments; receives the phone number and amount for each payment.</li>
              <li><span className="text-white/90">Africa's Talking</span> — delivers SMS alerts; receives the guardian's phone number and message content for each text sent.</li>
              <li><span className="text-white/90">Google (Gmail)</span> — delivers email; receives the recipient's email address and message content for each email sent.</li>
            </ul>
            <p className="mt-3">We don't share personal data with any other third party except where required by law, or with the school's own staff acting within their role (e.g. a class teacher seeing their own students).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">5. Cookies</h2>
            <p className="mt-3">Aclass uses a single essential cookie to keep you signed in. We don't currently use advertising or third-party tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">6. Data separation between schools</h2>
            <p className="mt-3">Aclass is used by multiple schools on shared infrastructure. Every record is tagged to a specific school, and every part of the application enforces that a school's staff, parents, and students can only see that school's own data.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">7. Security</h2>
            <p className="mt-3">Passwords are never stored in plain text — they're hashed with bcrypt. Sensitive payment credentials a school configures (M-Pesa Consumer Secret and Passkey) are encrypted at rest. Password reset links are single-use, time-limited, and only the link's hash is stored. All traffic to the production site is encrypted in transit.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">8. How long we keep data</h2>
            <p className="mt-3">Data is retained for as long as a school's account is active. If a school closes its Aclass account, we delete or anonymize its data within a reasonable period afterward, except where we're required to keep records longer (for example, financial records for tax purposes).</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">9. Your rights</h2>
            <p className="mt-3">
              Under Kenya's Data Protection Act, 2019, individuals have the right to access, correct, or request
              deletion of their personal data, and to object to certain processing. Because schools control their
              own students' and staff's records, these requests are usually best directed to the school first. You
              can also contact us directly at{" "}
              <a href="mailto:aclassschoolmanagement@gmail.com" className="text-accent hover:text-accent2">
                aclassschoolmanagement@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">10. Children's data</h2>
            <p className="mt-3">Much of the information in Aclass concerns students who are minors. This data is entered by schools as part of their normal enrollment and record-keeping process, under the school's own responsibility to obtain any consent required from parents or guardians. We ask every subscribing school to only enter student data it's authorized to hold.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">11. Changes to this policy</h2>
            <p className="mt-3">We may update this policy as Aclass changes. Material changes will be noted here with an updated date at the top of the page.</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white">12. Contact</h2>
            <p className="mt-3">
              Questions about this policy or your data:{" "}
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
