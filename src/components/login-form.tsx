import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useNavigate, Link } from "@tanstack/react-router"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"
import { useQueryClient } from "@tanstack/react-query"
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
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      // Invalidate auth query to refresh user state immediately
      await queryClient.invalidateQueries({ queryKey: ["authUser"] })
      
      navigate({ to: "/app" })
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
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@ejemplo.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}
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
