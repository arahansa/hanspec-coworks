// 참조: docs/domain/01-project.md (v1.0)
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        새 프로젝트
      </h1>
      <ProjectForm action={createProject} submitLabel="생성" />
    </div>
  );
}
