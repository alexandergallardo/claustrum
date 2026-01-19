import { createFileRoute } from '@tanstack/react-router'
import { GalleryVerticalEnd } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export const Route = createFileRoute('/login/')({
  component: LoginPage,
})

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Claustrum
        </a>
      </div>
      <div className="w-full max-w-xs">
        <LoginForm />
      </div>
    </div>
  )
}
