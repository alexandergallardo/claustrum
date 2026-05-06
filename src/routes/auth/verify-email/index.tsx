import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, CheckCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const VERIFY_EMAIL_KEY = "claustrum.auth.verify_email";

export const Route = createFileRoute("/auth/verify-email/")({
  component: VerifyEmailPage,
});

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "pending">("loading");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = window.sessionStorage.getItem(VERIFY_EMAIL_KEY);
    if (storedEmail) {
      setEmail(storedEmail);
    }

    const checkSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setStatus("pending");
          return;
        }

        if (session?.user?.email) {
          setEmail(session.user.email);
          window.sessionStorage.setItem(VERIFY_EMAIL_KEY, session.user.email);
        }

        if (session) {
          setStatus("success");
          setTimeout(() => {
            void navigate({ to: "/" });
          }, 2000);
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("pending");
      }
    };

    void checkSession();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        if (session.user?.email) {
          setEmail(session.user.email);
          window.sessionStorage.setItem(VERIFY_EMAIL_KEY, session.user.email);
        }
        setStatus("success");
        setTimeout(() => {
          void navigate({ to: "/" });
        }, 2000);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleResendEmail = async () => {
    if (!email) {
      setResendError("No se puede reenviar el correo");
      return;
    }

    setResending(true);
    setResendError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const trimmedEmail = email.trim();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
      });

      if (error) {
        setResendError(error.message);
      } else {
        setResendSuccess(true);
      }
    } catch {
      setResendError("Ocurrió un error inesperado");
    } finally {
      setResending(false);
    }
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isPending = status === "pending";

  const title = isLoading
    ? "Verificando tu correo"
    : isSuccess
      ? "¡Correo verificado!"
      : "Revisa tu correo";
  const description = isLoading
    ? "Esto solo tomará un momento."
    : isSuccess
      ? "Redirigiendo a tu panel..."
      : "Enviamos un enlace de verificación a";

  return (
    <>
      <div className="w-full text-center">
        <div
          className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ${
            isSuccess ? "bg-emerald-500/10" : "bg-primary/10"
          }`}
        >
          {isLoading ? (
            <RefreshCw className="text-muted-foreground size-7 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle className="size-7 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Mail className="text-primary size-7" />
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <CardDescription className="text-center">
          {isPending ? (
            <>
              {description} {email ?? "tu correo"}.
            </>
          ) : (
            description
          )}
        </CardDescription>
        <div className="mt-4 flex flex-col gap-4">
          {isPending && (
            <p className="text-muted-foreground mx-auto max-w-sm text-center text-sm">
              ¿No lo recibiste? Revisa spam o promociones.
            </p>
          )}

          {isPending &&
            (resendSuccess ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <p>Correo enviado correctamente. Por favor revisa tu bandeja de entrada.</p>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={resending}
                >
                  <RefreshCw className={`mr-2 size-4 ${resending ? "animate-spin" : ""}`} />
                  Reenviar correo de verificación
                </Button>
                {resending && (
                  <p className="text-muted-foreground text-center text-xs">Enviando...</p>
                )}
              </>
            ))}

          {isPending && resendError && (
            <p className="text-destructive text-center text-sm">{resendError}</p>
          )}

          {isPending && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth/signin" })}>
                Volver a inicio de sesión
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
