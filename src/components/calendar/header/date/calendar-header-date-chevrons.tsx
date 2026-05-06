import { format, addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCalendarContext } from "../../calendar-context";

export default function CalendarHeaderDateChevrons() {
  const { mode, date, setDate } = useCalendarContext();

  function handleDateBackward() {
    switch (mode) {
      case "month":
        setDate(subMonths(date, 1));
        break;
      case "week":
        setDate(subWeeks(date, 1));
        break;
      case "day":
        setDate(subDays(date, 1));
        break;
    }
  }

  function handleDateForward() {
    switch (mode) {
      case "month":
        setDate(addMonths(date, 1));
        break;
      case "week":
        setDate(addWeeks(date, 1));
        break;
      case "day":
        setDate(addDays(date, 1));
        break;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleDateBackward}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="min-w-[200px] text-center text-lg font-semibold">
        {format(date, "d 'de' MMMM, yyyy", { locale: es })}
      </span>

      <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleDateForward}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
