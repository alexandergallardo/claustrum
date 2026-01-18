import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Mail, CheckCircle, RefreshCw } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

  if (status === "loading") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="animate-spin">
              <RefreshCw className="size-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-10">
        <Card className="w-full max-w-md border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <CheckCircle className="size-14 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
              Email verified!
            </h2>
            <p className="text-emerald-700 dark:text-emerald-300 text-center">
              Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent a verification link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p>Click the link in the email to verify your account. If you don&apos;t see the email, check your spam folder.</p>
          </div>

          {resendSuccess ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <p>Email sent successfully! Please check your inbox.</p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendEmail}
              disabled={resending}
            >
              {resending ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Resend verification email
                </>
              )}
            </Button>
          )}

          {resendError && (
            <p className="text-sm text-destructive text-center">{resendError}</p>
          )}

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/login" })}>
              Back to login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
