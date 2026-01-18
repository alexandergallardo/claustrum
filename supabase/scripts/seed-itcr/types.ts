/**
 * Type definitions for the ITCR seed script.
 * 
 * These types represent data structures used for ingesting catalog and schedule data
 * from ITCR public endpoints into Supabase via PostgREST.
 */

/**
 * Command-line arguments for the seed script.
 */
export interface Args {
  /** When true, performs a dry run without modifying the database. */
  dryRun: boolean;
  /** Set of specific operations to run (e.g., "campuses", "terms"). */
  only: Set<string>;
  /** Maximum number of campuses to process. */
  maxCampuses?: number;
  /** Maximum number of plans per program to process. */
  maxPlansPerProgram?: number;
  /** Maximum number of terms to process. */
  maxTerms?: number;
  /** Specific campus codes to filter by. */
  campusCodes?: string[];
  /** Specific term keys to filter by. */
  termKeys?: string[];
}

/**
 * HTTP methods supported by the seed script's HTTP utilities.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Supabase REST client class type.
 * Used for PostgREST operations on Supabase database.
 * @see seed-itcr.ts for implementation
 */
export type SupabaseRestClient = any;

/**
 * Response type for the curriculum API's campuses endpoint.
 * Returns a list of campus locations with their codes and names.
 */
export type CurriculumCampusesResponse = {
  /** Array of campus entries with key (code) and data (name). */
  sedes: Array<{ key: string; data: string }>;
};

/**
 * Response type for the curriculum API's careers endpoint.
 * Returns a list of academic programs/careers for a given campus.
 */
export type CurriculumCareersResponse = {
  /** Array of career entries with key (code) and data (name). */
  carreras: Array<{ key: string; data: string }>;
};

/**
 * Response type for the curriculum API's plans endpoint.
 * Returns a list of study plans for a given program.
 */
export type CurriculumPlansResponse = {
  /** Array of plan entries with numeric key and name data. */
  planes: Array<{ key: number; data: string }>;
};

/**
 * Detailed curriculum plan information from the curriculum API.
 * Contains course structure, requirements, and academic metadata.
 */
export interface CurriculumPlanDetails {
  /** Full curriculum description. */
  dsc_curriculum: string;
  /** Unique curriculum identifier. */
  id_curriculum: number;
  /** Academic modality name (e.g., "Semestre", "Cuatrimestre"). */
  modality: string;
  /** Academic degree type (optional, e.g., "Licenciatura", "Maestría"). */
  academic_degree?: string;
  /** First level number (optional). */
  first_level?: number;
  /** Array of curriculum levels containing courses. */
  levels: Array<{
    /** Level identifier. */
    id: string;
    /** Courses in this level. */
    courses: Array<{
      /** Course code (e.g., "IC1802"). */
      id_course: string;
      /** Course name. */
      name: string;
      /** Truncated course name (optional). */
      trucatedName?: string;
      /** Number of credits. */
      credits: number;
      /** Course hours. */
      hours: number;
      /** Prerequisites for the course. */
      requirements?: Array<{ id: string }>;
      /** Corequisites for the course. */
      co_requirements?: Array<{ id: string }>;
      /** Equivalent courses. */
      equivalent?: Array<{ id: string }>;
      /** Type of equivalence (optional). */
      tEquiv?: string;
    }>;
  }>;
}

/**
 * Row type for period data from the student records API.
 */
export type PeriodRow = {
  /** Period key (e.g., "2026_S_1" for Semestre 1, 2026). */
  key: string;
  /** Period display name (e.g., "2026 - Semestre 1"). */
  data: string;
};

/**
 * Envelope type for Guía Horarios API responses.
 * The actual data is nested in the 'd' property as a JSON string.
 */
export type GuiaHorariosEnvelope = {
  /** Nested JSON string containing the actual response data. */
  d: string;
};

/**
 * Row type for academic unit (school/department) data from Guía Horarios.
 */
export type GuiaEscuelaRow = {
  /** Department/school identifier code. */
  IDE_DEPTO: string;
  /** Department/school description/name. */
  DSC_DEPTO: string;
};

/**
 * Row type for academic modality data from Guía Horarios.
 */
export type GuiaModalityRow = {
  /** Modality identifier code. */
  IDE_MODALIDAD: string;
  /** Modality display name. */
  NOMBRE: string;
  /** Number of periods per year for this modality. */
  CANT_PERIODOS: number;
};

/**
 * Complete row type for course offering data from Guía Horarios.
 * Contains all course, schedule, reservation, and professor information.
 */
export interface GuiaOfertaEscuelaAnoRow {
  /** Campus name/description where the course is offered. */
  DSC_SEDE: string;
  /** Course code (e.g., "IC1802"). */
  IDE_MATERIA: string;
  /** Course name/description. */
  DSC_MATERIA: string;
  /** Group number for the course. */
  IDE_GRUPO: number;
  /** Academic unit/department name offering the course. */
  DSC_DEPTO: string;
  /** Number of credits for the course. */
  CAN_CREDITOS: number;
  /** Course hours. */
  HORAS: number;
  /** Day name for the scheduled meeting. */
  NOM_DIA: string;
  /** Modality identifier code (e.g., "S" for Semestre). */
  IDE_MODALIDAD: string;
  /** Period number within the modality. */
  IDE_PER_MOD: number;
  /** Academic year. */
  NUM_ANO: number;
  /** Modality description/name. */
  DSC_MODALIDAD: string;
  /** Course type (e.g., "Curso Unico", "Electiva"). */
  TIPO_CURSO: string;
  /** Start time of the meeting (HH:MM format). */
  HINICIO: string;
  /** End time of the meeting (HH:MM format). */
  HFIN: string;
  /** Professor name. */
  NOM_PROFESOR: string;
  /** Campus-specific reservation information. */
  RESERVA_SEDE: string;
  /** Department-specific reservation information. */
  RESERVA_DEPTO: string;
  /** Study plan-specific reservation information. */
  RESERVA_PLAN: string;
  /** Parsed meeting times (optional, added during processing). */
  meetings?: Array<{ weekday: number; startTime: string; endTime: string }>;
}

/**
 * UUID mappings built during the ingestion process.
 * Used to resolve foreign key relationships when upserting data.
 */
export interface IngestUuids {
  /** Maps campus codes to their database IDs. */
  campusIdByCode: Map<string, number>;
  /** Maps academic unit codes to their database IDs. */
  academicUnitIdByCode: Map<string, number>;
  /** Maps academic modality codes to their database IDs. */
  academicModalityIdByCode: Map<string, number>;
  /** Maps academic term external keys to their database IDs. */
  academicTermIdByExternalKey: Map<string, number>;
  /** Maps course codes to their database IDs. */
  courseIdByCode: Map<string, number>;
  /** Maps study plan keys (unitCode::externalPlanId) to their database IDs. */
  studyPlanIdByUnitCodeAndExternalPlanId: Map<string, number>;
}

/**
 * Parsed academic term key components.
 * Keys follow the format: YEAR_MODALITY_PERIOD (e.g., "2026_S_1").
 */
export interface ParsedAcademicTermKey {
  /** Academic year (4-digit). */
  year: number;
  /** Modality code (e.g., "S" for Semestre, "V" for Verano). */
  modalityCode: string;
  /** Period number within the modality. */
  periodNumber: number;
}

/**
 * Row type for campus data from curriculum and student records APIs.
 */
export interface CampusRow {
  /** Campus code (e.g., "SJ", "AL", "CA"). */
  code: string;
  /** Campus full name. */
  name: string;
}

/**
 * Row type for academic unit/program data from APIs.
 */
export interface AcademicUnitRow {
  /** Academic unit code. */
  code: string;
  /** Academic unit name. */
  name: string;
}

/**
 * Row type for study plan data from curriculum API.
 */
export interface StudyPlanRow {
  /** External plan ID from the curriculum API. */
  externalPlanId: number;
  /** Study plan name. */
  name: string;
}

/**
 * Row type for academic term data after parsing.
 */
export interface AcademicTermRow {
  /** Original external key from the API. */
  external_key: string;
  /** Human-readable display name. */
  display_name: string;
  /** Parsed year component. */
  year: number;
  /** Parsed modality code. */
  modality_code: string;
  /** Parsed period number. */
  period_number: number;
}

/**
 * Parsed row from the schedule guide table (HTML parsing).
 */
export interface ScheduleGuideRow {
  /** Course code. */
  courseCode: string;
  /** Course name. */
  courseName: string;
  /** Group code. */
  groupCode: string;
  /** Number of credits. */
  credits: number;
  /** Original schedule text from the HTML. */
  scheduleText: string;
  /** Classroom location (null if not available). */
  classroom: string | null;
  /** Professor name (null if not specified). */
  professorName: string | null;
  /** Maximum course capacity. */
  capacity: number;
  /** Course type classification. */
  courseType: string | null;
  /** Group type classification. */
  groupType: string | null;
  /** Number of reserved seats. */
  reserved: number;
  /** Parsed meeting times. */
  meetings?: Array<{ weekday: number; startTime: string; endTime: string }>;
}

/**
 * Meeting time structure for parsed schedule data.
 */
export interface MeetingTime {
  /** Day of week (0=Sunday, 1=Monday, ..., 6=Saturday). */
  weekday: number;
  /** Start time in HH:MM format. */
  startTime: string;
  /** End time in HH:MM format. */
  endTime: string;
}

/**
 * UPSERT operation parameters.
 */
export interface UpsertParams<T extends object> {
  /** Database table name. */
  table: string;
  /** Rows to upsert. */
  rows: T[];
  /** Conflict resolution column(s). */
  onConflict: string;
  /** When true, simulates the operation without database changes. */
  dryRun: boolean;
  /** When false, suppresses progress logging. */
  showProgress?: boolean;
}

/**
 * SELECT query parameters.
 */
export interface SelectParams {
  /** Database table name. */
  table: string;
  /** Columns to select (comma-separated). */
  columns: string;
  /** PostgREST filter expression. */
  filter?: string;
  /** Maximum number of rows to return. */
  limit?: number;
}

/**
 * HTTP request options for JSON responses.
 */
export interface HttpJsonOptions {
  /** HTTP headers to include. */
  headers?: Record<string, string>;
  /** Request body (will be JSON.stringified). */
  body?: unknown;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * HTTP request options for text responses.
 */
export interface HttpTextOptions {
  /** HTTP headers to include. */
  headers?: Record<string, string>;
  /** Raw string body. */
  body?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/**
 * Response from HTTP text request.
 */
export interface HttpTextResponse {
  /** Response body as string. */
  text: string;
  /** Response headers. */
  headers: Headers;
}

/**
 * University seeding parameters.
 */
export interface EnsureUniversityParams {
  /** ISO 2-letter country code. */
  countryIso2: string;
  /** Full university name. */
  universityName: string;
  /** Short university name (abbreviation). */
  universityShortName: string;
  /** When true, simulates the operation without database changes. */
  dryRun: boolean;
}

/**
 * Result of university seeding operation.
 */
export interface EnsureUniversityResult {
  /** Created/found country ID. */
  countryId: number;
  /** Created/found university ID. */
  universityId: number;
}

/**
 * Base catalog seeding parameters.
 */
export interface SeedBaseCatalogParams {
  /** Supabase REST client instance. */
  supabase: SupabaseRestClient;
  /** When true, simulates the operation without database changes. */
  dryRun: boolean;
}

/**
 * Campus sync parameters.
 */
export interface SyncCampusesParams {
  /** Supabase REST client instance. */
  supabase: SupabaseRestClient;
  /** Parent university ID. */
  universityId: number;
  /** When true, simulates the operation without database changes. */
  dryRun: boolean;
  /** Maximum number of campuses to process. */
  maxCampuses?: number;
  /** Specific campus codes to filter by. */
  campusCodes?: string[];
}

/**
 * Terms sync parameters.
 */
export interface SyncTermsParams {
  /** Supabase REST client instance. */
  supabase: SupabaseRestClient;
  /** When true, simulates the operation without database changes. */
  dryRun: boolean;
  /** Maximum number of terms to process. */
  maxTerms?: number;
  /** Specific term keys to filter by. */
  termKeys?: string[];
}

/**
 * Ingest maps build parameters.
 */
export interface BuildIngestMapsParams {
  /** Supabase REST client instance. */
  supabase: SupabaseRestClient;
}

/**
 * Fetch campuses from curriculum API parameters.
 */
export interface FetchCampusesFromCurriculumApiParams {
  // No parameters required
}

/**
 * Fetch campuses from student records HTML parameters.
 */
export interface FetchCampusesFromStudentRecordsHtmlParams {
  // No parameters required
}

/**
 * Row type for parsed TEC Digital table row.
 */
export interface TecDigitalRow {
  CODIGO: string;
  MATERIA: string;
  GRUPO: string;
  CREDITOS: string;
  HORARIO: string;
  AULA: string;
  CUPO: string;
  TIPO_MATERIA: string;
  [key: string]: string;
}

/**
 * Combination tuple for TEC Digital batch fetch: [sede, carrera, periodo].
 */
export type TecDigitalCombination = readonly [string, string, string];

/**
 * Schedule period structure for merged data (período → curso → grupo).
 */
export interface SchedulePeriod {
  periodo: string;
  cursos: Map<string, ScheduleCourse>;
}

/**
 * Schedule course structure with grouped offerings.
 */
export interface ScheduleCourse {
  codigo: string;
  nombre: string;
  creditos: number;
  horas: number;
  escuela: { codigo: string; nombre: string };
  modalidad: string;
  tipo_materia: string | null;
  grupos: Map<string, ScheduleGroup>;
}

/**
 * Schedule group structure with meetings and professors.
 */
export interface ScheduleGroup {
  numero: number;
  sede: { codigo: string; nombre: string };
  profesores: string[];
  modalidad: string;
  capacidad: number | null;
  horarios: Map<string, ScheduleMeeting>;
}

/**
 * Schedule meeting structure with day, times, and classroom.
 */
export interface ScheduleMeeting {
  weekday: number;
  starts_at: string;
  ends_at: string;
  classroom: string | null;
}

/**
 * Schedule sync parameters.
 */
export interface SyncScheduleParams {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
  termKeys?: string[];
  maxTerms?: number;
  alteonp?: string | false;
}

/**
 * Fetch program careers from curriculum API parameters.
 */
export interface FetchProgramCareersParams {
  /** Campus code. */
  campusCode: string;
}

/**
 * Fetch plans by program from curriculum API parameters.
 */
export interface FetchPlansByProgramParams {
  /** Campus code. */
  campusCode: string;
  /** Program/department code. */
  programCode: string;
}

/**
 * Fetch plan details from curriculum API parameters.
 */
export interface FetchPlanDetailsParams {
  /** External plan ID from the curriculum API. */
  externalPlanId: number;
}

/**
 * Fetch terms from student records API parameters.
 */
export interface FetchTermsFromStudentRecordsApiParams {
  // No parameters required
}

/**
 * Fetch offerings by academic unit and year from Guía Horarios parameters.
 */
export interface FetchOfferingsParams {
  /** AlteonP cookie value for authentication. */
  alteonp: string;
  /** Academic unit code (escuela). */
  academicUnitCode: string;
  /** Academic year to fetch. */
  year: number;
  /** When true, skips Guía Horarios and uses TecDigital fallback. */
  skipGuiaHorarios?: boolean;
}

/**
 * Fetch academic units from Guía Horarios parameters.
 */
export interface FetchAcademicUnitsParams {
  /** AlteonP cookie value for authentication. */
  alteonpValue: string;
}

/**
 * Fetch modalities from Guía Horarios parameters.
 */
export interface FetchModalitiesParams {
  /** AlteonP cookie value for authentication. */
  alteonpValue: string;
}
