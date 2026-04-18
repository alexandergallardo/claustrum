import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useNavigate, Link } from "@tanstack/react-router"
import { normalizeAuthError } from "@/lib/auth/auth-error-messages"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircleIcon } from "lucide-react"
import { useState } from "react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [credentialError, setCredentialError] = useState(false)

  const validateFields = () => {
    let hasError = false

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setEmailError("Ingresa tu correo electrónico.")
      hasError = true
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setEmailError("Ingresa un correo electrónico válido.")
      hasError = true
    } else {
      setEmailError(null)
    }

    if (!password) {
      setPasswordError("Ingresa tu contraseña.")
      hasError = true
    } else {
      setPasswordError(null)
    }

    return !hasError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setCredentialError(false)

    if (!validateFields()) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const normalizedError = normalizeAuthError(error, "login")
        setFormError(normalizedError.message)
        if (normalizedError.type === "invalid_credentials") {
          setCredentialError(true)
        }
        return
      }

      // Invalidate auth query to refresh user state immediately
      await queryClient.invalidateQueries({ queryKey: ["authUser"] })

      navigate({ to: "/" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Inicia sesión en tu cuenta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Ingresa tu correo electrónico para iniciar sesión
          </p>
        </div>
        {formError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se pudo iniciar sesión</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@ejemplo.com"
            required
            value={email}
            aria-invalid={Boolean(emailError || credentialError)}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
              setFormError(null)
              setCredentialError(false)
            }}
          />
          <FieldError>{emailError}</FieldError>
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            aria-invalid={Boolean(passwordError || credentialError)}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(null)
              setFormError(null)
              setCredentialError(false)
            }}
          />
          <FieldError>{passwordError}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            ¿No tienes una cuenta?{" "}
            <Link to="/signup" className="underline underline-offset-4">
              Regístrate
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
