export default function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/40">
        <svg viewBox="0 0 24 24" fill="none" className="size-5 text-white">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-lg font-extrabold tracking-tight text-white">Al Día</span>
    </div>
  );
}
