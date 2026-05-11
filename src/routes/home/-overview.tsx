const OVERVIEW_ITEMS = [
  {
    number: "01",
    title: "Creador de horarios",
    description:
      "Armá tu horario semanal arrastrando grupos. Visualización en calendario, detección de conflictos y exportación a ICS.",
  },
  {
    number: "02",
    title: "Malla curricular",
    description:
      "Explorá tu plan de estudios con requisitos, correquisitos y equivalencias visualizadas como grafo interactivo.",
  },
  {
    number: "03",
    title: "Reseñas y evaluaciones",
    description:
      "Consultá evaluaciones de cursos en PDF y leé reseñas anónimas de profesores antes de matricular.",
  },
];

export function OverviewSection() {
  return (
    <section>
      <div className="mx-auto max-w-[1100px] px-5 md:px-6">
        <div className="border-border grid md:grid-cols-3">
          {OVERVIEW_ITEMS.map((item, index) => (
            <div
              key={item.number}
              className={`px-6 py-10 md:px-9 md:py-14 ${index < 2 ? "border-border border-b md:border-r md:border-b-0" : ""}`}
            >
              <div className="mb-5 flex items-center gap-[10px] font-mono text-[11px] tracking-[0.06em] text-[#A6841C] before:block before:h-px before:w-4 before:bg-[#C9A227]">
                {item.number}
              </div>
              <h2 className="mb-[10px] text-[17px] font-semibold tracking-[-0.01em]">
                {item.title}
              </h2>
              <p className="text-muted-foreground text-[14px] leading-[1.55]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
