export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute inset-0 rounded-xl bg-accent/20 animate-ping" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border-default">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="text-wasabi animate-pulse">
              <path d="M16 4c-5 5-9 10-9 16a9 9 0 0018 0c0-6-4-11-9-16z" fill="currentColor" opacity="0.85"/>
              <path d="M16 8v14M13 13l3-2 3 2M13 17.5l3-1.5 3 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
            </svg>
          </div>
        </div>
        <p className="text-sm text-text-tertiary">Loading...</p>
      </div>
    </div>
  );
}
