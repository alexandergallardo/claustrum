import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";

export default function CalendarBodyHeader({
  date,
  onlyDay = false,
  className,
}: {
  date: Date;
  onlyDay?: boolean;
  className?: string;
}) {
  const isToday = isSameDay(date, new Date());

  return (
    <div
      className={cn(
        "bg-background sticky top-0 z-10 flex h-[33px] w-full items-center justify-center gap-1 border-b",
        className,
      )}
    >
      <span
        className={cn(
          "text-xs font-medium capitalize",
          isToday ? "text-primary" : "text-muted-foreground",
        )}
      >
        {format(date, "EEE", { locale: es })}
      </span>
      {!onlyDay && (
        <span
          className={cn(
            "text-xs font-medium",
            isToday ? "text-primary font-bold" : "text-foreground",
          )}
        >
          {format(date, "dd")}
        </span>
      )}
    </div>
  );
}
