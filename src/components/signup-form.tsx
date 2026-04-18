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
import {
  AlertCircleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

const passwordRequirements = [
  { regex: /.{8,}/, text: "Al menos 8 caracteres" },
  { regex: /[a-z]/, text: "Al menos 1 letra minúscula" },
  { regex: /[A-Z]/, text: "Al menos 1 letra mayúscula" },
  { regex: /[0-9]/, text: "Al menos 1 número" },
  {
    regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,
    text: "Al menos 1 carácter especial",
  },
]

function getStrengthColor(score: number) {
  if (score === 0) return "bg-border"
  if (score <= 1) return "bg-destructive"
  if (score <= 2) return "bg-orange-500"
  if (score <= 3) return "bg-amber-500"
  if (score === 4) return "bg-yellow-400"
  return "bg-green-500"
}

function getStrengthText(score: number) {
  if (score === 0) return "Ingresa una contraseña"
  if (score <= 2) return "Contraseña débil"
  if (score <= 3) return "Contraseña media"
  if (score === 4) return "Contraseña fuerte"
  return "Contraseña muy fuerte"
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const passwordStrength = useMemo(
    () =>
      passwordRequirements.map((requirement) => ({
        met: requirement.regex.test(password),
        text: requirement.text,
      })),
    [password]
  )

  const passwordStrengthScore = useMemo(
    () => passwordStrength.filter((requirement) => requirement.met).length,
    [passwordStrength]
  )

  const validateFields = () => {
    let hasError = false

    if (!name.trim()) {
      setNameError("Ingresa tu nombre completo.")
      hasError = true
    } else {
      setNameError(null)
    }

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
      setPasswordError("Ingresa una contraseña.")
      hasError = true
    } else if (password.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.")
      hasError = true
    } else {
      setPasswordError(null)
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Confirma tu contraseña.")
      hasError = true
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Las contraseñas no coinciden.")
      hasError = true
    } else {
      setConfirmPasswordError(null)
    }

    return !hasError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!validateFields()) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      })

      if (error) {
        setFormError(normalizeAuthError(error, "signup").message)
        return
      }

      if (data.session) {
        // Invalidate auth query to refresh user state immediately
        await queryClient.invalidateQueries({ queryKey: ["authUser"] })
        navigate({ to: "/" })
      } else {
        navigate({ to: "/verify-email" })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Completa el formulario para crear tu cuenta
          </p>
        </div>
        {formError && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se pudo crear la cuenta</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder="Juan Pérez"
            required
            value={name}
            aria-invalid={Boolean(nameError)}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(null)
              setFormError(null)
            }}
          />
          <FieldError>{nameError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@ejemplo.com"
            required
            value={email}
            aria-invalid={Boolean(emailError)}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
              setFormError(null)
            }}
          />
          <FieldError>{emailError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={isPasswordVisible ? "text" : "password"}
              required
              value={password}
              aria-invalid={Boolean(passwordError)}
              className="pr-10"
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(null)
                setConfirmPasswordError(null)
                setFormError(null)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-0 hover:bg-transparent"
              onClick={() => setIsPasswordVisible((current) => !current)}
            >
              {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              <span className="sr-only">
                {isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
              </span>
            </Button>
          </div>
          <FieldError>{passwordError}</FieldError>
          <div className="space-y-2">
            <div className="flex h-1 w-full gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-full flex-1 rounded-full transition-all duration-300 ease-out",
                    index < passwordStrengthScore
                      ? getStrengthColor(passwordStrengthScore)
                      : "bg-border"
                  )}
                />
              ))}
            </div>
            <p className="text-sm font-medium">
              {getStrengthText(passwordStrengthScore)}.
            </p>
            <ul className="space-y-1.5">
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
                      requirement.met
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {requirement.text}
                    <span className="sr-only">
                      {requirement.met
                        ? " - Requisito cumplido"
                        : " - Requisito pendiente"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
          <div className="relative">
            <Input
              id="confirm-password"
              type={isConfirmPasswordVisible ? "text" : "password"}
              required
              value={confirmPassword}
              aria-invalid={Boolean(confirmPasswordError)}
              className="pr-10"
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setConfirmPasswordError(null)
                setFormError(null)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-0 hover:bg-transparent"
              onClick={() =>
                setIsConfirmPasswordVisible((current) => !current)
              }
            >
              {isConfirmPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
              <span className="sr-only">
                {isConfirmPasswordVisible
                  ? "Ocultar confirmación de contraseña"
                  : "Mostrar confirmación de contraseña"}
              </span>
            </Button>
          </div>
          <FieldError>{confirmPasswordError}</FieldError>
          <FieldDescription>Por favor confirma tu contraseña.</FieldDescription>
        </Field>
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="px-6 text-center">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Inicia sesión
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
