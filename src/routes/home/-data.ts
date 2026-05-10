import type { CalendarEvent, Course } from "@/lib/types";

// Real schedule data from 2026-05-04 week (Mon-Sat)
// Extracted from horario-2026-05-10.ics
const weekStart = new Date(2026, 4, 4); // Monday May 4, 2026

function eventDate(weekday: number, time: string): Date {
  const dayOffset = weekday === 0 ? 6 : weekday - 1;
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  const [hours, minutes] = time.split(":").map(Number);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export const demoCalendarEvents: CalendarEvent[] = [
  {
    id: "MA1403-02-20260505T093000",
    title: "MATEMÁTICA DISCRETA",
    courseName: "MATEMÁTICA DISCRETA",
    courseCode: "MA1403",
    groupCode: "02",
    groupId: "MA1403-02",
    groupType: "REGULAR",
    professors: ["CHAVARRIA MOLINA JEFFRY"],
    classroom: "D3-11",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "violet",
    start: eventDate(2, "09:30"),
    end: eventDate(2, "11:20"),
    courseId: "MA1403",
    group: 2,
  },
  {
    id: "IC1802-05-20260506T073000",
    title: "INTRODUCCIÓN A LA PROGRAMACIÓN",
    courseName: "INTRODUCCIÓN A LA PROGRAMACIÓN",
    courseCode: "IC1802",
    groupCode: "05",
    groupId: "IC1802-05",
    groupType: "SEMIPRESENCIAL",
    professors: ["MATA RODRIGUEZ WILLIAM"],
    classroom: "B6-02",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "orange",
    start: eventDate(3, "07:30"),
    end: eventDate(3, "09:20"),
    courseId: "IC1802",
    group: 5,
  },
  {
    id: "IC1803-05-20260506T093000",
    title: "TALLER DE PROGRAMACIÓN",
    courseName: "TALLER DE PROGRAMACIÓN",
    courseCode: "IC1803",
    groupCode: "05",
    groupId: "IC1803-05",
    groupType: "SEMIPRESENCIAL",
    professors: ["MATA RODRIGUEZ WILLIAM"],
    classroom: "B6-05",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "fuchsia",
    start: eventDate(3, "09:30"),
    end: eventDate(3, "11:20"),
    courseId: "IC1803",
    group: 5,
  },
  {
    id: "CI1106-23-20260507T130000",
    title: "COMUNICACIÓN ESCRITA",
    courseName: "COMUNICACIÓN ESCRITA",
    courseCode: "CI1106",
    groupCode: "23",
    groupId: "CI1106-23",
    groupType: "VIRTUAL",
    professors: ["ROMERO ALVAREZ ERICKA"],
    classroom: null,
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "yellow",
    start: eventDate(4, "13:00"),
    end: eventDate(4, "15:50"),
    courseId: "CI1106",
    group: 23,
  },
  {
    id: "MA1403-02-20260507T093000",
    title: "MATEMÁTICA DISCRETA",
    courseName: "MATEMÁTICA DISCRETA",
    courseCode: "MA1403",
    groupCode: "02",
    groupId: "MA1403-02",
    groupType: "REGULAR",
    professors: ["CHAVARRIA MOLINA JEFFRY"],
    classroom: "D3-11",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "violet",
    start: eventDate(4, "09:30"),
    end: eventDate(4, "11:20"),
    courseId: "MA1403",
    group: 2,
  },
  {
    id: "IC1802-05-20260508T073000",
    title: "INTRODUCCIÓN A LA PROGRAMACIÓN",
    courseName: "INTRODUCCIÓN A LA PROGRAMACIÓN",
    courseCode: "IC1802",
    groupCode: "05",
    groupId: "IC1802-05",
    groupType: "SEMIPRESENCIAL",
    professors: ["MATA RODRIGUEZ WILLIAM"],
    classroom: "B6-02",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "orange",
    start: eventDate(5, "07:30"),
    end: eventDate(5, "09:20"),
    courseId: "IC1802",
    group: 5,
  },
  {
    id: "IC1803-05-20260508T093000",
    title: "TALLER DE PROGRAMACIÓN",
    courseName: "TALLER DE PROGRAMACIÓN",
    courseCode: "IC1803",
    groupCode: "05",
    groupId: "IC1803-05",
    groupType: "SEMIPRESENCIAL",
    professors: ["MATA RODRIGUEZ WILLIAM"],
    classroom: "B6-05",
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "fuchsia",
    start: eventDate(5, "09:30"),
    end: eventDate(5, "11:20"),
    courseId: "IC1803",
    group: 5,
  },
  {
    id: "CI1230-11-20260508T130000",
    title: "INGLÉS I",
    courseName: "INGLÉS I",
    courseCode: "CI1230",
    groupCode: "11",
    groupId: "CI1230-11",
    groupType: "VIRTUAL",
    professors: ["HERRERA JIMENEZ INGRID"],
    classroom: null,
    campusName: "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    color: "red",
    start: eventDate(5, "13:00"),
    end: eventDate(5, "15:50"),
    courseId: "CI1230",
    group: 11,
  },
];

// Static curriculum data for course relation graph demo
// Real data from IC4301 - BASES DE DATOS I (plan 48, Ingeniería en Computación 2022)
export const demoRelationCourse: Course = {
  id: "IC4301",
  code: "IC4301",
  name: "BASES DE DATOS I",
  credits: 4,
  hours: 9,
  semester: 3,
  status: "not_taken",
  prerequisites: ["IC2001"],
  corequisites: ["MA1103"],
};

export const demoPrerequisites: Course[] = [
  {
    id: "IC2001",
    code: "IC2001",
    name: "ESTRUCTURAS DE DATOS",
    credits: 4,
    hours: 12,
    semester: 2,
    status: "not_taken",
    prerequisites: ["IC1802", "IC1803"],
    corequisites: [],
  },
];

export const demoCorequisites: Course[] = [
  {
    id: "MA1103",
    code: "MA1103",
    name: "CÁLCULO Y ÁLGEBRA LINEAL",
    credits: 4,
    hours: 4,
    semester: 3,
    status: "not_taken",
    prerequisites: ["MA1102"],
    corequisites: [],
  },
];

export const demoDependents: Course[] = [
  {
    id: "IC4302",
    code: "IC4302",
    name: "BASES DE DATOS II",
    credits: 3,
    hours: 9,
    semester: 4,
    status: "not_taken",
    prerequisites: ["IC4301"],
    corequisites: [],
  },
];
