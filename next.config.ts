import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // wiremd는 Node 전용 라이브러리(서버에서만 import)라 번들에 포함하지 않고
  // 런타임에 require하도록 외부 패키지로 둔다. (슬라이드 기획서 렌더링)
  serverExternalPackages: ["wiremd"],
};

export default nextConfig;
