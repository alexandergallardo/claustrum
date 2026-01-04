import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldIcon, LockIcon, Loader2Icon, SmartphoneIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export const Route = createFileRoute("/app/settings/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthUser(user ?? null);
      setIsLoading(false);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <ShieldIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Inicia sesión para acceder a seguridad</h3>
            <p className="text-muted-foreground mb-6">
              Necesitas estar autenticado para cambiar tu contraseña y configurar opciones de seguridad.
            </p>
            <Button asChild>
              <a href="/login">Iniciar sesión</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handlePasswordReset() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      toast.error("No se puede restablecer la contraseña");
      return;
    }

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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Contraseña actualizada correctamente");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar contraseña");
    } finally {
      setIsSendingPasswordReset(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <LockIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Contraseña</CardTitle>
              <CardDescription>Gestiona tu contraseña de cuenta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Usa una contraseña larga y única para proteger tu cuenta.
          </p>

          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button>Cambiar contraseña</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambiar contraseña</DialogTitle>
                <DialogDescription>
                  Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Field>
                  <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePasswordReset} disabled={isSendingPasswordReset}>
                  {isSendingPasswordReset && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <SmartphoneIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Autenticación de dos factores</CardTitle>
              <CardDescription>Añade una capa adicional de seguridad</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La autenticación de dos factores (2FA) añade una capa adicional de seguridad
            a tu cuenta, requiriendo un código adicional además de tu contraseña.
          </p>

          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <SmartphoneIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Próximamente</p>
                <p className="text-sm text-muted-foreground">
                  La autenticación de dos factores estará disponible próximamente.
                  Te notificaremos cuando esta función esté lista.
                </p>
              </div>
            </div>
          </div>

          <Button variant="outline" disabled>
            <ShieldIcon className="mr-2 h-4 w-4" />
            Configurar 2FA
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones activas</CardTitle>
          <CardDescription>Gestiona tus sesiones en otros dispositivos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta funcionalidad estará disponible próximamente.
          </p>

          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Podrás ver y cerrar sesiones activas en otros dispositivos desde aquí.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
