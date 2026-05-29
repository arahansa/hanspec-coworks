import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { LeftNav } from "@/components/LeftNav";
import { getCurrentMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "coworks",
  description: "HanSpec 협업 워크스페이스",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const member = await getCurrentMember();

  // 로그인한 경우에만 좌측 네비용 프로젝트 목록을 조회한다.
  // (표시 여부는 LeftNav가 경로에 따라 판단 — admin/auth 경로는 숨김)
  const projects = member
    ? await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      })
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <SiteHeader username={member?.username ?? null} />
        <div className="flex flex-1">
          <LeftNav projects={projects} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
