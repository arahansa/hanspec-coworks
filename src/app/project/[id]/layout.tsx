// 참조: docs/domain/03-node.md — 요구사항 #198 "프로젝트 선택 시 head title을 프로젝트명 처리"
// /project/:id 하위 모든 페이지의 <title>에 프로젝트 이름을 노출한다.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) return {};

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  // 존재하지 않는 프로젝트면 루트 기본 title("coworks")을 그대로 둔다.
  if (!project) return {};

  return { title: `${project.name} | coworks` };
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
