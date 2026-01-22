/**
 * Schedule synchronization for the ITCR seed script.
 * 
 * New implementation based on the Python main.py pattern:
 * 1. Fetch Guia Horarios data by (escuela, año)
 * 2. Build TEC Digital combinations from guia rows
 * 3. Batch fetch TEC Digital data for all combinations
 * 4. Merge data in memory (estructura anidada período → curso → grupo)
 * 5. Filter by primary campuses (AL, CA, LM, SC, SJ)
 * 6. Upsert to database (professors, offerings, groups, meetings, group_professors)
 * 
 * IMPORTANT: Courses are NOT upserted here - they come from syncCurriculumPlans.
 * This function only uses existing course IDs from the database.
 */

import type {
  SupabaseRestClient,
  GuiaOfertaEscuelaAnoRow,
  SchedulePeriod,
  ScheduleCourse,
  ScheduleGroup,
  ScheduleMeeting,
  TecDigitalCombination,
  TecDigitalRow,
} from "../types";
import { logSection, logProgress, logSuccess, logInfo, logWarn } from "../logging";
import { PRIMARY_CAMPUSES } from "../config";
import {
  fetchGuiaHorariosByEscuelaYear,
  fetchAcademicUnitsFromGuiaHorarios,
  getModalityDisplay,
} from "../fetchers";
import {
  buildTecDigitalCombinations,
  fetchTecDigitalBatch,
  findTecDigitalRow,
} from "../fetchers/tecdigital";
import { loadCampusMap, type CampusMap } from "../fetchers/campus-map";
import { buildIngestMaps } from "./index";
import { chunk } from "../utils";
import { normalizeCourseType, normalizeGroupType } from "../normalizers";

function upper(text: string): string {
  return text.toUpperCase();
}

function normalizeForMap(text: string): string {
  return text.trim().toUpperCase();
}

function buildPeriod(row: GuiaOfertaEscuelaAnoRow): string {
  return `${row.NUM_ANO}_${row.IDE_MODALIDAD}_${row.IDE_PER_MOD}`;
}

function weekdayFromSpanish(day: string): number | null {
  const d = day.trim().toUpperCase();
  if (d.startsWith("LUNES")) return 1;
  if (d.startsWith("MARTES")) return 2;
  if (d.startsWith("MIERCOLES") || d.startsWith("MIÉRCOLE")) return 3;
  if (d.startsWith("JUEVES")) return 4;
  if (d.startsWith("VIERNES")) return 5;
  if (d.startsWith("SÁBADO") || d.startsWith("SABADO")) return 6;
  if (d.startsWith("DOMINGO")) return 7;
  return null;
}

function mapCampusName(name: string, campusMap: CampusMap): string {
  const normalized = normalizeForMap(name);
  const mapped = campusMap.codeByNormalizedName.get(normalized);
  if (mapped) return mapped;
  return normalized.slice(0, 2).toUpperCase();
}

function filterByPrimaryCampuses(
  periods: SchedulePeriod[],
  primaryCampuses: Set<string>
): SchedulePeriod[] {
  const filtered: SchedulePeriod[] = [];
  
  for (const periodo of periods) {
    const cursosFiltrados = new Map<string, ScheduleCourse>();
    
    for (const [codigo, curso] of periodo.cursos) {
      const gruposFiltrados = new Map<string, ScheduleGroup>();
      
      for (const [key, grupo] of curso.grupos) {
        if (primaryCampuses.has(grupo.sede.codigo)) {
          gruposFiltrados.set(key, grupo);
        }
      }
      
      if (gruposFiltrados.size > 0) {
        curso.grupos = gruposFiltrados;
        cursosFiltrados.set(codigo, curso);
      }
    }
    
    if (cursosFiltrados.size > 0) {
      periodo.cursos = cursosFiltrados;
      filtered.push(periodo);
    }
  }
  
  return filtered;
}

function mergeGuiaAndTecDigital(
  guiaRows: GuiaOfertaEscuelaAnoRow[],
  tecdigitalData: Map<TecDigitalCombination, TecDigitalRow[]>,
  unidadCodigo: string,
  campusMap: CampusMap
): SchedulePeriod[] {
  const periodsDict = new Map<string, SchedulePeriod>();
  
  guiaRows.sort((a, b) => {
    const pa = buildPeriod(a);
    const pb = buildPeriod(b);
    return pa.localeCompare(pb);
  });
  
  for (const row of guiaRows) {
    const periodo = buildPeriod(row);
    const ideMateria = row.IDE_MATERIA;
    const ideGrupo = row.IDE_GRUPO;
    const sedeNombre = row.DSC_SEDE;
    const sedeCodigo = mapCampusName(sedeNombre, campusMap);
    const escuelaNombre = row.DSC_DEPTO;
    const escuelaCodigo = unidadCodigo;
    
    if (!periodsDict.has(periodo)) {
      periodsDict.set(periodo, {
        periodo,
        cursos: new Map(),
      });
    }
    
    const periodoData = periodsDict.get(periodo)!;
    const cursos = periodoData.cursos;
    
    const tecRow = findTecDigitalRow(
      tecdigitalData,
      sedeCodigo,
      unidadCodigo,
      periodo,
      ideMateria,
      ideGrupo
    );
    
    let tipoMateria: string | null = null;
    if (tecRow) {
      tipoMateria = tecRow.TIPO_MATERIA || tecRow["TIPO_MATERIA "] || tecRow.TIPOMATERIA || tecRow.TIPO || null;
      if (tipoMateria) tipoMateria = upper(tipoMateria);
    }
    
    if (!cursos.has(ideMateria)) {
      cursos.set(ideMateria, {
        codigo: ideMateria,
        nombre: upper(row.DSC_MATERIA),
        creditos: row.CAN_CREDITOS,
        horas: row.HORAS,
        escuela: {
          codigo: escuelaCodigo,
          nombre: upper(escuelaNombre),
        },
        modalidad: upper(getModalityDisplay(row.IDE_MODALIDAD)),
        tipo_materia: tipoMateria,
        grupos: new Map(),
      });
    }
    
    const curso = cursos.get(ideMateria)!;
    if (curso.tipo_materia === null && tipoMateria) {
      curso.tipo_materia = tipoMateria;
    }
    const grupos = curso.grupos;
    
    const groupKey = `${ideGrupo}_${sedeCodigo}`;
    if (!grupos.has(groupKey)) {
      grupos.set(groupKey, {
        numero: ideGrupo,
        sede: {
          codigo: sedeCodigo,
          nombre: upper(sedeNombre),
        },
        profesores: [],
        modalidad: upper(row.TIPO_CURSO || ""),
        capacidad: null,
        horarios: new Map(),
      });
    }
    
    const grupo = grupos.get(groupKey)!;
    
    if (row.NOM_PROFESOR) {
      const prof = upper(row.NOM_PROFESOR);
      if (!grupo.profesores.includes(prof)) {
        grupo.profesores.push(prof);
      }
    }
    
    const sessionKey = `${row.NOM_DIA}_${row.HINICIO}_${row.HFIN}`;
    if (row.NOM_DIA && row.HINICIO && row.HFIN && !grupo.horarios.has(sessionKey)) {
      const weekday = weekdayFromSpanish(row.NOM_DIA);
      if (weekday) {
        grupo.horarios.set(sessionKey, {
          weekday,
          starts_at: row.HINICIO,
          ends_at: row.HFIN,
          classroom: null,
        });
      }
    }
    
    if (tecRow) {
      if (grupo.capacidad === null) {
        const cup = tecRow.CUPO;
        if (cup) {
          const parsed = parseInt(cup, 10);
          if (!isNaN(parsed)) {
            grupo.capacidad = parsed;
          }
        }
      }
      
      const aula = tecRow.AULA;
      if (aula && aula.toUpperCase() !== "NO DISPONIBLE" && aula.trim() !== "") {
        for (const horario of grupo.horarios.values()) {
          if (horario.classroom === null) {
            horario.classroom = upper(aula);
          }
        }
      }
      
      const horario = tecRow.HORARIO || "";
      if (horario.includes(" - ")) {
        const parts = horario.split(" - ");
        if (parts.length >= 3) {
          const dia = upper(parts[0]);
          const inicio = parts[1];
          const fin = parts[2];
          const wd = weekdayFromSpanish(dia);
          if (wd && inicio && fin) {
            const key = `${dia}_${inicio}_${fin}`;
            if (!grupo.horarios.has(key)) {
              grupo.horarios.set(key, {
                weekday: wd,
                starts_at: inicio,
                ends_at: fin,
                classroom: grupo.horarios.values().next().value?.classroom ?? null,
              });
            }
          }
        }
      }
    }
  }
  
  const result: SchedulePeriod[] = [];
  for (const [periodo, data] of periodsDict) {
    const cursosArray = new Map<string, ScheduleCourse>();
    for (const [codigo, curso] of data.cursos) {
      const gruposArray = new Map<string, ScheduleGroup>();
      for (const [key, grupo] of curso.grupos) {
        const horariosArray = new Map<string, ScheduleMeeting>();
        for (const [hkey, horario] of grupo.horarios) {
          horariosArray.set(hkey, horario);
        }
        gruposArray.set(key, { ...grupo, horarios: horariosArray });
      }
      cursosArray.set(codigo, { ...curso, grupos: gruposArray });
    }
    result.push({ periodo, cursos: cursosArray });
  }
  
  return result.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

interface OfferingData {
  course_id: number;
  campus_id: number;
  academic_unit_id: number;
  academic_term_id: number;
  credits_snapshot: number;
  weekly_hours_snapshot: number;
  course_type: string | null;
}

interface GroupData {
  course_offering_id: number;
  group_code: string;
  group_type: string;
  capacity: number;
  enrolled_count: number;
}

interface MeetingData {
  course_offering_group_id: number;
  weekday: number;
  starts_at: string;
  ends_at: string;
  classroom: string | null;
}

interface GroupProfessorData {
  course_offering_group_id: number;
  professor_id: number;
}

export async function syncSchedule(params: {
  supabase: SupabaseRestClient;
  dryRun: boolean;
  campusCodes?: string[];
  maxCampuses?: number;
  termKeys?: string[];
  maxTerms?: number;
  alteonp?: string | false;
}): Promise<void> {
  logSection("Sync: schedule (guiahorarios + tecdigital)");
  
  if (!params.alteonp) {
    logWarn("No AlteonP cookie provided, skipping schedule sync");
    return;
  }
  
  const stats = {
    guiaRowsFetched: 0,
    tecdigitalCombinations: 0,
    periodsProcessed: 0,
    professorsUpserted: 0,
    offeringsUpserted: 0,
    groupsUpserted: 0,
    meetingsUpserted: 0,
    groupProfessorsUpserted: 0,
  };
  
  logProgress("Fetching academic units...");
  const units = await fetchAcademicUnitsFromGuiaHorarios(params.alteonp);
  if (units.length === 0) {
    logWarn("No academic units found, skipping schedule sync");
    return;
  }
  logSuccess(`Found ${units.length} academic units`);
  
  const startTime = Date.now();
  
  const terms = await params.supabase.select({
    table: "academic_term",
    columns: "id,external_key,year",
    limit: 50_000,
  }) as { id: number; external_key: string; year: number }[];
  
  const termsQueryTime = Date.now() - startTime;
  logInfo(`Terms query took ${termsQueryTime}ms, found ${terms.length} terms`);
  
  let years = Array.from(new Set(terms.map((t: { year: number }) => t.year))).sort((a, b) => b - a);
  
  if (params.maxTerms && params.maxTerms > 0) {
    years = years.slice(0, params.maxTerms);
  }
  
  logInfo(`Processing years: ${years.join(", ")}`);
  
  const primaryCampusSet = new Set(PRIMARY_CAMPUSES);
  
  const academicTermIdByKey = new Map<string, number>();
  for (const t of terms) academicTermIdByKey.set(t.external_key, t.id);
  
  for (const unit of units) {
    for (const year of years) {
      const unitStartTime = Date.now();
      logProgress(`Processing ${unit.code}/${year}...`);
      
      const fetchStartTime = Date.now();
      const guiaRows = await fetchGuiaHorariosByEscuelaYear(
        params.alteonp!,
        unit.code,
        year
      );
      const fetchTime = Date.now() - fetchStartTime;
      
      if (guiaRows.length === 0) {
        logInfo(`${unit.code}/${year}: No guia rows (${fetchTime}ms)`);
        continue;
      }
       
       stats.guiaRowsFetched += guiaRows.length;
       
       const uniqueSedes = [...new Set(guiaRows.map(r => r.DSC_SEDE))].join(", ");
       logInfo(`  → Fetched from Guía Horarios: ${guiaRows.length} rows, sedes: ${uniqueSedes}`);
       
       const campusMap = await loadCampusMap();
       const combinations = buildTecDigitalCombinations(guiaRows, unit.code, campusMap);
       stats.tecdigitalCombinations += combinations.size;
       
       const tecdigitalStartTime = Date.now();
       const tecdigitalData = await fetchTecDigitalBatch(combinations);
       const tecdigitalTime = Date.now() - tecdigitalStartTime;
       
       const mergeStartTime = Date.now();
       const mergedData = mergeGuiaAndTecDigital(guiaRows, tecdigitalData, unit.code, campusMap);
      const mergeTime = Date.now() - mergeStartTime;
      
      const filterStartTime = Date.now();
      const filteredData = filterByPrimaryCampuses(mergedData, primaryCampusSet);
      const filterTime = Date.now() - filterStartTime;
      
      if (filteredData.length === 0) {
        logInfo(`${unit.code}/${year}: No filtered data (fetch: ${fetchTime}ms, tec: ${tecdigitalTime}ms, merge: ${mergeTime}ms, filter: ${filterTime}ms)`);
        continue;
      }
      
      stats.periodsProcessed += filteredData.length;
      
      const mapsStartTime = Date.now();
      
      const courseCodesNeedingLookup = new Set<string>();
      for (const periodo of filteredData) {
        for (const [, curso] of periodo.cursos) {
          courseCodesNeedingLookup.add(curso.codigo);
        }
      }
      
      const courseCodesNeeded = Array.from(courseCodesNeedingLookup);
      const missingCourses: string[] = [];
      const courseIdsFound = new Map<string, number>();
      
      if (courseCodesNeeded.length > 0) {
        const courses = await params.supabase.select({
          table: "course",
          columns: "id,code",
          filter: `code=in.(${courseCodesNeeded.map(c => encodeURIComponent(c)).join(',')})`,
          limit: courseCodesNeeded.length,
        }) as { id: number; code: string }[];
        for (const course of courses) {
          courseIdsFound.set(course.code, course.id);
        }
        for (const code of courseCodesNeeded) {
          if (!courseIdsFound.has(code)) {
            missingCourses.push(code);
          }
        }
      }
      
      const mapsTime = Date.now() - mapsStartTime;
      
      if (missingCourses.length > 0) {
        const uniqueMissing = [...new Set(missingCourses)];
        logWarn(`${unit.code}/${year}: Found ${uniqueMissing.length} courses not in curriculum: ${uniqueMissing.slice(0, 10).join(", ")}${uniqueMissing.length > 10 ? '...' : ''}`);
        continue;
      }
      
      const professorNames = new Set<string>();
      
      for (const periodo of filteredData) {
        for (const [, curso] of periodo.cursos) {
          for (const [, grupo] of curso.grupos) {
            for (const prof of grupo.profesores) {
              professorNames.add(prof);
            }
          }
        }
      }
      
      const profRows = Array.from(professorNames).map((name) => ({ full_name: name }));
      
      const profUpsertStart = Date.now();
      for (const batch of chunk(profRows, 2000)) {
        await params.supabase.upsertMany({
          table: "professor",
          rows: batch,
          onConflict: "full_name",
          dryRun: params.dryRun,
          showProgress: false,
        });
      }
      const profUpsertTime = Date.now() - profUpsertStart;
      stats.professorsUpserted += profRows.length;
      
      const professorQueryStart = Date.now();
      const professors = await params.supabase.select({
        table: "professor",
        columns: "id,full_name",
        limit: 200_000,
      }) as { id: number; full_name: string }[];
      const professorQueryTime = Date.now() - professorQueryStart;
      const professorIdByName = new Map<string, number>();
      for (const p of professors) professorIdByName.set(p.full_name.toUpperCase(), p.id);
      
      const mapsAfterProfStart = Date.now();
      const freshMapsAfterProf = await buildIngestMaps({ supabase: params.supabase });
      const mapsAfterProfTime = Date.now() - mapsAfterProfStart;
      
      const offeringBuildStart = Date.now();
      const allOfferings: OfferingData[] = [];
      const offeringKeyToIndex = new Map<string, number>();
      
      for (const periodo of filteredData) {
        const academic_term_id = academicTermIdByKey.get(periodo.periodo);
        if (!academic_term_id) continue;
        
        for (const [cursoCodigo, curso] of periodo.cursos) {
          const course_id = freshMapsAfterProf.courseIdByCode.get(cursoCodigo);
          if (!course_id) continue;
          
          const academic_unit_id = freshMapsAfterProf.academicUnitIdByCode.get(curso.escuela.codigo);
          if (!academic_unit_id) continue;
          
          for (const [, grupo] of curso.grupos) {
            const campus_id = freshMapsAfterProf.campusIdByCode.get(grupo.sede.codigo);
            if (!campus_id) continue;
            
            const offeringKey = `${course_id}_${campus_id}_${academic_unit_id}_${academic_term_id}`;
            
            if (!offeringKeyToIndex.has(offeringKey)) {
              const idx = allOfferings.length;
              offeringKeyToIndex.set(offeringKey, idx);
              allOfferings.push({
                course_id,
                campus_id,
                academic_unit_id,
                academic_term_id,
                credits_snapshot: curso.creditos,
                weekly_hours_snapshot: curso.horas,
                course_type: normalizeCourseType(curso.tipo_materia),
              });
            }
          }
        }
      }
      const offeringBuildTime = Date.now() - offeringBuildStart;
      
      const offeringUpsertStart = Date.now();
      for (const batch of chunk(allOfferings, 2000)) {
        await params.supabase.upsertMany({
          table: "course_offering",
          rows: batch,
          onConflict: "course_id,campus_id,academic_unit_id,academic_term_id",
          dryRun: params.dryRun,
          showProgress: false,
        });
      }
      const offeringUpsertTime = Date.now() - offeringUpsertStart;
      stats.offeringsUpserted += allOfferings.length;
      
      const offeringQueryStart = Date.now();
      const offerings = await params.supabase.select({
        table: "course_offering",
        columns: "id,course_id,campus_id,academic_unit_id,academic_term_id",
        limit: allOfferings.length * 2,
      }) as { id: number; course_id: number; campus_id: number; academic_unit_id: number; academic_term_id: number }[];
      const offeringQueryTime = Date.now() - offeringQueryStart;
      
      const offeringIdByCompositeKey = new Map<string, number>();
      for (const o of offerings) {
        const key = `${o.course_id}_${o.campus_id}_${o.academic_unit_id}_${o.academic_term_id}`;
        offeringIdByCompositeKey.set(key, o.id);
      }
      
      const groupBuildStart = Date.now();
      const allGroups: GroupData[] = [];
      const groupKeyToIndex = new Map<string, number>();
      
      for (const periodo of filteredData) {
        const academic_term_id = academicTermIdByKey.get(periodo.periodo);
        if (!academic_term_id) continue;
        
        for (const [cursoCodigo, curso] of periodo.cursos) {
          const course_id = freshMapsAfterProf.courseIdByCode.get(cursoCodigo);
          if (!course_id) continue;
          
          const academic_unit_id = freshMapsAfterProf.academicUnitIdByCode.get(curso.escuela.codigo);
          if (!academic_unit_id) continue;
          
          for (const [, grupo] of curso.grupos) {
            const campus_id = freshMapsAfterProf.campusIdByCode.get(grupo.sede.codigo);
            if (!campus_id) continue;
            
            const offeringKey = `${course_id}_${campus_id}_${academic_unit_id}_${academic_term_id}`;
            const offering_id = offeringIdByCompositeKey.get(offeringKey);
            if (!offering_id) continue;
            
            const groupKeyFull = `${offering_id}_${grupo.numero}`;
            
            if (!groupKeyToIndex.has(groupKeyFull)) {
              const idx = allGroups.length;
              groupKeyToIndex.set(groupKeyFull, idx);
              allGroups.push({
                course_offering_id: offering_id,
                group_code: String(grupo.numero),
                group_type: normalizeGroupType(grupo.modalidad),
                capacity: grupo.capacidad || 0,
                enrolled_count: 0,
              });
            }
          }
        }
      }
      const groupBuildTime = Date.now() - groupBuildStart;
      
      const groupUpsertStart = Date.now();
      for (const batch of chunk(allGroups, 2000)) {
        await params.supabase.upsertMany({
          table: "course_offering_group",
          rows: batch,
          onConflict: "course_offering_id,group_code",
          dryRun: params.dryRun,
          showProgress: false,
        });
      }
      const groupUpsertTime = Date.now() - groupUpsertStart;
      stats.groupsUpserted += allGroups.length;
      
      const groupQueryStart = Date.now();
      const groups = await params.supabase.select({
        table: "course_offering_group",
        columns: "id,course_offering_id,group_code",
        limit: allGroups.length * 2,
      }) as { id: number; course_offering_id: number; group_code: string }[];
      const groupQueryTime = Date.now() - groupQueryStart;
      
      const groupIdByCompositeKey = new Map<string, number>();
      for (const g of groups) {
        const key = `${g.course_offering_id}_${g.group_code}`;
        groupIdByCompositeKey.set(key, g.id);
      }
      
      const finalBuildStart = Date.now();
      const allMeetings: MeetingData[] = [];
      const allGroupProfessors: GroupProfessorData[] = [];
      const groupProfessorsSet = new Set<string>();
      
      for (const periodo of filteredData) {
        const academic_term_id = academicTermIdByKey.get(periodo.periodo);
        if (!academic_term_id) continue;
        
        for (const [cursoCodigo, curso] of periodo.cursos) {
          const course_id = freshMapsAfterProf.courseIdByCode.get(cursoCodigo);
          if (!course_id) continue;
          
          const academic_unit_id = freshMapsAfterProf.academicUnitIdByCode.get(curso.escuela.codigo);
          if (!academic_unit_id) continue;
          
          for (const [, grupo] of curso.grupos) {
            const campus_id = freshMapsAfterProf.campusIdByCode.get(grupo.sede.codigo);
            if (!campus_id) continue;
            
            const offeringKey = `${course_id}_${campus_id}_${academic_unit_id}_${academic_term_id}`;
            const offering_id = offeringIdByCompositeKey.get(offeringKey);
            if (!offering_id) continue;
            
            const groupKeyFull = `${offering_id}_${grupo.numero}`;
            const group_id = groupIdByCompositeKey.get(groupKeyFull);
            if (!group_id) continue;
            
            for (const [, horario] of grupo.horarios) {
              allMeetings.push({
                course_offering_group_id: group_id,
                weekday: horario.weekday,
                starts_at: horario.starts_at,
                ends_at: horario.ends_at,
                classroom: horario.classroom,
              });
            }
            
            for (const prof of grupo.profesores) {
              const professor_id = professorIdByName.get(prof);
              if (professor_id) {
                const key = `${group_id}_${professor_id}`;
                if (!groupProfessorsSet.has(key)) {
                  groupProfessorsSet.add(key);
                  allGroupProfessors.push({
                    course_offering_group_id: group_id,
                    professor_id,
                  });
                }
              }
            }
          }
        }
      }
      const finalBuildTime = Date.now() - finalBuildStart;
      
      const meetingUpsertStart = Date.now();
      for (const batch of chunk(allMeetings, 2000)) {
        await params.supabase.upsertMany({
          table: "course_offering_meeting",
          rows: batch,
          onConflict: "course_offering_group_id,weekday,starts_at,ends_at",
          dryRun: params.dryRun,
          showProgress: false,
        });
      }
      const meetingUpsertTime = Date.now() - meetingUpsertStart;
      stats.meetingsUpserted += allMeetings.length;
      
      const gpUpsertStart = Date.now();
      for (const batch of chunk(allGroupProfessors, 2000)) {
        await params.supabase.upsertMany({
          table: "course_offering_group_professor",
          rows: batch,
          onConflict: "course_offering_group_id,professor_id",
          dryRun: params.dryRun,
          showProgress: false,
        });
      }
      const gpUpsertTime = Date.now() - gpUpsertStart;
      stats.groupProfessorsUpserted += allGroupProfessors.length;
      
      const unitTotalTime = Date.now() - unitStartTime;
      logInfo(`${unit.code}/${year}: Complete in ${unitTotalTime}ms (fetch: ${fetchTime}ms, tec: ${tecdigitalTime}ms, merge: ${mergeTime}ms, maps: ${mapsTime}ms, prof: ${profUpsertTime}ms, profQ: ${professorQueryTime}ms, mapsProf: ${mapsAfterProfTime}ms, offBuild: ${offeringBuildTime}ms, offUp: ${offeringUpsertTime}ms, offQ: ${offeringQueryTime}ms, grpBuild: ${groupBuildTime}ms, grpUp: ${groupUpsertTime}ms, grpQ: ${groupQueryTime}ms, final: ${finalBuildTime}ms, mtUp: ${meetingUpsertTime}ms, gpUp: ${gpUpsertTime}ms) - ${guiaRows.length} rows, ${allOfferings.length} offerings, ${allGroups.length} groups`);
    }
  }
  
  const totalTime = Date.now() - startTime;
  logInfo([
    `Schedule sync completed in ${totalTime}ms:`,
    `- Guia rows fetched: ${stats.guiaRowsFetched}`,
    `- TEC Digital combinations: ${stats.tecdigitalCombinations}`,
    `- Periods processed: ${stats.periodsProcessed}`,
    `- Professors upserted: ${stats.professorsUpserted}`,
    `- Offerings upserted: ${stats.offeringsUpserted}`,
    `- Groups upserted: ${stats.groupsUpserted}`,
    `- Meetings upserted: ${stats.meetingsUpserted}`,
    `- Group professors upserted: ${stats.groupProfessorsUpserted}`,
  ].join("\n"));
  
  logSuccess("Schedule sync completed");
}
