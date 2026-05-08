import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { Mode } from "../../calendar-types";

import { useCalendarContext } from "../../calendar-context";
import { calendarModeIconMap } from "../../calendar-mode-icon-map";
import { calendarModes } from "../../calendar-types";

const noMotion = { duration: 0 };

export default function CalendarHeaderActionsMode() {
  const { mode, setMode } = useCalendarContext();
  const shouldReduceMotion = useReducedMotion();

  return (
    <LayoutGroup>
      <ToggleGroup
        className="flex gap-0 -space-x-px overflow-hidden rounded-sm border shadow-sm shadow-black/5 rtl:space-x-reverse"
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(value) => {
          if (value) setMode(value as Mode);
        }}
      >
        {calendarModes.map((modeValue) => {
          const isSelected = mode === modeValue;
          return (
            <motion.div
              key={modeValue}
              layout
              className="flex flex-1 divide-x"
              animate={{ flex: isSelected ? 1.6 : 1 }}
              transition={
                shouldReduceMotion
                  ? noMotion
                  : {
                      flex: {
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      },
                    }
              }
            >
              <ToggleGroupItem
                value={modeValue}
                className={cn(
                  "relative flex w-full items-center justify-center gap-2 rounded-none border-none text-base shadow-none focus-visible:z-10",
                  isSelected && "z-10",
                )}
              >
                <motion.div
                  layout
                  className="flex items-center justify-center gap-2 px-3 py-2"
                  initial={false}
                  animate={{
                    scale: isSelected ? 1 : 0.95,
                  }}
                  transition={
                    shouldReduceMotion
                      ? noMotion
                      : {
                          scale: {
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          },
                          layout: {
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          },
                        }
                  }
                >
                  <motion.div
                    layout="position"
                    initial={false}
                    animate={{
                      scale: isSelected ? 0.9 : 1,
                    }}
                    transition={
                      shouldReduceMotion
                        ? noMotion
                        : {
                            scale: {
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                            },
                          }
                    }
                  >
                    {calendarModeIconMap[modeValue]}
                  </motion.div>
                  <AnimatePresence mode="popLayout">
                    {isSelected && (
                      <motion.p
                        layout="position"
                        key={`text-${modeValue}`}
                        className="origin-left font-medium whitespace-nowrap"
                        initial={{
                          opacity: 0,
                          x: -2,
                          scale: 0.95,
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          scale: 1,
                          transition: shouldReduceMotion
                            ? noMotion
                            : {
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                                opacity: { duration: 0.15 },
                              },
                        }}
                        exit={{
                          opacity: 0,
                          x: -2,
                          scale: 0.95,
                          transition: shouldReduceMotion
                            ? noMotion
                            : {
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                                opacity: { duration: 0.1 },
                              },
                        }}
                      >
                        {modeValue.charAt(0).toUpperCase() + modeValue.slice(1)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              </ToggleGroupItem>
            </motion.div>
          );
        })}
      </ToggleGroup>
    </LayoutGroup>
  );
}
