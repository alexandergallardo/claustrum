import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";

import { useIsMobile } from "@/hooks/use-mobile";
import { getTurnstileSiteKey } from "@/lib/env/public";
import { useSubmitFeedback } from "@/lib/feedback/hooks";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

const Turnstile = lazy(() =>
  import("@marsidev/react-turnstile").then((module) => ({ default: module.Turnstile })),
);

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = getTurnstileSiteKey();
  const submitMutation = useSubmitFeedback();

  const onCloseReset = () => {
    setTurnstileToken(null);
  };

  const form = useForm({
    defaultValues: {
      type: "" as "bug" | "feature" | "other" | "",
      content: "",
    },
    onSubmit: async ({ value }) => {
      if (turnstileSiteKey && !turnstileToken) {
        toast.error("Validación de seguridad", {
          description: "Por favor completa el captcha para continuar.",
        });
        return;
      }

      try {
        await submitMutation.mutateAsync({
          type: value.type as "bug" | "feature" | "other",
          content: value.content,
          turnstileToken: turnstileToken ?? "",
        });
        toast.success("Comentario enviado", {
          description: "¡Gracias por tomarte el tiempo para ayudarnos a mejorar!",
        });
        onOpenChange(false);
        form.reset();
        onCloseReset();
      } catch (error) {
        toast.error("Error al enviar", {
          description: error instanceof Error ? error.message : "Ocurrió un problema, inténtalo más tarde.",
        });
        setTurnstileToken(null);
      }
    },
  });

  const formContent = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6 px-6 pb-6 pt-2"
    >
      <form.Field
        name="type"
        validators={{
          onChange: z.enum(["bug", "feature", "other"], {
            message: "Por favor selecciona el tipo de comentario.",
          }),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>¿Qué tipo de comentario deseas enviar?</Label>
            <Select
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as any)}
            >
              <SelectTrigger id={field.name} onBlur={field.handleBlur}>
                <SelectValue placeholder="Selecciona una opción..." />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="bug">Reportar un error</SelectItem>
                <SelectItem value="feature">Sugerir una nueva funcionalidad</SelectItem>
                <SelectItem value="other">Otro comentario o duda general</SelectItem>
              </SelectContent>
            </Select>
            {field.state.meta.errors.length > 0 ? (
              <p className="text-destructive text-[0.8rem] font-medium">
                {field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : (e as any)?.message || "Valor inválido"))
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Field
        name="content"
        validators={{
          onChange: z
            .string()
            .trim()
            .min(5, "El comentario debe tener al menos 5 caracteres.")
            .max(2000, "El comentario no puede exceder los 2000 caracteres."),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Comentario</Label>
            <Textarea
              id={field.name}
              placeholder="Cuéntanos más detalles sobre tu sugerencia, duda o el problema que encontraste..."
              className="min-h-[150px] resize-y"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 ? (
              <p className="text-destructive text-[0.8rem] font-medium">
                {field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : (e as any)?.message || "Valor inválido"))
                  .join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {turnstileSiteKey ? (
            <Suspense fallback={null}>
              <Turnstile
                siteKey={turnstileSiteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{
                  theme: "auto",
                  size: "flexible",
                  appearance: "interaction-only",
                }}
              />
            </Suspense>
          ) : (
            <p className="text-muted-foreground text-xs">
              Turnstile no está configurado localmente.
            </p>
          )}
        </div>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || (!!turnstileSiteKey && !turnstileToken)}
              className="w-full sm:w-auto shrink-0"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );

  const TitleAndDescription = () => (
    <>
      <SheetTitle>Retroalimentación</SheetTitle>
      <SheetDescription>
        Ayúdanos a mejorar Claustrum enviando tus sugerencias o reportes de errores de forma completamente anónima.
      </SheetDescription>
    </>
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) onCloseReset();
        }}
      >
        <SheetContent side="bottom" className="max-h-[90vh] flex flex-col overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="px-6 pt-6 pb-2 text-left">
            <TitleAndDescription />
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">{formContent}</ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onCloseReset();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <TitleAndDescription />
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">{formContent}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
