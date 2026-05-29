// 참조: docs/domain/01-project.md (v1.0)
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        프로젝트 편집
      </h1>
      <ProjectForm
        action={updateProject}
        submitLabel="저장"
        project={{
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
        }}
      />
    </div>
  );
}
