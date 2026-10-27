// PortCheck AI mark: a port crane lifting a shipping document.
export function PortCheckMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect width="48" height="48" rx="12" fill="#152e51" />
      <g stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M12 39V10" />
        <path d="M7 12h31" />
        <path d="M12 18l6-6" />
        <path d="M31 12v5" />
      </g>
      <path d="M24 17h10l4 4v16H24z" fill="#fff" />
      <path d="M34 17v4h4z" fill="#cbd5e1" />
      <path d="M27 25h8M27 29h8M27 33h5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 42c3 0 3-1.6 6-1.6s3 1.6 6 1.6" stroke="#60a5fa" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
