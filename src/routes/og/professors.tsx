import { createFileRoute } from "@tanstack/react-router";

import { ProfessorReviewsList } from "@/routes/professors/-professor-reviews-list";
import { demoReviewRows } from "@/routes/home/-data";
import { Logo } from "@/routes/home/-icons";

export const Route = createFileRoute("/og/professors")({
  component: OgProfessorsRoute,
});

function OgProfessorsRoute() {
  return (
    <div
      className="bg-background flex h-[630px] w-[1200px] flex-col pt-12 px-12 pb-0"
      style={{
        backgroundImage:
          "radial-gradient(circle at 100% 100%, hsl(var(--primary) / 0.1), transparent 50%), radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.05), transparent 50%)",
      }}
    >
      <div className="mb-8 flex items-center justify-between px-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Logo main="currentColor" accent="currentColor" className="text-primary size-10" />
            <h1 className="text-4xl font-bold tracking-tight">Claustrum</h1>
          </div>
          <h2 className="text-muted-foreground text-2xl">
            Reseñas y evaluaciones de profesores
          </h2>
        </div>
      </div>

      <div className="border-border bg-card shadow-xs flex-1 overflow-hidden rounded-t-2xl border border-b-0">
        <div className="pointer-events-none">
          <ProfessorReviewsList
            reviewRows={demoReviewRows}
            isLoading={false}
            isFetching={false}
            page={0}
            pageSize={10}
            totalCount={demoReviewRows.length}
            totalPages={1}
            hasMore={false}
            firstRow={1}
            lastRow={demoReviewRows.length}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            showPagination={false}
            frameless={true}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
