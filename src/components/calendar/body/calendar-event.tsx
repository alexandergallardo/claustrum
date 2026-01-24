import type { CalendarEvent as CalendarEventType } from "@/lib/types";
import { useCalendarContext } from "../calendar-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getColorClasses } from "@/lib/color-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, Clock, Layers, MapPin, User, Users, X } from "lucide-react";
import { memo } from "react";

interface EventPosition {
  left: string;
  width: string;
  top: string;
  height: string;
}

interface CalendarEventProps {
  event: CalendarEventType;
  position?: EventPosition;
  month?: boolean;
  className?: string;
}

const CalendarEvent = memo(function CalendarEvent({
  event,
  position,
  month = false,
  className,
}: CalendarEventProps) {
  const { onRemoveEvent } = useCalendarContext();

  const style = month ? {} : (position ?? {});

  const colorClasses = getColorClasses(event.color);

  const classroomLabel = event.classroom?.trim();
  const showClassroom =
    classroomLabel && !classroomLabel.toLowerCase().includes("no disponible");
  const professorLabel =
    event.professors?.filter(Boolean).join(", ") || "Sin asignar";
  const modalityLabel = event.groupType ?? "Sin modalidad";
  const campusLabel = event.campusName;
  const heightValue = month ? null : (position?.height ? parseFloat(position.height) : null);
  const eventHeight = heightValue;
  const isCompact = eventHeight !== null && eventHeight < 72;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group px-1 py-0.5 sm:px-2 sm:py-1 rounded-md cursor-pointer transition-all duration-200 border relative",
            colorClasses.bg,
            colorClasses.hover,
            colorClasses.border,
            !month && "absolute overflow-hidden",
            className,
          )}
          style={style}
        >
          {!month && onRemoveEvent && (
            <button
              type="button"
              className={cn(
                "absolute top-1 right-1 rounded-sm p-0.5 text-white/80 hover:text-white cursor-pointer",
                "opacity-0 group-hover:opacity-100 transition-opacity",
              )}
              onClick={(eventClick) => {
                eventClick.stopPropagation();
                onRemoveEvent(event);
              }}
              aria-label="Quitar grupo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <div className={cn("flex flex-col w-full gap-0.5", colorClasses.text)}>
            <p
              className={cn(
                "font-semibold text-[11px] leading-tight sm:text-[13px]",
                isCompact && "text-[9px] sm:text-[10px]",
              )}
            >
              {event.courseName}
            </p>
            {!isCompact && showClassroom && (
              <div className="flex items-center gap-2 text-[10px] sm:text-xs opacity-90">
                <span className="flex h-3 w-3 items-center justify-center shrink-0 sm:h-4 sm:w-4">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                </span>
                <span className="leading-tight">{classroomLabel}</span>
              </div>
            )}
            {!isCompact && (
              <div className="flex items-center gap-2 text-[10px] sm:text-xs opacity-85">
                <span className="flex h-3 w-3 items-center justify-center shrink-0 sm:h-4 sm:w-4">
                  <Layers className="h-3 w-3 sm:h-4 sm:w-4" />
                </span>
                <span className="leading-tight">{modalityLabel}</span>
              </div>
            )}
            <div
              className={cn(
                "flex items-start gap-2 text-[10px] sm:text-xs opacity-85",
                isCompact && "hidden",
              )}
            >
              <span className="flex h-3 w-3 items-center justify-center shrink-0 sm:h-4 sm:w-4">
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
              </span>
              <span className={cn("leading-tight", !isCompact ? "whitespace-normal break-words line-clamp-2" : "truncate")}>
                {professorLabel}
              </span>
            </div>
            {isCompact && (
              <p className="text-[9px] opacity-80 sm:text-[10px]">
                {format(event.start, "h:mm a", { locale: es })}
              </p>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-wrap">
        <div className="space-y-1">
          <p className="font-semibold max-w-[220px] break-words leading-tight">
            {event.courseName} ({event.courseCode})
          </p>
          <p className="text-sm flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <span>Grupo {event.groupCode}</span>
          </p>
          <p className="text-sm flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              <Clock className="h-4 w-4" />
            </span>
            <span>
              {format(event.start, "h:mm a", { locale: es })} -{" "}
              {format(event.end, "h:mm a", { locale: es })}
            </span>
          </p>
          {campusLabel && (
            <p className="text-sm flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{campusLabel}</span>
            </p>
          )}
          {showClassroom && (
            <p className="text-sm flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center shrink-0">
                <MapPin className="h-4 w-4" />
              </span>
              <span>{classroomLabel}</span>
            </p>
          )}
          <p className="text-sm flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              <Layers className="h-4 w-4" />
            </span>
            <span>{modalityLabel}</span>
          </p>
          <p className="text-sm flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center shrink-0">
              <User className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">{professorLabel}</span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export default CalendarEvent;
