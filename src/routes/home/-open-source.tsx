import { BoxIcon } from "./-icons";

const OSS_CARDS = [
  {
    title: "Licencia MIT",
    body: "El código es libre. Podés usarlo, modificarlo y distribuirlo sin restricciones.",
  },
  {
    title: "Sin anuncios ni rastreo",
    body: "No hay monetización. Los datos se manejan con el mínimo necesario y nunca se venden.",
  },
  {
    title: "Contribuciones abiertas",
    body: "Si querés agregar una carrera, mejorar el diseño o reportar un bug, los PRs son bienvenidos.",
  },
];

export function OpenSourceSection() {
  return (
    <section id="opensource">
      <div className="mx-auto max-w-[1100px] px-5 py-[80px] md:px-6 md:py-[120px]">
        <div className="mb-14">
          <div className="mb-[14px] flex items-center gap-[10px] font-mono text-[11px] tracking-[0.08em] text-[#A6841C] uppercase before:block before:h-px before:w-4 before:bg-[#C9A227]">
            Open Source
          </div>
          <h2 className="mb-3 text-[clamp(24px,3.5vw,32px)] leading-[1.2] font-semibold tracking-[-0.02em]">
            Un proyecto independiente, de código abierto
          </h2>
          <p className="text-muted-foreground max-w-[520px] text-[16px] leading-[1.55]">
            Claustrum no está afiliado al ITCR. Es una iniciativa de un estudiante, mantenida con
            recursos gratuitos y mejorada por quien quiera contribuir.
          </p>
        </div>

        <div className="bg-border grid gap-px md:grid-cols-3">
          {OSS_CARDS.map((card) => (
            <div
              key={card.title}
              className="bg-card hover:bg-accent/50 px-8 py-9 transition-colors"
            >
              <h4 className="mb-[10px] flex items-center gap-2.5 text-[14px] font-semibold">
                <BoxIcon className="size-4 text-[#A6841C]" />
                {card.title}
              </h4>
              <p className="text-muted-foreground text-[13px] leading-[1.5]">{card.body}</p>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground/80 mx-auto mt-12 max-w-[700px] text-center font-mono text-[12px] leading-[1.5]">
          Este proyecto no está afiliado, respaldado ni representa oficialmente al Instituto
          Tecnológico de <span className="whitespace-nowrap">Costa Rica.</span>
        </p>
      </div>
    </section>
  );
}
