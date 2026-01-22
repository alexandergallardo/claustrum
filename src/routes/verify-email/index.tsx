import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Mail, CheckCircle, RefreshCw } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/verify-email/")({
  component: VerifyEmailPage,
})

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<"loading" | "success" | "pending">("loading")
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Error checking session:", error)
          setStatus("pending")
          return
        }

        if (session?.user?.email) {
          setEmail(session.user.email)
        }

        if (session) {
          setStatus("success")
          setTimeout(() => {
            navigate({ to: "/app" })
          }, 2000)
        } else {
          setStatus("pending")
        }
      } catch (err) {
        console.error("Unexpected error:", err)
        setStatus("pending")
      }
    }

    checkSession()

    const supabase = getSupabaseBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        if (session.user?.email) {
          setEmail(session.user.email)
        }
        setStatus("success")
        setTimeout(() => {
          navigate({ to: "/app" })
        }, 2000)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  const handleResendEmail = async () => {
    if (!email) {
      setResendError("Unable to resend email")
      return
    }

    setResending(true)
    setResendError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      })

      if (error) {
        setResendError(error.message)
      } else {
        setResendSuccess(true)
      }
    } catch (err) {
      setResendError("An unexpected error occurred")
    } finally {
      setResending(false)
    }
  }

  const isLoading = status === "loading"
  const isSuccess = status === "success"
  const isPending = status === "pending"

  const title = isLoading ? "Verifying your email" : isSuccess ? "Email verified!" : "Check your email"
  const description = isLoading
    ? "This should only take a moment."
    : isSuccess
      ? "Redirecting to your dashboard..."
      : "We sent a verification link to"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div
            className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ${
              isSuccess ? "bg-emerald-500/10" : "bg-primary/10"
            }`}
          >
            {isLoading ? (
              <RefreshCw className="size-7 animate-spin text-muted-foreground" />
            ) : isSuccess ? (
              <CheckCircle className="size-7 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Mail className="size-7 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-center">
            {isPending ? (
              <>
                {description} {email ?? "your email"}.
              </>
            ) : (
              description
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPending && (
            <p className="mx-auto max-w-sm text-center text-sm text-muted-foreground">
              Didn&apos;t get it? Check spam or promotions.
            </p>
          )}

          {isPending &&
            (resendSuccess ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <p>Email sent successfully! Please check your inbox.</p>
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
                  Resend verification email
                </Button>
                {resending && (
                  <p className="text-center text-xs text-muted-foreground">Sending...</p>
                )}
              </>
            ))}

          {isPending && resendError && (
            <p className="text-center text-sm text-destructive">{resendError}</p>
          )}

          {isPending && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/login" })}>
                Back to login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
