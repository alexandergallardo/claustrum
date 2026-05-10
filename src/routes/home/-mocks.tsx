export function ScheduleMock() {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-7">
      <div className="border-border bg-muted flex h-8 items-center gap-2 border px-3">
        <div className="size-[7px] rounded-full bg-[#C9A227]/40" />
        <div className="bg-border h-[5px] w-[65%] rounded-[2px]" />
      </div>
      <div className="border-border bg-muted flex h-8 items-center gap-2 border px-3">
        <div className="size-[7px] rounded-full bg-[#C9A227]/80" />
        <div className="bg-border h-[5px] w-[85%] rounded-[2px]" />
      </div>
      <div className="flex flex-1 gap-2">
        <div className="border-border bg-muted flex-1 border p-4">
          <div className="text-muted-foreground mb-2 font-mono text-[10px]">LUN 07:30</div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`l-${i}`}
                className={`aspect-square border ${[0, 2, 6].includes(i) ? "border-[#C9A227] bg-[#C9A227]/12" : "border-border bg-muted"}`}
              />
            ))}
          </div>
        </div>
        <div className="border-border bg-muted flex-1 border p-4">
          <div className="text-muted-foreground mb-2 font-mono text-[10px]">MAR 09:00</div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`m-${i}`}
                className={`aspect-square border ${[1, 4, 7].includes(i) ? "border-[#C9A227] bg-[#C9A227]/12" : "border-border bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GraphMock() {
  return (
    <div className="flex h-full w-full items-center justify-center p-7">
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <rect
          x="60"
          y="10"
          width="40"
          height="24"
          rx="6"
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <rect
          x="20"
          y="50"
          width="40"
          height="24"
          rx="6"
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <rect
          x="100"
          y="50"
          width="40"
          height="24"
          rx="6"
          fill="var(--muted)"
          stroke="#C9A227"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <rect
          x="40"
          y="90"
          width="40"
          height="24"
          rx="6"
          fill="#C9A227"
          opacity="0.12"
          stroke="#C9A227"
          strokeWidth="1.5"
        />
        <rect
          x="90"
          y="90"
          width="40"
          height="24"
          rx="6"
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        <line x1="70" y1="34" x2="45" y2="50" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="90" y1="34" x2="115" y2="50" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="35" y1="74" x2="55" y2="90" stroke="var(--border)" strokeWidth="1.5" />
        <line x1="120" y1="74" x2="105" y2="90" stroke="var(--border)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function ReviewsMock() {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-7">
      <div className="border-border bg-muted border p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-border size-[26px] rounded-full" />
          <div>
            <div className="bg-border mb-1 h-[7px] w-20 rounded-[3px]" />
            <div className="bg-border h-[5px] w-[50px] rounded-[2px]" />
          </div>
        </div>
        <div className="bg-border mb-1 h-[5px] w-[95%] rounded-[2px]" />
        <div className="bg-border mb-1 h-[5px] w-[80%] rounded-[2px]" />
        <div className="bg-border h-[5px] w-[60%] rounded-[2px]" />
      </div>
      <div className="border-border bg-muted border p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-border size-[26px] rounded-full" />
          <div>
            <div className="bg-border mb-1 h-[7px] w-[70px] rounded-[3px]" />
            <div className="bg-border h-[5px] w-10 rounded-[2px]" />
          </div>
        </div>
        <div className="bg-border mb-1 h-[5px] w-[90%] rounded-[2px]" />
        <div className="bg-border h-[5px] w-[70%] rounded-[2px]" />
      </div>
    </div>
  );
}
