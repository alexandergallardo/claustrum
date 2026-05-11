import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const curriculumSearchSchema = z.object({
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
});

export const Route = createFileRoute("/curriculum/")({
  validateSearch: curriculumSearchSchema,
});
