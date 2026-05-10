import {
  IconBrandCloudflare,
  IconBrandReact,
  IconBrandSupabase,
  IconBrandTailwind,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

export const Route = createFileRoute("/home")({ component: HomePage });

function HomePage() {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);

  const handleSectionClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    if (!href?.startsWith("#")) return;
    const section = document.querySelector(href);
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem("home-theme");
    if (saved === "dark") setIsDark(true);
    else if (saved === "light") setIsDark(false);
    else setIsDark(globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false);

    let mounted = true;
    void fetch("https://api.github.com/repos/mau671/claustrum")
      .then((r) => r.json() as Promise<{ stargazers_count?: number }>)
      .then((data) => {
        if (mounted && typeof data.stargazers_count === "number")
          setStarCount(data.stargazers_count);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    globalThis.localStorage?.setItem("home-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <div
      className={`relative [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',system-ui,sans-serif] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[size:40px_40px] before:opacity-60 ${isDark ? "bg-[#0B1020] text-[#E2E8F0] before:bg-[linear-gradient(to_right,#1F2937_1px,transparent_1px),linear-gradient(to_bottom,#1F2937_1px,transparent_1px)]" : "bg-[#F6F5F2] text-[#0F172A] before:bg-[linear-gradient(to_right,#E2DFD8_1px,transparent_1px),linear-gradient(to_bottom,#E2DFD8_1px,transparent_1px)]"}`}
    >
      <div className="relative z-10">
        <nav
          className={`fixed inset-x-0 top-0 z-[100] border-b backdrop-blur-[12px] ${isDark ? "border-[#334155] bg-[rgba(11,16,32,0.92)]" : "border-[#D4D0C8] bg-[rgba(246,245,242,0.95)]"}`}
        >
          <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-5 md:h-16 md:px-6">
            <a
              href="#"
              className="flex items-center gap-[10px] text-[15px] font-semibold tracking-[-0.01em] no-underline"
            >
              <Logo
                className="h-[26px] w-[26px] shrink-0"
                main={isDark ? "#E2E8F0" : "#0F172A"}
                accent="#C9A227"
              />
              Claustrum
            </a>
            <ul className="hidden list-none gap-8 md:flex">
              <li>
                <a
                  href="#funciones"
                  onClick={handleSectionClick}
                  className={`relative font-mono text-[13px] font-[450] tracking-[0.02em] no-underline transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[#C9A227] after:transition-transform after:duration-200 hover:after:scale-x-100 ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
                >
                  Funciones
                </a>
              </li>
              <li>
                <a
                  href="#stack"
                  onClick={handleSectionClick}
                  className={`relative font-mono text-[13px] font-[450] tracking-[0.02em] no-underline transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[#C9A227] after:transition-transform after:duration-200 hover:after:scale-x-100 ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
                >
                  Tecnología
                </a>
              </li>
              <li>
                <a
                  href="#opensource"
                  onClick={handleSectionClick}
                  className={`relative font-mono text-[13px] font-[450] tracking-[0.02em] no-underline transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-[#C9A227] after:transition-transform after:duration-200 hover:after:scale-x-100 ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
                >
                  Open Source
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
                onClick={() => setIsDark((prev) => !prev)}
                className={`inline-flex items-center rounded-md border p-2 transition-colors ${isDark ? "border-[#334155] bg-[#111827] text-[#E2E8F0] hover:bg-[#1F2937]" : "border-[#D4D0C8] bg-white text-[#0F172A] hover:bg-[#FAFAF8]"}`}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <a
                href="https://claustrum.maugp.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center rounded-md border px-4 py-2 font-mono text-[12px] font-medium tracking-[0.01em] no-underline transition-colors ${isDark ? "border-[#334155] hover:border-[#94A3B8] hover:bg-[#1F2937]" : "border-[#D4D0C8] hover:border-[#64748B] hover:bg-white"}`}
              >
                Abrir
              </a>
              <a
                href="https://github.com/mau671/claustrum"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0F172A] px-4 py-2 font-mono text-[12px] font-medium tracking-[0.01em] text-white no-underline transition-colors hover:bg-[#1e293b]"
              >
                <GitHubIcon className="size-[13px]" /> GitHub
                <span className="ml-1 inline-flex items-center justify-center gap-[3px] rounded-full bg-[rgba(255,255,255,0.15)] px-[6px] pt-[2px] pb-[1px] font-mono text-[10px] leading-none">
                  <StarIcon className="size-[9px] -translate-y-px" />
                  <span className="leading-none">{starCount ?? "-"}</span>
                </span>
              </a>
            </div>
          </div>
        </nav>

        <section className="overflow-hidden">
          <div className="mx-auto max-w-[1100px] px-5 pt-[140px] pb-[60px] md:px-6 md:pt-[180px] md:pb-[100px]">
            <div className="mb-6 font-mono text-[12px] tracking-[0.04em] text-[#A6841C]">
              v1.0 <span className={`mx-2 ${isDark ? "text-[#334155]" : "text-[#D4D0C8]"}`}>/</span>{" "}
              ITCR <span className={`mx-2 ${isDark ? "text-[#334155]" : "text-[#D4D0C8]"}`}>/</span>{" "}
              Open Source
            </div>
            <h1 className="mb-7 max-w-[680px] [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Segoe_UI',system-ui,sans-serif] text-[clamp(42px,6.5vw,72px)] leading-[1.05] font-semibold tracking-[-0.03em]">
              Planifica tu carrera sin perder tiempo en{" "}
              <span className="text-[#A6841C]">hojas de cálculo</span>.
            </h1>
            <p
              className={`mb-10 max-w-[480px] text-[17px] leading-[1.6] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
            >
              Claustrum centraliza todo lo que necesitás como estudiante del TEC: horarios, malla
              curricular, evaluaciones de cursos y reseñas de profesores. Sin anuncios. Sin
              fricción.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="https://claustrum.maugp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0F172A] px-6 py-3 text-[13px] font-medium text-white no-underline transition-colors hover:bg-[#1e293b] sm:w-auto"
              >
                Probar la app <ArrowRight className="size-[15px]" />
              </a>
              <a
                href="https://github.com/mau671/claustrum"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex w-full items-center justify-center gap-2 rounded-md border bg-transparent px-6 py-3 text-[13px] font-medium no-underline transition-colors sm:w-auto ${isDark ? "border-[#334155] hover:border-[#94A3B8] hover:bg-[#111827]" : "border-[#D4D0C8] hover:border-[#64748B] hover:bg-white"}`}
              >
                <GitHubIcon className="size-[15px]" /> Ver código fuente{" "}
                <span
                  className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] ${isDark ? "bg-[#1F2937]" : "bg-[#F1F5F9]"}`}
                >
                  <StarIcon className="size-[9px]" />
                  {starCount ?? "-"}
                </span>
              </a>
            </div>
          </div>
        </section>

        <div
          className={`mx-auto h-px max-w-[1100px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />

        <section>
          <div className="mx-auto max-w-[1100px] px-5 pt-0 pb-0 md:px-6">
            <div
              className={`grid border-y md:grid-cols-3 ${isDark ? "border-[#334155]" : "border-[#D4D0C8]"}`}
            >
              {[
                [
                  "01",
                  "Creador de horarios",
                  "Armá tu horario semanal arrastrando grupos. Visualización en calendario, detección de conflictos y exportación a ICS.",
                ],
                [
                  "02",
                  "Malla curricular",
                  "Explorá tu plan de estudios con requisitos, correquisitos y equivalencias visualizadas como grafo interactivo.",
                ],
                [
                  "03",
                  "Reseñas y evaluaciones",
                  "Consultá evaluaciones de cursos en PDF y leé reseñas anónimas de profesores antes de matricular.",
                ],
              ].map(([n, t, d], index) => (
                <div
                  key={n}
                  className={`px-6 py-10 md:px-9 md:py-14 ${index < 2 ? (isDark ? "md:border-r md:border-[#334155]" : "md:border-r md:border-[#D4D0C8]") : ""} ${index < 2 ? (isDark ? "border-b border-[#334155] md:border-b-0" : "border-b border-[#D4D0C8] md:border-b-0") : ""}`}
                >
                  <div className="mb-5 flex items-center gap-[10px] font-mono text-[11px] tracking-[0.06em] text-[#A6841C] before:block before:h-px before:w-4 before:bg-[#C9A227]">
                    {n}
                  </div>
                  <h3 className="mb-[10px] text-[17px] font-semibold tracking-[-0.01em]">{t}</h3>
                  <p
                    className={`text-[14px] leading-[1.55] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
                  >
                    {d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="funciones">
          <div className="mx-auto max-w-[1100px] px-5 py-[80px] md:px-6 md:py-[120px]">
            <div className="mb-14">
              <div className="mb-[14px] flex items-center gap-[10px] font-mono text-[11px] tracking-[0.08em] text-[#A6841C] uppercase before:block before:h-px before:w-4 before:bg-[#C9A227]">
                Funciones
              </div>
              <h2 className="mb-3 text-[clamp(24px,3.5vw,32px)] leading-[1.2] font-semibold tracking-[-0.02em]">
                Diseñado para estudiantes del TEC
              </h2>
              <p
                className={`max-w-[520px] text-[16px] leading-[1.55] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
              >
                Cada función resuelve un problema real del día a día en el TEC. Sin funciones de
                más, sin distracciones.
              </p>
            </div>

            <Feature
              watermark="01"
              label="Horarios"
              title="Armá tu horario en minutos"
              desc="Buscá cursos por nombre o código, filtrá por campus y grupo, y arrastrá directamente al calendario. El sistema detecta superposiciones automáticamente."
              bullets={[
                "Vista semanal con bloques de clase",
                "Filtros por carrera, campus y periodo",
                "Exportá como imagen o a tu app de calendario preferida",
              ]}
              reverse={false}
              visual={<ScheduleMock isDark={isDark} />}
              isDark={isDark}
            />

            <Feature
              watermark="02"
              label="Malla curricular"
              title="Visualizá tu progreso académico"
              desc="La malla se muestra como un grafo interactivo donde podés ver qué cursos ya cursaste, cuáles podés matricular ahora y cuáles faltan."
              bullets={[
                "Grafo de requisitos y correquisitos",
                "Detalle de cada curso con descripción",
                "Seguimiento de progreso por plan",
              ]}
              reverse
              visual={<GraphMock isDark={isDark} />}
              isDark={isDark}
            />

            <Feature
              watermark="03"
              label="Comunidad"
              title="Evaluaciones y reseñas de profesores"
              desc="Subí evaluaciones de cursos en PDF de forma anónima. Leé reseñas de otros estudiantes para decidir con quién matricular."
              bullets={[
                "Subida anónima de evaluaciones PDF",
                "Reseñas con moderación automática",
                "Protección anti-spam con Turnstile",
              ]}
              reverse={false}
              visual={<ReviewsMock isDark={isDark} />}
              isDark={isDark}
            />
          </div>
        </section>

        <div
          className={`mx-auto h-px max-w-[1100px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />

        <section id="stack" className="bg-[#0F172A] text-white">
          <div className="mx-auto max-w-[1100px] px-5 py-[80px] md:px-6 md:py-[120px]">
            <div className="mb-14 flex items-center gap-[10px] font-mono text-[11px] tracking-[0.08em] text-[#C9A227] uppercase before:block before:h-px before:w-4 before:bg-[#C9A227]">
              Stack técnico
            </div>
            <h2 className="mb-3 text-[clamp(24px,3.5vw,32px)] leading-[1.2] font-semibold tracking-[-0.02em]">
              Construido con herramientas modernas
            </h2>
            <p className="max-w-[620px] text-[16px] leading-[1.55] text-white/55">
              El frontend corre en Cloudflare Pages, la API en Cloudflare Workers y la base de datos
              en Supabase.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {[
                { name: "React 19", role: "Interfaz", icon: IconBrandReact },
                { name: "Tailwind CSS v4", role: "Estilos", icon: IconBrandTailwind },
                { name: "Cloudflare", role: "Hosting y API", icon: IconBrandCloudflare },
                { name: "Supabase", role: "Base de datos y Auth", icon: IconBrandSupabase },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="flex items-start gap-3 border-b border-white/15 pb-4"
                  >
                    <Icon className="mt-0.5 size-5 text-[#C9A227]" strokeWidth={1.8} />
                    <div>
                      <div className="text-[15px] font-semibold">{item.name}</div>
                      <div className="text-[13px] text-white/60">{item.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div
          className={`mx-auto h-px max-w-[1100px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />

        <section id="opensource">
          <div className="mx-auto max-w-[1100px] px-5 py-[80px] md:px-6 md:py-[120px]">
            <div className="mb-14">
              <div className="mb-[14px] flex items-center gap-[10px] font-mono text-[11px] tracking-[0.08em] text-[#A6841C] uppercase before:block before:h-px before:w-4 before:bg-[#C9A227]">
                Open Source
              </div>
              <h2 className="mb-3 text-[clamp(24px,3.5vw,32px)] leading-[1.2] font-semibold tracking-[-0.02em]">
                Un proyecto independiente, de código abierto
              </h2>
              <p
                className={`max-w-[520px] text-[16px] leading-[1.55] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
              >
                Claustrum no está afiliado al ITCR. Es una iniciativa de un estudiante, mantenida
                con recursos gratuitos y mejorada por quien quiera contribuir.
              </p>
            </div>

            <div
              className={`grid gap-px md:grid-cols-3 ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
            >
              {[
                [
                  "Licencia MIT",
                  "El código es libre. Podés usarlo, modificarlo y distribuirlo sin restricciones.",
                ],
                [
                  "Sin anuncios ni rastreo",
                  "No hay monetización. Los datos se manejan con el mínimo necesario y nunca se venden.",
                ],
                [
                  "Contribuciones abiertas",
                  "Si querés agregar una carrera, mejorar el diseño o reportar un bug, los PRs son bienvenidos.",
                ],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className={`px-8 py-9 transition-colors ${isDark ? "bg-[#111827] hover:bg-[#1F2937]" : "bg-white hover:bg-[#FAFAF8]"}`}
                >
                  <h4 className="mb-[10px] flex items-center gap-2.5 text-[14px] font-semibold">
                    <BoxIcon className="size-4 text-[#A6841C]" />
                    {title}
                  </h4>
                  <p
                    className={`text-[13px] leading-[1.5] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
                  >
                    {body}
                  </p>
                </div>
              ))}
            </div>

            <p
              className={`mx-auto mt-12 max-w-[700px] text-center font-mono text-[12px] leading-[1.5] ${isDark ? "text-[#94A3B8]/80" : "text-[#64748B]/80"}`}
            >
              Este proyecto no está afiliado, respaldado ni representa oficialmente al Instituto
              Tecnológico de <span className="whitespace-nowrap">Costa Rica.</span>
            </p>
          </div>
        </section>

        <div
          className={`mx-auto h-px max-w-[1100px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />

        <section className="overflow-hidden text-center">
          <div className="mx-auto max-w-[1100px] px-5 pt-[120px] pb-[80px] md:px-6 md:pt-[140px]">
            <h2 className="mb-4 text-[clamp(28px,4vw,40px)] leading-[1.15] font-semibold tracking-[-0.02em]">
              Empezá a usarlo hoy
            </h2>
            <p
              className={`mx-auto mb-8 max-w-[440px] text-[16px] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
            >
              Entrá con tu correo institucional, configurá tu carrera y empezá a planificar.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="https://claustrum.maugp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0F172A] px-6 py-3 text-[13px] font-medium text-white no-underline transition-colors hover:bg-[#1e293b]"
              >
                Abrir Claustrum <ArrowRight className="size-[15px]" />
              </a>
              <a
                href="https://github.com/mau671/claustrum"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 text-[13px] font-medium no-underline transition-colors ${isDark ? "border-[#334155] hover:border-[#94A3B8] hover:bg-[#111827]" : "border-[#D4D0C8] hover:border-[#64748B] hover:bg-white"}`}
              >
                <GitHubIcon className="size-[15px]" /> Ver en GitHub
              </a>
            </div>
          </div>
        </section>

        <footer
          className={`border-t px-5 py-10 md:px-6 ${isDark ? "border-[#334155] bg-[#0F172A]" : "border-[#D4D0C8] bg-white"}`}
        >
          <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-4 md:flex-row">
            <div
              className={`flex items-center gap-[10px] font-mono text-[12px] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
            >
              <Logo
                className="size-[18px]"
                main={isDark ? "#94A3B8" : "#6B6B6B"}
                accent="#A6841C"
              />
              Hecho con <HeartIcon className="inline size-[11px] align-[-1px] text-[#DC2626]" /> por{" "}
              <a
                href="https://maugp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Mauricio González Prendas
              </a>
            </div>
            <div className="flex gap-7">
              <a
                href="https://github.com/mau671/claustrum"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-mono text-[12px] tracking-[0.02em] no-underline ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                GitHub
              </a>
              <a
                href="https://claustrum.maugp.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-mono text-[12px] tracking-[0.02em] no-underline ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                Abrir app
              </a>
              <a
                href="https://github.com/mau671/claustrum/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-mono text-[12px] tracking-[0.02em] no-underline ${isDark ? "text-[#94A3B8] hover:text-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                MIT License
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Feature({
  watermark,
  label,
  title,
  desc,
  bullets,
  reverse,
  visual,
  isDark,
}: {
  watermark: string;
  label: string;
  title: string;
  desc: string;
  bullets: string[];
  reverse: boolean;
  visual: ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      className={`relative ${reverse ? "md:[direction:rtl]" : ""} ${reverse ? "mt-20 md:mt-[120px]" : ""}`}
    >
      <div
        className={`pointer-events-none absolute -top-10 -left-[10px] font-mono text-[clamp(100px,14vw,160px)] leading-none font-light select-none md:-left-[10px] ${isDark ? "text-[#E2E8F0]/[0.04]" : "text-[#0F172A]/[0.025]"}`}
      >
        {watermark}
      </div>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
        <div
          className={`relative pl-4 md:pl-6 ${reverse ? "md:[direction:ltr]" : ""} before:absolute before:top-1 before:bottom-1 before:left-0 before:w-px ${isDark ? "before:bg-[#334155]" : "before:bg-[#D4D0C8]"} after:absolute after:top-1 after:left-[-2px] after:size-[5px] after:rounded-full after:bg-[#C9A227]`}
        >
          <div className="mb-[14px] font-mono text-[11px] tracking-[0.08em] text-[#A6841C] uppercase">
            {label}
          </div>
          <h3 className="mb-[18px] text-[30px] leading-[1.15] font-semibold tracking-[-0.02em]">
            {title}
          </h3>
          <p
            className={`text-[15px] leading-[1.6] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
          >
            {desc}
          </p>
          <ul
            className={`mt-[14px] list-none pl-0 text-[15px] leading-[1.6] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
          >
            {bullets.map((item) => (
              <li
                key={item}
                className="relative mb-2 pl-4 before:absolute before:left-0 before:font-mono before:text-[11px] before:text-[#C9A227] before:content-['—']"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`relative aspect-[16/10] overflow-hidden border ${isDark ? "border-[#334155] bg-[#111827]" : "border-[#D4D0C8] bg-white"} ${reverse ? "md:[direction:ltr]" : ""} before:pointer-events-none before:absolute before:inset-2 before:border before:border-dashed ${isDark ? "before:border-[#334155]" : "before:border-[#D4D0C8]"}`}
        >
          {visual}
        </div>
      </div>
    </div>
  );
}

function ScheduleMock({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-7">
      <div
        className={`flex h-8 items-center gap-2 border px-3 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
      >
        <div className="size-[7px] rounded-full bg-[#C9A227]/40" />
        <div
          className={`h-[5px] w-[65%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
      </div>
      <div
        className={`flex h-8 items-center gap-2 border px-3 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
      >
        <div className="size-[7px] rounded-full bg-[#C9A227]/80" />
        <div
          className={`h-[5px] w-[85%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
      </div>
      <div className="flex flex-1 gap-2">
        <div
          className={`flex-1 border p-4 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
        >
          <div
            className={`mb-2 font-mono text-[10px] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
          >
            LUN 07:30
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`l-${i}`}
                className={`aspect-square border ${[0, 2, 6].includes(i) ? "border-[#C9A227] bg-[#C9A227]/12" : isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
              />
            ))}
          </div>
        </div>
        <div
          className={`flex-1 border p-4 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
        >
          <div
            className={`mb-2 font-mono text-[10px] ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}
          >
            MAR 09:00
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`m-${i}`}
                className={`aspect-square border ${[1, 4, 7].includes(i) ? "border-[#C9A227] bg-[#C9A227]/12" : isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphMock({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-7">
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <rect
          x="60"
          y="10"
          width="40"
          height="24"
          rx="6"
          fill={isDark ? "#0B1020" : "#F6F5F2"}
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <rect
          x="20"
          y="50"
          width="40"
          height="24"
          rx="6"
          fill={isDark ? "#0B1020" : "#F6F5F2"}
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <rect
          x="100"
          y="50"
          width="40"
          height="24"
          rx="6"
          fill={isDark ? "#0B1020" : "#F6F5F2"}
          stroke="#C9A227"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <rect
          x="40"
          y="90"
          width="40"
          height="24"
          rx="6"
          fill="#C9A227"
          opacity="0.12"
          stroke="#C9A227"
          strokeWidth="1.5"
        />
        <rect
          x="90"
          y="90"
          width="40"
          height="24"
          rx="6"
          fill={isDark ? "#0B1020" : "#F6F5F2"}
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <line
          x1="70"
          y1="34"
          x2="45"
          y2="50"
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <line
          x1="90"
          y1="34"
          x2="115"
          y2="50"
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <line
          x1="35"
          y1="74"
          x2="55"
          y2="90"
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
        <line
          x1="120"
          y1="74"
          x2="105"
          y2="90"
          stroke={isDark ? "#334155" : "#D4D0C8"}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function ReviewsMock({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-7">
      <div
        className={`border p-4 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className={`size-[26px] rounded-full ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`} />
          <div>
            <div
              className={`mb-1 h-[7px] w-20 rounded-[3px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
            />
            <div
              className={`h-[5px] w-[50px] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
            />
          </div>
        </div>
        <div
          className={`mb-1 h-[5px] w-[95%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
        <div
          className={`mb-1 h-[5px] w-[80%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
        <div
          className={`h-[5px] w-[60%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
      </div>
      <div
        className={`border p-4 ${isDark ? "border-[#334155] bg-[#0B1020]" : "border-[#D4D0C8] bg-[#F6F5F2]"}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className={`size-[26px] rounded-full ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`} />
          <div>
            <div
              className={`mb-1 h-[7px] w-[70px] rounded-[3px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
            />
            <div
              className={`h-[5px] w-10 rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
            />
          </div>
        </div>
        <div
          className={`mb-1 h-[5px] w-[90%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
        <div
          className={`h-[5px] w-[70%] rounded-[2px] ${isDark ? "bg-[#334155]" : "bg-[#D4D0C8]"}`}
        />
      </div>
    </div>
  );
}

function Logo({ className, main, accent }: { className?: string; main: string; accent: string }) {
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" className={className}>
      <path
        d="M190 48H78C61.431 48 48 61.431 48 78v100c0 16.569 13.431 30 30 30h112"
        fill="none"
        stroke={main}
        strokeWidth="20"
        strokeLinecap="round"
      />
      <rect
        x="84"
        y="84"
        width="88"
        height="88"
        rx="18"
        fill="none"
        stroke={accent}
        strokeWidth="14"
      />
    </svg>
  );
}
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}
