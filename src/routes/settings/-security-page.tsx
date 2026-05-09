import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SettingsPage, SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useAuthUser } from "@/lib/hooks/use-queries";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { cn } from "@/lib/utils";

const passwordRequirements = [
  { regex: /.{8,}/, text: "Al menos 8 caracteres" },
  { regex: /[a-z]/, text: "Al menos 1 letra minúscula" },
  { regex: /[A-Z]/, text: "Al menos 1 letra mayúscula" },
  { regex: /[0-9]/, text: "Al menos 1 número" },
  {
    regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    text: "Al menos 1 carácter especial",
  },
];

function getStrengthColor(score: number) {
  if (score === 0) return "bg-border";
  if (score <= 1) return "bg-destructive";
  if (score <= 2) return "bg-orange-500";
  if (score <= 3) return "bg-amber-500";
  if (score === 4) return "bg-yellow-400";
  return "bg-green-500";
}

function getStrengthText(score: number) {
  if (score === 0) return "Ingresa una contraseña";
  if (score <= 2) return "Contraseña débil";
  if (score <= 3) return "Contraseña media";
  if (score === 4) return "Contraseña fuerte";
  return "Contraseña muy fuerte";
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const passwordStrength = passwordRequirements.map((requirement) => ({
    met: requirement.regex.test(password),
    text: requirement.text,
  }));
  const passwordStrengthScore = passwordStrength.filter((requirement) => requirement.met).length;

  return (
    <div className="space-y-1 pt-1">
      <div className="flex h-1 w-full gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-full flex-1 rounded-full transition-all duration-300 ease-out",
              index < passwordStrengthScore ? getStrengthColor(passwordStrengthScore) : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-sm font-medium">{getStrengthText(passwordStrengthScore)}.</p>
      <ul className="space-y-1">
        {passwordStrength.map((requirement) => (
          <li key={requirement.text} className="flex items-center gap-2">
            {requirement.met ? (
              <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
            ) : (
              <XIcon className="text-muted-foreground size-4" />
            )}
            <span
              className={cn(
                "text-xs",
                requirement.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
              )}
            >
              {requirement.text}
              <span className="sr-only">
                {requirement.met ? " - Requisito cumplido" : " - Requisito pendiente"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SecurityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: authUser, isLoading } = useAuthUser();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isLoadingMfa, setIsLoadingMfa] = useState(false);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [verifiedTotpFactorId, setVerifiedTotpFactorId] = useState<string | null>(null);
  const [totpEnrollment, setTotpEnrollment] = useState<{
    id: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isSigningOutGlobally, setIsSigningOutGlobally] = useState(false);
  const canSavePassword = newPassword.length >= 8 && newPassword === confirmPassword;
  const canVerifyMfaEnrollment = totpCode.length === 6 && !!totpEnrollment;

  useEffect(() => {
    if (!authUser) return;
    void loadMfaFactors();
  }, [authUser]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="py-12 text-center">
        <ShieldIcon className="text-muted-foreground mx-auto mb-4 size-12" />
        <h3 className="mb-2 text-lg font-semibold">Inicia sesión para acceder a seguridad</h3>
        <p className="text-muted-foreground mx-auto mb-6 max-w-md">
          Necesitas estar autenticado para cambiar tu contraseña y configurar opciones de seguridad.
        </p>
        <Button asChild>
          <a href="/auth/signin">Iniciar sesión</a>
        </Button>
      </div>
    );
  }

  async function handlePasswordReset() {
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsSendingPasswordReset(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Contraseña actualizada correctamente");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar contraseña");
    } finally {
      setIsSendingPasswordReset(false);
    }
  }

  async function loadMfaFactors() {
    setIsLoadingMfa(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verifiedFactor = data.totp.find((factor) => factor.status === "verified") ?? null;
      setVerifiedTotpFactorId(verifiedFactor?.id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar 2FA");
    } finally {
      setIsLoadingMfa(false);
    }
  }

  async function handleStartMfaEnrollment() {
    setIsEnrollingMfa(true);
    setTotpCode("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const pendingFactors = factors.totp.filter(
        (factor) => (factor.status as string) !== "verified",
      );
      for (const pendingFactor of pendingFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: pendingFactor.id,
        });
        if (unenrollError) throw unenrollError;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Claustrum ${Date.now()}`,
      });
      if (error) throw error;

      setTotpEnrollment({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar 2FA");
    } finally {
      setIsEnrollingMfa(false);
    }
  }

  async function handleCancelMfaEnrollment() {
    const pendingFactorId = totpEnrollment?.id;
    setTotpEnrollment(null);
    setTotpCode("");
    if (!pendingFactorId) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar 2FA");
    }
  }

  async function handleCopyTotpSecret() {
    if (!totpEnrollment?.secret) return;
    await navigator.clipboard.writeText(totpEnrollment.secret);
    toast.success("Clave copiada");
  }

  async function handleVerifyMfaEnrollment() {
    if (!totpEnrollment || !canVerifyMfaEnrollment) return;

    setIsVerifyingMfa(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpEnrollment.id,
        code: totpCode,
      });
      if (error) throw error;

      toast.success("Autenticación de dos factores activada");
      setTotpEnrollment(null);
      setTotpCode("");
      await loadMfaFactors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setIsVerifyingMfa(false);
    }
  }

  async function handleDisableMfa() {
    if (!verifiedTotpFactorId) return;

    setIsDisablingMfa(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedTotpFactorId });
      if (error) throw error;

      toast.success("Autenticación de dos factores desactivada");
      setVerifiedTotpFactorId(null);
      setTotpEnrollment(null);
      setTotpCode("");
      await loadMfaFactors();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desactivar 2FA");
    } finally {
      setIsDisablingMfa(false);
    }
  }

  async function handleGlobalSignOut() {
    setIsSigningOutGlobally(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;

      queryClient.clear();
      void navigate({ to: "/auth/signin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cerrar sesiones");
      setIsSigningOutGlobally(false);
    }
  }

  return (
    <SettingsPage
      title="Seguridad"
      description="Protege tu cuenta y prepara controles adicionales de acceso."
    >
      <SettingsSection
        title="Contraseña"
        description="Credencial principal para acceder a tu cuenta."
      >
        <div className="max-w-md space-y-4">
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="new-password"
                  type={isNewPasswordVisible ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setIsNewPasswordVisible((value) => !value)}
                    aria-label={isNewPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 cursor-pointer rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {isNewPasswordVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <PasswordStrengthIndicator password={newPassword} />
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="confirm-password"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <InputGroupAddon align="inline-end">
                  <button
                    type="button"
                    onClick={() => setIsConfirmPasswordVisible((value) => !value)}
                    aria-label={
                      isConfirmPasswordVisible ? "Ocultar confirmación" : "Mostrar confirmación"
                    }
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 cursor-pointer rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {isConfirmPasswordVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handlePasswordReset}
              disabled={isSendingPasswordReset || !canSavePassword}
            >
              {isSendingPasswordReset && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Autenticación de dos factores"
        description="Una capa adicional para proteger el inicio de sesión."
      >
        <div className="max-w-md space-y-4">
          {isLoadingMfa ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Cargando configuración de 2FA…
            </div>
          ) : verifiedTotpFactorId ? (
            <>
              <div className="bg-muted/50 rounded-md p-4 text-sm">
                <p className="font-medium">2FA está activado</p>
                <p className="text-muted-foreground mt-1">
                  Se pedirá un código de tu aplicación autenticadora al iniciar sesión.
                </p>
              </div>
              <Button variant="outline" onClick={handleDisableMfa} disabled={isDisablingMfa}>
                {isDisablingMfa && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                Desactivar 2FA
              </Button>
            </>
          ) : totpEnrollment ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">1. Escanea el código</p>
                  <p className="text-muted-foreground text-sm">
                    Usa Google Authenticator, 1Password, Authy o cualquier app compatible con TOTP.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-[176px_minmax(0,1fr)] sm:items-start">
                  <img
                    src={totpEnrollment.qrCode}
                    alt="Código QR para configurar 2FA"
                    className="size-44 rounded-md bg-white p-2"
                  />
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Clave manual</p>
                      <p className="text-muted-foreground text-sm">
                        Úsala si no puedes escanear el QR.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <code className="bg-muted text-muted-foreground min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs break-all">
                        {totpEnrollment.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => void handleCopyTotpSecret()}
                        aria-label="Copiar clave manual"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <CopyIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">2. Verifica el código</p>
                  <p className="text-muted-foreground text-sm">
                    Ingresa el código de 6 dígitos para terminar la configuración.
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="totp-enrollment-code">Código de autenticación</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="totp-enrollment-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={totpCode}
                      onChange={(event) =>
                        setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      autoComplete="one-time-code"
                    />
                  </InputGroup>
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => void handleCancelMfaEnrollment()}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleVerifyMfaEnrollment}
                  disabled={!canVerifyMfaEnrollment || isVerifyingMfa}
                >
                  {isVerifyingMfa && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                  Activar 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 space-y-4 rounded-md p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Autenticación de dos factores desactivada</p>
                <p className="text-muted-foreground text-sm">
                  Protege tu cuenta con una app autenticadora antes de acceder a tus datos.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleStartMfaEnrollment}
                disabled={isEnrollingMfa}
              >
                {isEnrollingMfa && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                Activar autenticación de dos factores
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sesiones activas"
        description="Dispositivos donde tu cuenta tiene sesión iniciada."
      >
        <div className="max-w-md">
          <Button
            variant="destructive"
            onClick={handleGlobalSignOut}
            disabled={isSigningOutGlobally}
          >
            {isSigningOutGlobally && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Cerrar sesión en todos los dispositivos
          </Button>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
