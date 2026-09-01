"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/classes", label: "Classes" },
  { href: "/dashboard/attendance", label: "Attendance" },
  { href: "/dashboard/grades", label: "Grades" },
  { href: "/dashboard/discipline", label: "Discipline" },
  { href: "/dashboard/staff", label: "Staff" },
  { href: "/dashboard/subjects", label: "Subjects" },
  { href: "/dashboard/fees", label: "Fees" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/leave", label: "Leave" },
  { href: "/dashboard/email", label: "Email" },
  { href: "/dashboard/sms", label: "SMS" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/account", label: "My account" },
];

// Each role only sees the sidebar sections relevant to their job — school
// finance and staff records aren't part of the dean's or a teacher's role.
// Billing (the school's own Aclass subscription) is admin-only.
const HIDDEN_LINKS: Record<string, Set<string>> = {
  dean: new Set([
    "/dashboard/staff",
    "/dashboard/subjects",
    "/dashboard/fees",
    "/dashboard/payments",
    "/dashboard/classes",
    "/dashboard/billing",
  ]),
  teacher: new Set(["/dashboard/fees", "/dashboard/payments", "/dashboard/classes", "/dashboard/billing"]),
};

export default function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();
  const hidden = HIDDEN_LINKS[role];
  const visibleLinks = hidden ? links.filter((l) => !hidden.has(l.href)) : links;

  return (
    <nav className="flex flex-col gap-1">
      {visibleLinks.map((link) => {
        const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-4 py-2.5 text-sm transition ${
              active
                ? "bg-accent/15 font-medium text-accent2"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
