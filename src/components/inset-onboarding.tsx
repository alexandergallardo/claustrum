import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@/components/ui/combobox";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useAcademicUnits, useAuthUser, useCampuses, useStudyPlans, useUniversities } from "@/lib/hooks/use-queries";
import { AuthLeftPanel, AuthPageBackdrop } from "@/components/inset-auth";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 4;

export function InsetOnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const { data: universities, isLoading: isUniversitiesLoading } = useUniversities();

  const defaultUniversity = useMemo(() => {
    const tec = (universities ?? []).find((u) => u.name.toLowerCase().includes("tecnologico"));
    return tec ?? (universities?.[0] ?? null);
  }, [universities]);

  const [step, setStep] = useState(1);
  const [campusId, setCampusId] = useState("");
  const [academicUnitId, setAcademicUnitId] = useState("");
  const [studyPlanId, setStudyPlanId] = useState("");
  const [carnet, setCarnet] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showStepError, setShowStepError] = useState(false);

  const campuses = useCampuses(defaultUniversity?.id ?? null);
  const academicUnits = useAcademicUnits(campusId ? Number(campusId) : null);
  const studyPlans = useStudyPlans(academicUnitId ? Number(academicUnitId) : null);

  const campusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const academicUnitTriggerRef = useRef<HTMLButtonElement | null>(null);
  const studyPlanTriggerRef = useRef<HTMLButtonElement | null>(null);

  const skipForNow = () => {
    void (async () => {
      if (!authUser) return;
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from("user")
        .upsert({ id: authUser.id, onboarding_dismissed_at: new Date().toISOString() });
      await queryClient.invalidateQueries({ queryKey: ["onboardingStatus", authUser.id] });
      navigate({ to: "/" });
    })();
  };

  const nextStep = () => {
    setSubmitError(null);
    if (isNextDisabled) {
      setShowStepError(true);
      return;
    }
    setShowStepError(false);
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };

  const prevStep = () => {
    setSubmitError(null);
    setShowStepError(false);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const finishOnboarding = async () => {
    if (!authUser) return;
    if (!campusId || !academicUnitId || !studyPlanId) {
      setShowStepError(true);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const parsedCampusId = Number(campusId);
      const parsedStudyPlanId = Number(studyPlanId);
      const entryYear = carnet ? parseInt(carnet.substring(0, 4), 10) : null;

      if (carnet) {
        const { error: userError } = await supabase
          .from("user")
          .upsert({ id: authUser.id, carnet });
        if (userError) throw userError;
      }

      const { data: activePlan, error: activePlanError } = await supabase
        .from("user_study_plan")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .maybeSingle();
      if (activePlanError) throw activePlanError;

      if (activePlan) {
        const { error: updateError } = await supabase
          .from("user_study_plan")
          .update({
            study_plan_id: parsedStudyPlanId,
            campus_id: parsedCampusId,
            ...(entryYear ? { entry_year: entryYear } : {}),
          })
          .eq("id", activePlan.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_study_plan")
          .insert({
            user_id: authUser.id,
            study_plan_id: parsedStudyPlanId,
            campus_id: parsedCampusId,
            entry_year: entryYear || new Date().getFullYear(),
          });
        if (insertError) throw insertError;
      }

      await supabase
        .from("user")
        .upsert({ id: authUser.id, onboarding_completed_at: new Date().toISOString() });

      await queryClient.invalidateQueries({ queryKey: ["onboardingStatus", authUser.id] });
      await queryClient.invalidateQueries({ queryKey: ["profile", authUser.id] });
      await queryClient.invalidateQueries({ queryKey: ["userStudyPlan", authUser.id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboardStats", authUser.id] });
      navigate({ to: "/" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo guardar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  const isNextDisabled = (step === 1 && !campusId) || (step === 2 && !academicUnitId) || (step === 3 && !studyPlanId);

  const currentStepError =
    step === 1 ? "Selecciona una sede." : step === 2 ? "Selecciona una carrera." : step === 3 ? "Selecciona un plan de estudios." : null;

  const showCampusError = showStepError && step === 1 && !campusId;
  const showAcademicUnitError = showStepError && step === 2 && !academicUnitId;
  const showStudyPlanError = showStepError && step === 3 && !studyPlanId;

  const isLoading = isAuthLoading || isUniversitiesLoading;
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <AuthPageBackdrop />
      <div className="relative grid h-screen w-full grid-cols-1 lg:grid-cols-[1fr_minmax(440px,560px)]">
        <AuthLeftPanel />
        <div className="relative flex h-full flex-col overflow-y-auto bg-card text-foreground">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 lg:py-10">
            <div className="mb-6 flex items-center justify-between gap-3 text-sm">
              <div className="font-medium">Paso {step} de {TOTAL_STEPS}</div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={skipForNow}>Saltar</Button>
                <Button variant="ghost" size="sm" onClick={skipForNow}>Configurar más tarde</Button>
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">Completa tu perfil académico</h1>

            {submitError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>No se pudo guardar</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-4">
              {step === 1 ? (
                <Field>
                  <FieldLabel>Sede</FieldLabel>
                  <Combobox
                    items={campuses.data ?? []}
                    value={(campuses.data ?? []).find((item) => String(item.id) === campusId) ?? null}
                    onValueChange={(item) => {
                      const value = item ? String(item.id) : "";
                      setCampusId(value);
                      setAcademicUnitId("");
                      setStudyPlanId("");
                      setShowStepError(false);
                    }}
                    itemToStringValue={(item) => item.name}
                  >
                    <ComboboxTrigger
                      ref={campusTriggerRef}
                      render={<Button variant="outline" className={cn("w-full justify-between font-normal", showCampusError && "border-destructive text-destructive") } />}
                    >
                      <span className={`block min-w-0 flex-1 truncate text-left ${!campusId ? "text-muted-foreground" : ""}`}>
                        {(campuses.data ?? []).find((item) => String(item.id) === campusId)?.name ?? "Selecciona una sede"}
                      </span>
                    </ComboboxTrigger>
                    <ComboboxContent anchor={campusTriggerRef} className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]">
                      <ComboboxInput showTrigger={false} placeholder="Buscar sede" />
                      <ComboboxEmpty>No se encontraron resultados.</ComboboxEmpty>
                      <ComboboxList>{(item) => <ComboboxItem key={item.id} value={item}>{item.name}</ComboboxItem>}</ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError>{showCampusError ? currentStepError : null}</FieldError>
                </Field>
              ) : null}

              {step === 2 ? (
              <Field>
                  <FieldLabel>Carrera</FieldLabel>
                  <Combobox
                    items={academicUnits.data ?? []}
                    value={(academicUnits.data ?? []).find((item) => String(item.id) === academicUnitId) ?? null}
                    onValueChange={(item) => {
                      const value = item ? String(item.id) : "";
                      setAcademicUnitId(value);
                      setStudyPlanId("");
                      setShowStepError(false);
                    }}
                    itemToStringValue={(item) => `${item.code} - ${item.name}`}
                  >
                    <ComboboxTrigger
                      ref={academicUnitTriggerRef}
                      render={<Button variant="outline" className={cn("w-full justify-between font-normal", showAcademicUnitError && "border-destructive text-destructive")} />}
                    >
                      <span className={`block min-w-0 flex-1 truncate text-left ${!academicUnitId ? "text-muted-foreground" : ""}`}>
                        {(academicUnits.data ?? []).find((item) => String(item.id) === academicUnitId)
                          ? `${(academicUnits.data ?? []).find((item) => String(item.id) === academicUnitId)!.code} - ${(academicUnits.data ?? []).find((item) => String(item.id) === academicUnitId)!.name}`
                          : "Selecciona una carrera"}
                      </span>
                    </ComboboxTrigger>
                    <ComboboxContent anchor={academicUnitTriggerRef} className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]">
                      <ComboboxInput showTrigger={false} placeholder="Buscar carrera" />
                      <ComboboxEmpty>No se encontraron resultados.</ComboboxEmpty>
                      <ComboboxList>{(item) => <ComboboxItem key={item.id} value={item}>{item.code} - {item.name}</ComboboxItem>}</ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError>{showAcademicUnitError ? currentStepError : null}</FieldError>
                </Field>
              ) : null}

              {step === 3 ? (
                <Field>
                  <FieldLabel>Plan de estudios</FieldLabel>
                  <Combobox
                    items={studyPlans.data ?? []}
                    value={(studyPlans.data ?? []).find((item) => String(item.id) === studyPlanId) ?? null}
                    onValueChange={(item) => {
                      setStudyPlanId(item ? String(item.id) : "");
                      setShowStepError(false);
                    }}
                    itemToStringValue={(item) => item.name}
                  >
                    <ComboboxTrigger
                      ref={studyPlanTriggerRef}
                      render={<Button variant="outline" className={cn("w-full justify-between font-normal", showStudyPlanError && "border-destructive text-destructive")} />}
                    >
                      <span className={`block min-w-0 flex-1 truncate text-left ${!studyPlanId ? "text-muted-foreground" : ""}`}>
                        {(studyPlans.data ?? []).find((item) => String(item.id) === studyPlanId)?.name ?? "Selecciona un plan de estudios"}
                      </span>
                    </ComboboxTrigger>
                    <ComboboxContent anchor={studyPlanTriggerRef} className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]">
                      <ComboboxInput showTrigger={false} placeholder="Buscar plan" />
                      <ComboboxEmpty>No se encontraron resultados.</ComboboxEmpty>
                      <ComboboxList>{(item) => <ComboboxItem key={item.id} value={item}>{item.name}</ComboboxItem>}</ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FieldError>{showStudyPlanError ? currentStepError : null}</FieldError>
                </Field>
              ) : null}

              {step === 4 ? (
                <Field>
                  <FieldLabel>Carnet</FieldLabel>
                  <Input
                    value={carnet}
                    onChange={(e) => {
                      setCarnet(e.target.value.replace(/[^0-9]/g, ""));
                      setShowStepError(false);
                    }}
                    placeholder="Ej: 2024123456"
                  />
                </Field>
              ) : null}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" onClick={prevStep} disabled={step === 1 || isSaving}>Anterior</Button>
              {step < TOTAL_STEPS ? (
                <Button onClick={nextStep} disabled={isNextDisabled}>Siguiente</Button>
              ) : (
                <Button onClick={finishOnboarding} disabled={isSaving}>
                  {isSaving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
                  Finalizar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
