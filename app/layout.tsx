import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Aclass — School Management, Reimagined",
  description:
    "Aclass is the all-in-one school management platform built for Kenyan schools — attendance, grades, fees, and parent communication in one place.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/aclass-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon-192.png",
  },
  openGraph: {
    title: "Aclass — School Management, Reimagined",
    description:
      "Aclass is the all-in-one school management platform built for Kenyan schools — attendance, grades, fees, and parent communication in one place.",
    images: ["/aclass-full.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
