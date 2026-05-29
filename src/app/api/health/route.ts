import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 로컬 PostgreSQL 연결 검증용 엔드포인트.
// Prisma 어댑터를 통해 DB에 raw 쿼리를 날려 실제 연결을 확인한다.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    return NextResponse.json({
      ok: true,
      dbTime: rows[0]?.now ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
