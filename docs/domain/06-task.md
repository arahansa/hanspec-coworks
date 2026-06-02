---
version: "1.1"
created: "2026-06-01"
updated: "2026-06-02"
author: "arahansa"
---

# 개요
REQUIREMENT Node의 하위 작업들을 말합니다.

# TASK 테이블 설계
id: 작업의 고유 식별자(숫자) auto increment
progress: 작업의 진행도 (number)
node_id: 작업이 속한 노드의 id (number)
description: 작업 설명 (text)

# 기능
특정 REQUIREMENT Node에 대해 추가로 TASK를 생성할 수 있습니다.

# 추가 요청
Task에는 이름(varchar 50)을 지정할 수 있다. 특정 컴포넌트의 이름을 여기로 정할 수 있다.
Endpoint(varchar 255)도 지정할 수 있다. 
요구사항의 하위에서 이름과 EndPoint를 지정할 수 있다.
ENDPOINT 입력 input 에서 {{ 를 입력하면 환경변수 자동완성을 사용할 수 있다.

## 구현 완료 (2026-06-02)

- **컬럼 추가**: `Task.name`(VarChar 50, 컴포넌트 이름 등), `Task.endpoint`(VarChar 255, 경로/Endpoint). 둘 다 nullable.
- **생성 + 편집**: 요구사항 상세 페이지에서 Task 생성 폼에 이름·Endpoint 입력. 기존 Task도 인라인 편집(이름·Endpoint·설명·진행도)할 수 있다.
- **{{}} 자동완성**: Endpoint 입력에서 `{{`를 치면 해당 프로젝트의 환경변수(07-environment.md) 이름 목록이 드롭다운으로 뜨고, 선택하면 `{{NAME}}`으로 삽입된다.

### 산출 코드
- `prisma/schema.prisma` — `Task.name`, `Task.endpoint`
- `prisma/migrations/20260602085634_add_task_name_endpoint/`
- `src/app/project/[id]/node/[nodeId]/actions.ts` — `createTask`(fields), `updateTask`, `listNodeEnvNames`
- `src/app/project/[id]/node/[nodeId]/TaskSection.tsx` — 생성/편집 UI
- `src/app/project/[id]/node/[nodeId]/EndpointInput.tsx` — `{{` 환경변수 자동완성 입력

