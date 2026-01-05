import { createFileRoute, useLocation, ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { UserIcon, PencilIcon, Loader2Icon } from "lucide-react";

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

export const Route = createFileRoute("/app/settings/profile")({
  component: () => <ClientOnly fallback={<div className="flex items-center justify-center py-12"><Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" /></div>}><ProfilePage /></ClientOnly>,
});

type UniversityRow = {
  id: number;
  name: string;
  short_name: string;
};

type CampusRow = {
  id: number;
  university_id: number;
  code: string;
  name: string;
};

type AcademicUnitRow = {
  id: number;
  code: string;
  name: string;
};

type StudyPlanRow = {
  id: number;
  academic_unit_id: number;
  external_plan_id: number;
  name: string;
  academic_degree: string | null;
};

type UserProfileContextRow = {
  user_id: string;
  carnet: string | null;
  university_id: number | null;
  university_name: string | null;
  campus_id: number | null;
  campus_name: string | null;
  academic_unit_id: number | null;
  academic_unit_name: string | null;
  study_plan_id: number | null;
  study_plan_name: string | null;
  entry_year: number | null;
};

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      authUser: User | null;
      profileContext: UserProfileContextRow | null;
      universities: UniversityRow[];
      campuses: CampusRow[];
      academicUnits: AcademicUnitRow[];
      studyPlans: StudyPlanRow[];
    }
  | { status: "error"; message: string };

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}

function ProfilePage() {
  const location = useLocation();

  // Initialize Supabase lazily in useEffect only, never during component creation
  const [supabase, setSupabase] = useState<any>(null);

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [isEditing, setIsEditing] = useState(false);

  const [universityIdDraft, setUniversityIdDraft] = useState<string>("");
  const [campusIdDraft, setCampusIdDraft] = useState<string>("");
  const [academicUnitIdDraft, setAcademicUnitIdDraft] = useState<string>("");
  const [studyPlanIdDraft, setStudyPlanIdDraft] = useState<string>("");
  const [carnetDraft, setCarnetDraft] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);

  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [loadingCareerPrograms, setLoadingCareerPrograms] = useState(false);
  const [loadingStudyPlans, setLoadingStudyPlans] = useState(false);

  const authUser = state.status === "ready" ? state.authUser : null;
  const profileContext = state.status === "ready" ? state.profileContext : null;
  const universities = state.status === "ready" ? state.universities : [];
  const campuses = state.status === "ready" ? state.campuses : [];
  const academicUnits = state.status === "ready" ? state.academicUnits : [];
  const studyPlans = state.status === "ready" ? state.studyPlans : [];

  const hasData = profileContext?.study_plan_id !== null;
  const isReady = state.status === "ready";

  async function loadCampuses(universityId: number, client: any): Promise<CampusRow[]> {
    const { data, error } = await client
      .rpc("get_campuses_for_university", { p_university_id: universityId })
      .select("id,university_id,code,name")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as CampusRow[];
  }

  async function loadAcademicUnits(campusId: number, client: any): Promise<AcademicUnitRow[]> {
    const { data, error } = await client
      .rpc("get_academic_units_for_campus", { p_campus_id: campusId })
      .select("id,code,name")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as AcademicUnitRow[];
  }

  async function loadStudyPlans(academicUnitId: number, client: any): Promise<StudyPlanRow[]> {
    const { data, error } = await client
      .rpc("get_study_plans_for_academic_unit", { p_academic_unit_id: academicUnitId })
      .select("id,academic_unit_id,external_plan_id,name,academic_degree");

    if (error) throw error;
    return (data ?? []) as StudyPlanRow[];
  }

  async function loadProfileContext(userId: string, client: any): Promise<UserProfileContextRow | null> {
    const { data, error } = await client
      .rpc("get_user_profile_with_context", { p_user_id: userId })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data as UserProfileContextRow | null;
  }

  function setDraftsFromContext(ctx: UserProfileContextRow | null) {
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
  }

  async function refresh(auth: User | null, client: any): Promise<void> {
    async function loadUniversitiesWithClient(): Promise<UniversityRow[]> {
      const { data, error } = await client
        .from("v_universities")
        .select("id,name,short_name")
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    }

    async function loadProfileContextWithClient(userId: string): Promise<UserProfileContextRow | null> {
      const { data, error } = await client
        .rpc("get_user_profile_with_context", { p_user_id: userId })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data as UserProfileContextRow | null;
    }

    const nextUniversities = await loadUniversitiesWithClient();

    if (!auth) {
      setState({
        status: "ready",
        authUser: null,
        profileContext: null,
        universities: nextUniversities,
        campuses: [],
        academicUnits: [],
        studyPlans: [],
      });
      setDraftsFromContext(null);
      return;
    }

    const nextProfileContext = await loadProfileContextWithClient(auth.id);

    // Load cascading data based on profile context
    let nextCampuses: CampusRow[] = [];
    let nextAcademicUnits: AcademicUnitRow[] = [];
    let nextStudyPlans: StudyPlanRow[] = [];

    if (nextProfileContext?.university_id) {
      nextCampuses = await loadCampuses(nextProfileContext.university_id, client);
    }

    if (nextProfileContext?.campus_id) {
      nextAcademicUnits = await loadAcademicUnits(nextProfileContext.campus_id, client);
    }

    if (nextProfileContext?.academic_unit_id) {
      nextStudyPlans = await loadStudyPlans(nextProfileContext.academic_unit_id, client);
    }

    setState({
      status: "ready",
      authUser: auth,
      profileContext: nextProfileContext,
      universities: nextUniversities,
      campuses: nextCampuses,
      academicUnits: nextAcademicUnits,
      studyPlans: nextStudyPlans,
    });

    if (nextProfileContext?.study_plan_id !== null) {
      setDraftsFromContext(nextProfileContext);
    } else {
      setDraftsFromContext(null);
    }
  }

  useEffect(() => {
    // Never initialize Supabase during SSR
    if (typeof window === "undefined") return;

    let isActive = true;

    async function init() {
      try {
        // Dynamically import to avoid SSR evaluation
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
        const sb = getSupabaseBrowserClient();
        
        // Set the client state BEFORE any other operations
        if (!isActive) return;
        setSupabase(sb);

        // Now get auth user
        const { data, error } = await sb.auth.getUser();
        if (error) {
          // If there's an auth error, just treat as no user
          if (!isActive) return;
          await refresh(null, sb);
          
          // Still subscribe to auth state changes
          const { data: sub } = sb.auth.onAuthStateChange(
            async (_event, session) => {
              try {
                if (isActive) {
                  await refresh(session?.user ?? null, sb);
                }
              } catch (err) {
                // Silently handle errors in auth state changes
                console.error("Auth state change error:", err);
              }
            },
          );
          
          if (!isActive) return;
          return () => {
            sub.subscription.unsubscribe();
          };
        }

        if (!isActive) return;
        await refresh(data.user ?? null, sb);

        // Register auth state change listener AFTER initialization
        const { data: sub } = sb.auth.onAuthStateChange(
          async (_event, session) => {
            try {
              if (isActive) {
                await refresh(session?.user ?? null, sb);
              }
            } catch (err) {
              // Silently handle errors in auth state changes
              console.error("Auth state change error:", err);
            }
          },
        );

        if (!isActive) return;
        
        return () => {
          sub.subscription.unsubscribe();
        };
      } catch (err) {
        if (!isActive) return;
        setState({ status: "error", message: getErrorMessage(err) });
      }
    }

    void init();

    return () => {
      isActive = false;
    };
  }, [location.pathname]);

  async function handleUniversityChange(universityId: string) {
    setFormError(null);
    setUniversityIdDraft(universityId);
    setCampusIdDraft("");
    setAcademicUnitIdDraft("");
    setStudyPlanIdDraft("");

    setLoadingCampuses(true);
    try {
      const nextCampuses = await loadCampuses(Number(universityId), supabase!);
      setState(prev => prev.status === "ready" ? {
        ...prev,
        campuses: nextCampuses,
        academicUnits: [],
        studyPlans: [],
      } : prev);
    } catch (err) {
      toast.error("Error al cargar sedes");
    } finally {
      setLoadingCampuses(false);
    }
  }

  function handleCampusChange(campusId: string) {
    setFormError(null);
    setCampusIdDraft(campusId);
    setAcademicUnitIdDraft("");
    setStudyPlanIdDraft("");

    setLoadingCareerPrograms(true);
    loadAcademicUnits(Number(campusId), supabase!)
      .then((nextAcademicUnits) => {
        setState(prev => prev.status === "ready" ? {
          ...prev,
          academicUnits: nextAcademicUnits,
          studyPlans: [],
        } : prev);
      })
      .catch(() => {
        toast.error("Error al cargar escuelas");
      })
      .finally(() => {
        setLoadingCareerPrograms(false);
      });
  }

  function handleAcademicUnitChange(academicUnitId: string) {
    setFormError(null);
    setAcademicUnitIdDraft(academicUnitId);
    setStudyPlanIdDraft("");

    setLoadingStudyPlans(true);
    loadStudyPlans(Number(academicUnitId), supabase!)
      .then((nextStudyPlans) => {
        setState(prev => prev.status === "ready" ? {
          ...prev,
          studyPlans: nextStudyPlans,
        } : prev);
      })
      .catch(() => {
        toast.error("Error al cargar planes de estudio");
      })
      .finally(() => {
        setLoadingStudyPlans(false);
      });
  }

  function handleStudyPlanChange(studyPlanId: string) {
    setFormError(null);
    setStudyPlanIdDraft(studyPlanId);
  }

  const hasUnsavedChanges = isReady && authUser && profileContext && (
    (profileContext.university_id !== null && String(profileContext.university_id) !== universityIdDraft) ||
    (profileContext.campus_id !== null && String(profileContext.campus_id) !== campusIdDraft) ||
    (profileContext.academic_unit_id !== null && String(profileContext.academic_unit_id) !== academicUnitIdDraft) ||
    (profileContext.study_plan_id !== null && String(profileContext.study_plan_id) !== studyPlanIdDraft) ||
    (profileContext.carnet !== null && profileContext.carnet !== carnetDraft) ||
    (profileContext.university_id === null && universityIdDraft !== "")
  );

  const [formError, setFormError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (!isReady || !authUser) return;

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
      const studyPlanId = Number(studyPlanIdDraft);
      const campusId = Number(campusIdDraft);
      
      // Extract entry_year from carnet (first 4 digits)
      const entryYear = carnetDraft ? parseInt(carnetDraft.substring(0, 4), 10) : null;

      // Update user with carnet
      if (carnetDraft !== "") {
        const { error: userError } = await supabase!
          .from("user")
          .upsert({
            id: authUser.id,
            carnet: carnetDraft,
          });

        if (userError) throw userError;
      }

      const { data: uspData, error: uspCheckError } = await supabase!
        .from("user_study_plan")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("is_active", true)
        .maybeSingle();

      if (uspCheckError) throw uspCheckError;

      if (uspData) {
        const { error: updateError } = await supabase!
          .from("user_study_plan")
          .update({
            study_plan_id: studyPlanId,
            campus_id: campusId,
            ...(entryYear && { entry_year: entryYear }),
          })
          .eq("id", uspData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase!
          .from("user_study_plan")
          .insert({
            user_id: authUser.id,
            study_plan_id: studyPlanId,
            campus_id: campusId,
            entry_year: entryYear || new Date().getFullYear(),
          });

        if (insertError) throw insertError;
      }

      const nextProfileContext = await loadProfileContext(authUser.id, supabase!);
      setState(prev => prev.status === "ready" ? {
        ...prev,
        profileContext: nextProfileContext,
      } : prev);

      setDraftsFromContext(nextProfileContext);
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
    setDraftsFromContext(profileContext);
    setIsEditing(false);
  }

  function startEditing() {
    if (profileContext?.university_id !== null && universityIdDraft === "") {
      setDraftsFromContext(profileContext);
    }
    setIsEditing(true);
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm">
            <div className="font-medium">Error al cargar el perfil</div>
            <div className="text-muted-foreground mt-1">{state.message}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if not authenticated
  if (!authUser && isReady) {
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
              <AvatarImage src={authUser?.user_metadata?.avatar_url} />
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
          {authUser && (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Información académica</CardTitle>
            <CardDescription>Tu contexto académico en la institución</CardDescription>
          </div>
          {authUser && !isEditing && (
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

          {authUser ? (
            <>
              <Field>
                <FieldLabel>Universidad</FieldLabel>
                <Select
                  value={universityIdDraft}
                  onValueChange={(v) => void handleUniversityChange(v)}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu universidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((u) => (
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
                    {loadingCampuses ? (
                      <span className="flex items-center gap-2">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Cargando...
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecciona tu sede" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((c) => (
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
                    {loadingCareerPrograms ? (
                      <span className="flex items-center gap-2">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Cargando...
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecciona tu escuela" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {academicUnits.map((au) => (
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
                    {loadingStudyPlans ? (
                      <span className="flex items-center gap-2">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Cargando...
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecciona tu plan" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {studyPlans.map((sp) => (
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
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Inicia sesión para configurar tu información académica.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
