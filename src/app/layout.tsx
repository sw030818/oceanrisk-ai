import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "OceanRisk AI | 적하목록 신고 전 정합성 검토",
  description:
    "중소 포워더를 위한 House B/L·수출신고필증·House 적하목록 신고 전 정합성 사전검증 시스템. 현재 PDF 자료 준비 단계입니다.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
