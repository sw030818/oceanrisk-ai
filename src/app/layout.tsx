import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "OceanRisk AI | 무역 서류 리스크 검토", description: "Commercial Invoice와 Packing List를 원문 근거와 함께 검토하는 해상운송 서류 분석 서비스" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
