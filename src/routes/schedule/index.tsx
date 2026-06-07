import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  hasLegacyScheduleSearchParams,
  parseScheduleSearch,
  SCHEDULE_DEFAULT_UNIVERSITY_ID,
  toScheduleUrlSearch,
} from "./-schedule-search";

export const Route = createFileRoute("/schedule/")({
  validateSearch: parseScheduleSearch,
  search: {
    middlewares: [
      ({ search, next }) => toScheduleUrlSearch(next(search)) as unknown as typeof search,
    ],
  },
  beforeLoad: ({ search, location }) => {
    const hasLegacyParams = hasLegacyScheduleSearchParams(location.searchStr);
    if (
      hasLegacyParams ||
      (search.university !== undefined && search.university !== SCHEDULE_DEFAULT_UNIVERSITY_ID)
    ) {
      throw redirect({
        to: "/schedule",
        search: toScheduleUrlSearch({
          ...search,
          university: undefined,
        }) as unknown as typeof search,
        replace: true,
      });
    }
  },
});
