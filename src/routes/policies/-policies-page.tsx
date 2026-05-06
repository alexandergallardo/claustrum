type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const sections: PolicySection[] = [
  {
    id: "objeto-y-alcance",
    title: "Objeto y alcance",
    paragraphs: [
      "Este reglamento establece las condiciones de uso del servicio y fija un marco de convivencia para las interacciones que se desarrollen dentro de este espacio. Su finalidad es ofrecer una herramienta útil para el estudio, reduciendo riesgos relacionados con publicaciones ofensivas, divulgación indebida de información, uso no autorizado de materiales y conductas que afecten la integridad académica.",
      "Estas reglas se aplican a toda persona que consulte horarios, revise información de cursos y docentes, publique reseñas o comparta materiales históricos de estudio. El documento define criterios de uso responsable, pero no reemplaza reglamentos institucionales ni sustituye los canales formales del TEC para trámites, reclamos o denuncias oficiales.",
    ],
  },
  {
    id: "naturaleza-independiente-y-no-oficial",
    title: "Naturaleza independiente y no oficial de la plataforma",
    paragraphs: [
      "Este servicio es un proyecto estudiantil independiente y no oficial. No pertenece al Instituto Tecnológico de Costa Rica, no está patrocinado por la institución y no actúa como vocería de ninguna escuela, carrera, cátedra o unidad administrativa.",
      "Los horarios, reseñas, materiales y demás contenidos se ofrecen como apoyo académico comunitario. Cualquier referencia al TEC debe entenderse en un contexto informativo y no como señal de afiliación, patrocinio o aval institucional. Tampoco sustituye comunicados, repositorios, plataformas ni sistemas oficiales del Instituto.",
    ],
  },
  {
    id: "definiciones-basicas",
    title: "Definiciones básicas",
    paragraphs: [
      "Para efectos de esta política, se entiende por usuario a cualquier persona que acceda o utilice el servicio, con o sin cuenta registrada. Se entiende por contenido toda reseña, comentario, archivo, texto, documento o publicación incorporada a este espacio.",
      "Material académico incluye, entre otros, exámenes, prácticas, proyectos, guías, documentos y recursos de estudio. Se considera contenido prohibido toda publicación que incumpla estas reglas, afecte derechos de terceros o genere un riesgo razonable para la dignidad personal, la privacidad, la propiedad intelectual o la integridad académica.",
    ],
  },
  {
    id: "reglas-generales-de-uso",
    title: "Reglas generales de uso",
    paragraphs: [
      "Este espacio está pensado para fines académicos e informativos. Por esa razón, toda interacción debe mantenerse dentro de un marco de respeto hacia docentes, estudiantes y cualquier otra persona mencionada en publicaciones. El contenido enviado debe evitar afirmaciones falsas, ofensivas o divulgaciones indebidas.",
      "Se prohíbe publicar contenido insultante, humillante, discriminatorio, difamatorio, calumnioso o acosador, así como cualquier mensaje que vulnere la dignidad, la intimidad o la reputación de terceros. También se prohíben la suplantación de identidad, la intimidación, el hostigamiento y la divulgación de datos personales innecesarios o sensibles.",
      "Podrán restringirse conductas que comprometan la seguridad o el funcionamiento del servicio, incluyendo intentos de manipulación técnica, evasión de controles o acciones orientadas a saturar sistemas y afectar la experiencia de la comunidad.",
    ],
  },
  {
    id: "politica-de-resenas-y-opiniones-sobre-docentes",
    title: "Política de reseñas y opiniones sobre docentes",
    paragraphs: [
      "Las reseñas sobre docentes están permitidas porque pueden aportar orientación académica entre estudiantes. Sin embargo, deben centrarse en la experiencia del curso, por ejemplo en la claridad de explicación, la metodología, la evaluación, el nivel de exigencia, la retroalimentación y la organización general.",
      "Las opiniones deben redactarse con respeto y mantenerse dentro del ámbito académico. No se admiten ataques personales, burlas, señalamientos sobre la vida privada ni acusaciones graves sin sustento verificable. Tampoco se permite utilizar este espacio para desprestigiar, humillar o dañar injustamente la reputación de una persona.",
      "Si una reseña infringe estos criterios o existe un riesgo claro para la dignidad, la intimidad o la reputación de alguien, será rechazada o retirada según corresponda.",
    ],
  },
  {
    id: "politica-sobre-materiales-academicos",
    title: "Política sobre materiales académicos, exámenes, prácticas y proyectos",
    paragraphs: [
      "Los materiales históricos de estudio solo podrán compartirse cuando quien los publica tenga derecho suficiente para hacerlo y su difusión no comprometa procesos de evaluación actuales ni reglas específicas del curso. El simple hecho de tener acceso a un archivo no implica, por sí solo, autorización para publicarlo.",
      "Se prohíbe subir evaluaciones vigentes, bancos de respuestas, soluciones oficiales no autorizadas, entregables de terceros, proyectos para copiar, filtraciones, contenido restringido por el curso o cualquier material que facilite fraude académico, plagio o suplantación.",
      "Si una evaluación o material académico infringe alguna norma, por ejemplo por plagio, filtración, confidencialidad, privacidad, autoría o afectación a la integridad académica, podrá ser rechazado, ocultado o borrado según corresponda.",
    ],
  },
  {
    id: "propiedad-intelectual-y-derechos-sobre-el-contenido",
    title: "Propiedad intelectual y derechos sobre el contenido",
    paragraphs: [
      "Cada usuario conserva la titularidad de los derechos que legalmente le correspondan sobre el contenido que publica. Compartir material en este espacio no implica ceder la autoría ni transferir de forma total los derechos patrimoniales o morales que correspondan.",
      "Para hacer posible el funcionamiento del servicio, quien publica concede una licencia limitada, no exclusiva y revocable que permite alojar, mostrar, ordenar, indexar, procesar técnicamente, moderar y retirar contenido cuando ello sea necesario para la operación, la seguridad o el cumplimiento de esta política.",
      "Esa licencia se limita al propósito operativo del servicio y no autoriza una apropiación indebida del contenido. Si una publicación infringe derechos de terceros o se comparte sin autorización suficiente, podrá ser removida.",
    ],
  },
  {
    id: "privacidad-y-tratamiento-de-datos-personales",
    title: "Privacidad y tratamiento de datos personales",
    paragraphs: [
      "El tratamiento de datos personales se rige por criterios de minimización, finalidad específica y confidencialidad. Las reseñas y evaluaciones se reciben de forma anónima y no se muestran públicamente datos de autoría asociados a esos envíos.",
      "Los datos que pueden recopilarse incluyen información básica de cuenta cuando una persona decide registrarse, registros técnicos de acceso, actividad necesaria para operar el servicio y datos asociados a reportes o reclamos. La visibilidad pública se limita a lo estrictamente necesario para la interacción comunitaria.",
      "Quien utilice el servicio puede solicitar corrección, actualización o eliminación de sus datos en los casos que correspondan. Aun así, cierta información técnica podrá conservarse por un plazo razonable cuando resulte necesaria para seguridad, cumplimiento de obligaciones o resolución de disputas.",
      "Se adoptan medidas razonables de seguridad para proteger la información, pero ningún sistema ofrece una garantía absoluta frente a incidentes o accesos indebidos. Por esa razón, se recomienda no publicar datos sensibles ni compartir información privada que no sea indispensable para fines académicos.",
    ],
  },
  {
    id: "moderacion-reportes-y-retiro-de-contenido",
    title: "Moderación, reportes y retiro de contenido",
    paragraphs: [
      "Con el fin de proteger a la comunidad y reducir daños, el contenido podrá ser revisado, ocultado temporalmente, limitado en visibilidad o retirado cuando exista incumplimiento de estas reglas o un riesgo relevante para personas, derechos o procesos académicos.",
      "Se atenderán reportes relacionados con privacidad, propiedad intelectual, contenido ofensivo, fraude académico, uso indebido de datos y otras infracciones. El análisis de cada caso tomará en cuenta el contexto, la evidencia disponible, la gravedad de los hechos, la recurrencia y el posible impacto sobre terceros.",
      "Cuando la situación lo requiera, podrán adoptarse medidas rápidas antes de que concluya toda la revisión, con el objetivo de evitar daños mayores. Una vez analizado el caso, la administración podrá mantener, ajustar o revocar la medida aplicada sobre el contenido.",
    ],
  },
  {
    id: "medidas-por-incumplimiento",
    title: "Criterios de rechazo o retiro",
    paragraphs: [
      "Como las reseñas y evaluaciones se reciben de forma anónima, la moderación se centra en revisar, rechazar, ocultar o retirar contenido. El objetivo principal es evitar publicaciones que dañen a terceros, comprometan derechos o afecten la integridad académica.",
      "Según cada situación, podrán adoptarse una o varias de las siguientes acciones sobre el contenido:",
    ],
    bullets: [
      "Rechazo de una reseña que infrinja los criterios establecidos.",
      "Rechazo, ocultamiento o eliminación de una evaluación que infrinja normas académicas, de privacidad, autoría o propiedad intelectual.",
      "Retiro preventivo de contenido cuando exista un reclamo razonable o una situación urgente.",
      "Mantenimiento del contenido cuando la revisión no evidencie incumplimiento suficiente.",
    ],
  },
  {
    id: "codigo-abierto-y-licencia",
    title: "Código abierto y licencia",
    paragraphs: [
      "Claustrum es un proyecto de código abierto. Su código fuente está disponible públicamente en github.com/mau671/claustrum.",
      "El proyecto se distribuye bajo una licencia MIT, lo que permite usar, copiar, modificar y distribuir el código conforme a los términos de esa licencia.",
    ],
  },
  {
    id: "limitacion-de-responsabilidad",
    title: "Limitación de responsabilidad",
    paragraphs: [
      "Este servicio funciona como una herramienta de apoyo académico e informativo construida con aportes de la comunidad. Por su propia naturaleza, no puede garantizar que todo contenido publicado por terceros sea exacto, vigente, completo, autorizado o aceptado por instancias institucionales.",
      "Cada usuario debe verificar la información relevante antes de tomar decisiones académicas importantes, especialmente cuando existan canales oficiales para confirmación. La administración actúa de buena fe para prevenir abusos y atender incidentes, pero no asume responsabilidad ilimitada por actuaciones de terceros ni por eventos fuera de su control razonable.",
    ],
  },
  {
    id: "modificaciones-de-la-politica",
    title: "Modificaciones de la política",
    paragraphs: [
      "Esta política puede actualizarse cuando sea necesario mejorar reglas de convivencia, reforzar controles de privacidad, responder a nuevos riesgos o ajustar el funcionamiento del servicio. Los cambios se realizarán con enfoque preventivo y buscando mayor claridad para la comunidad usuaria.",
      "Cuando exista una modificación sustancial, se procurará comunicarla por medios razonables dentro del servicio. El uso continuado después de publicada una nueva versión se entenderá como aceptación de las condiciones vigentes.",
    ],
  },
  {
    id: "contacto-y-solicitudes",
    title: "Contacto y solicitudes",
    paragraphs: [
      "Para reportes, solicitudes de retiro de contenido, ejercicio de derechos sobre datos personales o contacto por alguna situación relacionada con la plataforma, se pone a disposición el correo claustrum@maugp.com.",
      "También puede usarse ese correo si alguna autoridad competente requiere la eliminación de contenido o necesita comunicarse por una situación específica. Para facilitar una atención más ágil, la solicitud debe incluir la identificación del contenido involucrado, el motivo del reclamo y, cuando sea posible, evidencia básica de respaldo.",
    ],
  },
];

export function PoliciesPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-8 lg:px-8 lg:py-10">
      <div className="w-full max-w-6xl space-y-12">
        <header className="max-w-4xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            Reglamento, políticas de uso y privacidad
          </h1>
        </header>

        <div className="space-y-10">
          {sections.map((section) => (
            <section
              key={section.title}
              id={section.id}
              className="grid scroll-mt-24 gap-4 border-t pt-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-8"
            >
              <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">
                <a href={`#${section.id}`} className="hover:text-primary transition-colors">
                  {section.title}
                </a>
              </h2>

              <div className="space-y-5">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-foreground/90 max-w-4xl text-base leading-8 lg:text-lg"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets ? (
                  <ul className="text-foreground/90 max-w-4xl list-disc space-y-3 pl-6 text-base leading-8 lg:text-lg">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
