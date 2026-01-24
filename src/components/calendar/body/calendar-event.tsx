import type { CalendarEvent as CalendarEventType } from "@/lib/types";
import { useCalendarContext } from "../calendar-context";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getColorClasses } from "@/lib/color-utils";
import { START_HOUR, END_HOUR } from "./day/calendar-body-day-margin";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, Clock, Layers, MapPin, User, Users, X } from "lucide-react";

interface EventPosition {
  left: string;
  width: string;
  top: string;
  height: string;
}

function getOverlappingEvents(
  currentEvent: CalendarEventType,
  events: CalendarEventType[],
): CalendarEventType[] {
  return events.filter((event) => {
    if (event.id === currentEvent.id) return false;
    return (
      currentEvent.start < event.end &&
      currentEvent.end > event.start &&
      isSameDay(currentEvent.start, event.start)
    );
  });
}

function calculateEventPosition(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  hourHeight: number,
): EventPosition {
  const overlappingEvents = getOverlappingEvents(event, allEvents);
  const group = [event, ...overlappingEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const position = group.indexOf(event);
  const width = `${100 / (overlappingEvents.length + 1)}%`;
  const left = `${(position * 100) / (overlappingEvents.length + 1)}%`;

  const startHour = event.start.getHours();
  const startMinutes = event.start.getMinutes();

  let endHour = event.end.getHours();
  let endMinutes = event.end.getMinutes();

  if (!isSameDay(event.start, event.end)) {
    endHour = END_HOUR;
    endMinutes = 0;
  }

  // Ajustar posición relativa al inicio del calendario (START_HOUR)
  const adjustedStartHour = Math.max(startHour - START_HOUR, 0);
  const adjustedEndHour = Math.min(endHour, END_HOUR) - START_HOUR;

  const topPosition =
    adjustedStartHour * hourHeight + (startMinutes / 60) * hourHeight;
  const adjustedStartMinutes = startHour < START_HOUR ? 0 : startMinutes;
  const duration =
    adjustedEndHour * 60 +
    endMinutes -
    (adjustedStartHour * 60 + adjustedStartMinutes);
  const height = Math.max((duration / 60) * hourHeight, 24); // Mínimo 24px de altura

  return {
    left,
    width,
    top: `${topPosition}px`,
    height: `${height}px`,
  };
}

export default function CalendarEvent({
  event,
  month = false,
  className,
  style: styleOverride,
}: {
  event: CalendarEventType;
  month?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { events, hourHeight, onRemoveEvent } = useCalendarContext();
  const style: React.CSSProperties = month
    ? {}
    : styleOverride ?? calculateEventPosition(event, events, hourHeight);

  const colorClasses = getColorClasses(event.color);

  const classroomLabel = event.classroom?.trim();
  const showClassroom =
    classroomLabel && !classroomLabel.toLowerCase().includes("no disponible");
  const professorLabel =
    event.professors?.filter(Boolean).join(", ") || "Sin asignar";
  const modalityLabel = event.groupType ?? "Sin modalidad";
  const campusLabel = event.campusName;
  const heightValue = style.height;
  const eventHeight =
    !month && typeof heightValue === "string" ? parseFloat(heightValue) : null;
  const isCompact = eventHeight !== null && eventHeight < 72;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group px-2 py-1 rounded-md cursor-pointer transition-all duration-200 border relative",
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
                "font-semibold text-[13px] leading-tight",
                isCompact && "text-[10px]",
              )}
            >
              {event.courseName}
            </p>
            {!isCompact && showClassroom && (
              <div className="flex items-center gap-2 text-xs opacity-90">
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="leading-tight">{classroomLabel}</span>
              </div>
            )}
            {!isCompact && (
              <div className="flex items-center gap-2 text-xs opacity-85">
                <span className="flex h-4 w-4 items-center justify-center shrink-0">
                  <Layers className="h-4 w-4" />
                </span>
                <span className="leading-tight">{modalityLabel}</span>
              </div>
            )}
            <div
              className={cn(
                "flex items-start gap-2 text-xs opacity-85",
                isCompact && "hidden",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center shrink-0">
                <User className="h-4 w-4" />
              </span>
              <span className="leading-tight truncate">{professorLabel}</span>
            </div>
            {isCompact && (
              <p className="text-[10px] opacity-80">
                {format(event.start, "h:mm a", { locale: es })}
              </p>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-1">
          <p className="font-semibold">
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
              <span className="max-w-[220px] truncate">{campusLabel}</span>
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
            <span className="whitespace-normal break-words">
              {professorLabel}
            </span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
