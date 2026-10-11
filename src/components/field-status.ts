import type { VerificationStatus } from "@/modules/documents/schema";
export const statusLabels: Record<VerificationStatus, string> = {
  verified: "원문 대조 완료",
  unverified: "근거 미확인",
  missing: "정보 없음",
  user_edited: "사용자 수정",
};
export const statusColors: Record<VerificationStatus, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  unverified: "bg-amber-50 text-amber-800",
  missing: "bg-slate-100 text-slate-500",
  user_edited: "bg-blue-50 text-blue-700",
};
