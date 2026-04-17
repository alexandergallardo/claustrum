import { ClientOnly } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UserIcon, PencilIcon, Loader2Icon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthUser, useUniversities, useCampuses, useAcademicUnits, useStudyPlans, useProfileContext } from "@/lib/hooks/use-queries";

export function ProfilePageRoute() {
  return (
    <ClientOnly
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProfilePage />
    </ClientOnly>
  )
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}

function ProfilePage() {
  const queryClient = useQueryClient();

  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const { data: universities, isLoading: isUniversitiesLoading } = useUniversities();

  const profileContext = useProfileContext(authUser?.id ?? null);

  const [isEditing, setIsEditing] = useState(false);
  const [universityIdDraft, setUniversityIdDraft] = useState<string>("");
  const [campusIdDraft, setCampusIdDraft] = useState<string>("");
  const [academicUnitIdDraft, setAcademicUnitIdDraft] = useState<string>("");
  const [studyPlanIdDraft, setStudyPlanIdDraft] = useState<string>("");
  const [carnetDraft, setCarnetDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const universityId = profileContext.data?.university_id ?? null;
  const campusId = profileContext.data?.campus_id ?? null;
  const academicUnitId = profileContext.data?.academic_unit_id ?? null;

  const effectiveUniversityId = isEditing && universityIdDraft ? Number(universityIdDraft) : universityId;
  const effectiveCampusId = isEditing && campusIdDraft ? Number(campusIdDraft) : campusId;
  const effectiveAcademicUnitId = isEditing && academicUnitIdDraft ? Number(academicUnitIdDraft) : academicUnitId;

  const campuses = useCampuses(effectiveUniversityId);
  const academicUnits = useAcademicUnits(effectiveCampusId);
  const studyPlans = useStudyPlans(effectiveAcademicUnitId);

  const isInitialLoading = isAuthLoading || isUniversitiesLoading || profileContext.isLoading;
  const hasData = profileContext.data?.study_plan_id !== null;

  const setDraftsFromContext = (ctx: typeof profileContext.data) => {
    if (!ctx) {
      setUniversityIdDraft("");
      setCampusIdDraft("");
      setAcademicUnitIdDraft("");
      setStudyPlanIdDraft("");
      setCarnetDraft("");
      return;
    }

    if (ctx.university_id !== null) setUniversityIdDraft(String(ctx.university_id));
    else setUniversityIdDraft("");

    if (ctx.campus_id !== null) setCampusIdDraft(String(ctx.campus_id));
    else setCampusIdDraft("");

    if (ctx.academic_unit_id !== null) setAcademicUnitIdDraft(String(ctx.academic_unit_id));
    else setAcademicUnitIdDraft("");

    if (ctx.study_plan_id !== null) setStudyPlanIdDraft(String(ctx.study_plan_id));
    else setStudyPlanIdDraft("");

    if (ctx.carnet !== null) setCarnetDraft(ctx.carnet);
    else setCarnetDraft("");
  };

  useEffect(() => {
    if (profileContext.isSuccess && profileContext.data && universityIdDraft === "" && campusIdDraft === "") {
      setDraftsFromContext(profileContext.data);
    }
  }, [profileContext.isSuccess, profileContext.data, universityIdDraft, campusIdDraft]);

  const hasUnsavedChanges = authUser && profileContext.data && (
    (profileContext.data.university_id !== null && String(profileContext.data.university_id) !== universityIdDraft) ||
    (profileContext.data.campus_id !== null && String(profileContext.data.campus_id) !== campusIdDraft) ||
    (profileContext.data.academic_unit_id !== null && String(profileContext.data.academic_unit_id) !== academicUnitIdDraft) ||
    (profileContext.data.study_plan_id !== null && String(profileContext.data.study_plan_id) !== studyPlanIdDraft) ||
    (profileContext.data.carnet !== null && profileContext.data.carnet !== carnetDraft) ||
    (profileContext.data.university_id === null && universityIdDraft !== "")
  );

  async function handleUniversityChange(universityId: string) {
    setFormError(null);
    setUniversityIdDraft(universityId);
    setCampusIdDraft("");
    setAcademicUnitIdDraft("");
    setStudyPlanIdDraft("");
  }

  function handleCampusChange(campusId: string) {
    setFormError(null);
    setCampusIdDraft(campusId);
    setAcademicUnitIdDraft("");
    setStudyPlanIdDraft("");
  }

  function handleAcademicUnitChange(academicUnitId: string) {
    setFormError(null);
    setAcademicUnitIdDraft(academicUnitId);
    setStudyPlanIdDraft("");
  }

  function handleStudyPlanChange(studyPlanId: string) {
    setFormError(null);
    setStudyPlanIdDraft(studyPlanId);
  }

  async function handleSave(): Promise<void> {
    if (!authUser) return;

    setFormError(null);

    if (!campusIdDraft) {
      setFormError("Selecciona una sede.");
      return;
    }

    if (!academicUnitIdDraft) {
      setFormError("Selecciona una escuela.");
      return;
    }

    if (!studyPlanIdDraft) {
      setFormError("Selecciona un plan de estudios.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const studyPlanId = Number(studyPlanIdDraft);
      const campusId = Number(campusIdDraft);
      const entryYear = carnetDraft ? parseInt(carnetDraft.substring(0, 4), 10) : null;

      if (carnetDraft !== "") {
        const { error: userError } = await supabase
          .from("user")
          .upsert({
            id: authUser.id,
            carnet: carnetDraft,
          });

        if (userError) throw userError;
      }

      const { data: uspData, error: uspCheckError } = await supabase
        .from("user_study_plan")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .maybeSingle();

      if (uspCheckError) throw uspCheckError;

      if (uspData) {
        const { error: updateError } = await supabase
          .from("user_study_plan")
          .update({
            study_plan_id: studyPlanId,
            campus_id: campusId,
            ...(entryYear && { entry_year: entryYear }),
          })
          .eq("id", uspData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_study_plan")
          .insert({
            user_id: authUser.id,
            study_plan_id: studyPlanId,
            campus_id: campusId,
            entry_year: entryYear || new Date().getFullYear(),
          });

        if (insertError) throw insertError;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile", authUser.id] });
      setIsEditing(false);
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setFormError(null);
    setDraftsFromContext(profileContext.data ?? null);
    setIsEditing(false);
  }

  function startEditing() {
    if (profileContext.data?.university_id !== null && universityIdDraft === "") {
      setDraftsFromContext(profileContext.data);
    }
    setIsEditing(true);
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileContext.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm">
            <div className="font-medium">Error al cargar el perfil</div>
            <div className="text-muted-foreground mt-1">{getErrorMessage(profileContext.error)}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!authUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Inicia sesión para acceder a tu perfil</h3>
            <p className="text-muted-foreground mb-6">
              Necesitas estar autenticado para ver y editar tu información académica.
            </p>
            <Button asChild>
              <a href="/login">Iniciar sesión</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={authUser.user_metadata?.avatar_url} />
              <AvatarFallback>
                <UserIcon className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <Button disabled size="sm" variant="outline">
              Cambiar foto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</div>
              <div className="mt-1 font-medium">{authUser.user_metadata?.full_name ?? "No configurado"}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Correo electrónico</div>
              <div className="mt-1 font-medium">{authUser.email ?? "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Información académica</CardTitle>
            <CardDescription>Tu contexto académico en la institución</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <PencilIcon className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <Field>
            <FieldLabel>Universidad</FieldLabel>
            <Select
              value={universityIdDraft}
              onValueChange={(v) => void handleUniversityChange(v)}
              disabled={!isEditing}
            >
              <SelectTrigger>
                {isUniversitiesLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  <SelectValue placeholder="Selecciona tu universidad" />
                )}
              </SelectTrigger>
              <SelectContent>
                {universities?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Sede</FieldLabel>
            <Select
              value={campusIdDraft}
              onValueChange={(v) => void handleCampusChange(v)}
              disabled={!isEditing || !universityIdDraft}
            >
              <SelectTrigger>
                {campuses.isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  <SelectValue placeholder="Selecciona tu sede" />
                )}
              </SelectTrigger>
              <SelectContent>
                {campuses.data?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Escuela</FieldLabel>
            <Select
              value={academicUnitIdDraft}
              onValueChange={(v) => void handleAcademicUnitChange(v)}
              disabled={!isEditing || !campusIdDraft}
            >
              <SelectTrigger>
                {academicUnits.isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  <SelectValue placeholder="Selecciona tu escuela" />
                )}
              </SelectTrigger>
              <SelectContent>
                {academicUnits.data?.map((au) => (
                  <SelectItem key={au.id} value={String(au.id)}>
                    {au.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Plan de estudios</FieldLabel>
            <Select
              value={studyPlanIdDraft}
              onValueChange={(v) => void handleStudyPlanChange(v)}
              disabled={!isEditing || !academicUnitIdDraft}
            >
              <SelectTrigger>
                {studyPlans.isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Cargando...
                  </span>
                ) : (
                  <SelectValue placeholder="Selecciona tu plan" />
                )}
              </SelectTrigger>
              <SelectContent>
                {studyPlans.data?.map((sp) => (
                  <SelectItem key={sp.id} value={String(sp.id)}>
                    {sp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Carnet</FieldLabel>
            <Input
              value={carnetDraft}
              onChange={(e) => setCarnetDraft(e.target.value)}
              placeholder="Tu número de carnet (opcional)"
              disabled={!isEditing}
            />
          </Field>

          {isEditing && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => void handleSave()} disabled={isSaving || !hasUnsavedChanges}>
                {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          )}

          {!isEditing && !hasData && (
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Completa tu información académica para personalizar tu experiencia.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
