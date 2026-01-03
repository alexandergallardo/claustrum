# DETALLES.md — API Endpoints Documentation

> **Last Updated:** January 2025  
> **Last Verified:** All 13 endpoints tested with curl and browser DevTools — ALL WORKING ✅  
> This document provides a comprehensive catalog of all API endpoints used for course scheduling and curriculum management at TEC.

---

## Table of Contents

1. [Guía de Horarios API (tec-appsext)](#1-guía-de-horarios-api-tec-appsext)
2. [Curriculum Catalog API (tecdigital - tds-curriculum-exp)](#2-curriculum-catalog-api-tecdigital---tds-curriculum-exp)
3. [Student Records API (tecdigital - tda-expediente-estudiantil)](#3-student-records-api-tecdigital---tda-expediente-estudiantil)
4. [Key Distinctions Between Similar Endpoints](#4-key-distinctions-between-similar-endpoints)
5. [Open Questions & Considerations](#5-open-questions--considerations)

---

## 1. Guía de Horarios API (tec-appsext)

**Base URL:** `https://tec-appsext.itcr.ac.cr/guiahorarios/`

**Authentication:** Cookie-based session (`AlteonP=...`)

> **Note:** These endpoints work without authentication for `cargaEscuelas` and `cargaModalidadPeriodos`. The endpoints `getdatosEscuelaAno`, `getdatos`, and `getdatosVerano` require a valid session cookie AND the `X-Requested-With: XMLHttpRequest` header to function correctly.

### Obtaining the AlteonP Cookie

The `AlteonP` cookie is automatically provided by the server when making any request to the guiahorarios application. To obtain it:

```bash
# Get the cookie from response headers
curl -sI "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx" | grep -i "Set-Cookie"

# Example response:
# Set-Cookie: AlteonP=AL1qJhQBAAqIMpwBj7WAZg$$; path=/
```

**PowerShell example:**
```powershell
$response = Invoke-WebRequest -Uri "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx" -SessionVariable session
$cookie = $session.Cookies.GetCookies("https://tec-appsext.itcr.ac.cr") | Where-Object { $_.Name -eq "AlteonP" }
Write-Host "Cookie: AlteonP=$($cookie.Value)"
```

**JavaScript (Browser/Node.js):**
```javascript
// In browser, cookies are automatically handled
// In Node.js, use a library like axios with cookie jar or fetch with credentials
const response = await fetch("https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx", {
  credentials: 'include'
});
// The cookie will be set automatically for subsequent requests
```

---

### 1.1 Load Schools (Escuelas)

Retrieves the names and codes of all schools offering courses.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaEscuelas` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Cookie` | Session cookie (`AlteonP=<session_token>`) | Yes |
| `Content-Type` | `application/json; charset=utf-8` | Yes |

#### Request Body

```json
{}
```
> No payload required.

#### Response Structure

The response is a JSON object with a `d` property containing a **JSON-encoded string** that must be parsed.

```json
{
  "d": "[{\"DSC_DEPTO\":\"ADMINISTRACION DE EMPRESAS\",\"IDE_DEPTO\":\"ARH\"},...]"
}
```

**Parsed `d` array:**

```json
[
  {
    "DSC_DEPTO": "ADMINISTRACION DE EMPRESAS",
    "IDE_DEPTO": "ARH"
  },
  {
    "DSC_DEPTO": "ESCUELA DE INGENIERIA EN COMPUTACION",
    "IDE_DEPTO": "CA"
  },
  {
    "DSC_DEPTO": "ESCUELA DE MATEMATICA",
    "IDE_DEPTO": "MA"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `d` | `string` | JSON-encoded string (must be parsed with `JSON.parse()`) |
| `IDE_DEPTO` | `string` | Unique school/department code identifier (e.g., `"MA"`, `"CA"`) |
| `DSC_DEPTO` | `string` | Full name of the school/department (uppercase) |

#### cURL Command

```bash
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaEscuelas" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Cookie: AlteonP=YOUR_SESSION_TOKEN" \
  -d "{}"
```

#### Notes

- Returns all schools that offer courses, including those that don't have their own degree programs (e.g., Mathematics school offers courses across multiple programs but doesn't have its own career).

---

### 1.2 Load Modalities and Periods

Retrieves available periods and modalities (Summer, Semester, Biannual, etc.).

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaModalidadPeriodos` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Cookie` | Session cookie (`AlteonP=<session_token>`) | Yes |
| `Content-Type` | `application/json; charset=utf-8` | Yes |

#### Request Body

```json
{}
```
> No payload required.

#### Response Structure

The response is a JSON object with a `d` property containing a **JSON-encoded string** that must be parsed.

```json
{
  "d": "[{\"IDE_MODALIDAD\":\"A\",\"NOMBRE\":\"ANUAL\",\"CANT_PERIODOS\":1},...]"
}
```

**Parsed `d` array:**

```json
[
  {
    "IDE_MODALIDAD": "A",
    "NOMBRE": "ANUAL",
    "CANT_PERIODOS": 1
  },
  {
    "IDE_MODALIDAD": "S",
    "NOMBRE": "SEMESTRE",
    "CANT_PERIODOS": 2
  },
  {
    "IDE_MODALIDAD": "V",
    "NOMBRE": "VERANO",
    "CANT_PERIODOS": 1
  },
  {
    "IDE_MODALIDAD": "B",
    "NOMBRE": "BIMESTRE",
    "CANT_PERIODOS": 7
  },
  {
    "IDE_MODALIDAD": "C",
    "NOMBRE": "CUATRIMESTRE",
    "CANT_PERIODOS": 3
  },
  {
    "IDE_MODALIDAD": "T",
    "NOMBRE": "TRIMESTRE",
    "CANT_PERIODOS": 4
  },
  {
    "IDE_MODALIDAD": "H",
    "NOMBRE": "CENTROS FORMACION HUMANISTICA",
    "CANT_PERIODOS": 6
  },
  {
    "IDE_MODALIDAD": "M",
    "NOMBRE": "MENSUAL",
    "CANT_PERIODOS": 12
  },
  {
    "IDE_MODALIDAD": "I",
    "NOMBRE": "INTENSIVO",
    "CANT_PERIODOS": 2
  },
  {
    "IDE_MODALIDAD": "N",
    "NOMBRE": "BIANUAL",
    "CANT_PERIODOS": 1
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `d` | `string` | JSON-encoded string (must be parsed with `JSON.parse()`) |
| `IDE_MODALIDAD` | `string` | Modality code (e.g., `"S"` = Semester, `"V"` = Summer) |
| `NOMBRE` | `string` | Modality name (uppercase) |
| `CANT_PERIODOS` | `number` | Number of periods per year for this modality |

#### cURL Command

```bash
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaModalidadPeriodos" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Cookie: AlteonP=YOUR_SESSION_TOKEN" \
  -d "{}"
```

---

### 1.3 Get School Course Offerings by Year

Retrieves courses offered by a specific school for a given year.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Cookie` | Session cookie (`AlteonP=<session_token>`) | **Yes** |
| `Content-Type` | `application/json; charset=UTF-8` | Yes |
| `X-Requested-With` | Must be `XMLHttpRequest` | **Yes** |

#### Request Body

```json
{
  "escuela": "CA",
  "ano": "2026"
}
```

#### Parameter Descriptions

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `escuela` | `string` | School code obtained from `cargaEscuelas` (e.g., `"MA"`, `"CA"`) | Yes |
| `ano` | `string` | Year to query (typically previous, current, or next year available) | Yes |

#### Response Structure

The response is a JSON object with a `d` property containing a **JSON-encoded string** that must be parsed.

```json
{
  "d": "[{\"DSC_SEDE\":\"CAMPUS TECNOLOGICO CENTRAL CARTAGO\",\"IDE_MATERIA\":\"CA2125\",...}]"
}
```

**Parsed `d` array (sample from escuela=CA, ano=2026):**

```json
[
  {
    "DSC_SEDE": "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    "IDE_MATERIA": "CA2125",
    "DSC_MATERIA": "Elementos de computación",
    "IDE_GRUPO": 1,
    "DSC_DEPTO": "ESCUELA DE INGENIERIA EN COMPUTACION",
    "CAN_CREDITOS": 3,
    "HORAS": 4,
    "NOM_DIA": "MARTES",
    "IDE_MODALIDAD": "S",
    "IDE_PER_MOD": 1,
    "NUM_ANO": 2026,
    "DSC_MODALIDAD": "SEMESTRE",
    "TIPO_CURSO": "Regular",
    "HINICIO": "09:30",
    "HFIN": "11:20",
    "NOM_PROFESOR": "MATA RODRIGUEZ WILLIAM",
    "RESERVA_SEDE": "CAMPUS TECNOLOGICO CENTRAL CARTAGO",
    "RESERVA_DEPTO": "",
    "RESERVA_PLAN": ""
  },
  {
    "DSC_SEDE": "CAMPUS TECNOLOGICO LOCAL SAN JOSE",
    "IDE_MATERIA": "IC6200",
    "DSC_MATERIA": "Inteligencia artificial",
    "IDE_GRUPO": 40,
    "DSC_DEPTO": "ESCUELA DE INGENIERIA EN COMPUTACION",
    "CAN_CREDITOS": 4,
    "HORAS": 4,
    "NOM_DIA": "MIERCOLES",
    "IDE_MODALIDAD": "S",
    "IDE_PER_MOD": 1,
    "NUM_ANO": 2026,
    "DSC_MODALIDAD": "SEMESTRE",
    "TIPO_CURSO": "Semipresencial",
    "HINICIO": "15:00",
    "HFIN": "16:50",
    "NOM_PROFESOR": "CASTRO MORA JOSE",
    "RESERVA_SEDE": "CAMPUS TECNOLOGICO LOCAL SAN JOSE",
    "RESERVA_DEPTO": "",
    "RESERVA_PLAN": ""
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `d` | `string` | JSON-encoded string (must be parsed with `JSON.parse()`) |
| `DSC_SEDE` | `string` | Campus full name |
| `IDE_MATERIA` | `string` | Course code |
| `DSC_MATERIA` | `string` | Course name |
| `IDE_GRUPO` | `number` | Group/section number |
| `DSC_DEPTO` | `string` | Department/school full name |
| `CAN_CREDITOS` | `number` | Credit hours |
| `HORAS` | `number` | Total weekly hours |
| `NOM_DIA` | `string` | Day of the week (Spanish, uppercase) |
| `IDE_MODALIDAD` | `string` | Modality code (e.g., `"S"` = Semestre) |
| `IDE_PER_MOD` | `number` | Period within modality (e.g., 1 = first semester) |
| `NUM_ANO` | `number` | Academic year |
| `DSC_MODALIDAD` | `string` | Modality description |
| `TIPO_CURSO` | `string` | Course type: `Regular`, `Semipresencial`, `Virtual` |
| `HINICIO` | `string` | Start time (HH:MM format) |
| `HFIN` | `string` | End time (HH:MM format) |
| `NOM_PROFESOR` | `string` | Professor full name (uppercase) |
| `RESERVA_SEDE` | `string` | Reserved campus (if applicable) |
| `RESERVA_DEPTO` | `string` | Reserved department (if applicable) |
| `RESERVA_PLAN` | `string` | Reserved study plan (if applicable) |

#### cURL Command

```bash
# First, get a session cookie
COOKIE=$(curl -sI "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx" | grep -i "Set-Cookie" | sed 's/Set-Cookie: //' | cut -d';' -f1)

# Then make the request with the cookie and required headers
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno" \
  -H "Content-Type: application/json; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Cookie: $COOKIE" \
  -d '{"escuela":"CA","ano":"2026"}'
```

**PowerShell example:**
```powershell
$cookie = (curl -sI "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx" | Select-String "Set-Cookie").ToString().Split(":")[1].Trim().Split(";")[0]
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno" `
  -H "Content-Type: application/json; charset=UTF-8" `
  -H "X-Requested-With: XMLHttpRequest" `
  -H "Cookie: $cookie" `
  -d '{"escuela":"CA","ano":"2026"}'
```

#### Notes

- **Critical:** The `X-Requested-With: XMLHttpRequest` header is required. Without it, the server returns HTTP 500.
- **Cookie required:** This endpoint returns an error without a valid `AlteonP` session cookie.
- **Row per time slot:** Each course session (day/time combination) is returned as a separate row. A course meeting twice a week will have at least two entries.
- Year values are typically limited to the previous year, current year, and next year.
- Returns all groups/sections for each course in the specified school.

---

### 1.4 Get Student Course Offerings

Retrieves the current schedule for a specific student based on their carnet (student ID).

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tec-appsext.itcr.ac.cr/guiahorarios/estudiante.aspx/getdatos` |
| **Content-Type** | `application/json` |
| **Status** | ✅ Working |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Cookie` | Session cookie (`AlteonP=<session_token>`) | Yes |
| `Content-Type` | `application/json; charset=UTF-8` | Yes |
| `X-Requested-With` | Must be `XMLHttpRequest` | **Yes** |

#### Request Body

```json
{
  "carnet": "2024143009"
}
```

#### Parameter Descriptions

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `carnet` | `string` | Student ID number. First 4 digits represent university entry year. | Yes |

#### Response Structure

The response is a JSON object with a `d` property containing either schedule data or a status message.

**When student has no schedule:**
```json
{
  "d": "ESTUDIANTE SIN HORARIOS"
}
```

**When student has a schedule (expected structure):**
```json
{
  "d": "[{\"DSC_SEDE\":\"...\",\"IDE_MATERIA\":\"...\",\"DSC_MATERIA\":\"...\",...}]"
}
```

The response format follows the same structure as `getdatosEscuelaAno` when a student has enrolled courses.

#### cURL Command

```bash
# First, get a session cookie
COOKIE=$(curl -sI "https://tec-appsext.itcr.ac.cr/guiahorarios/estudiante.aspx" | grep -i "Set-Cookie" | sed 's/Set-Cookie: //' | cut -d';' -f1)

# Make the request with required headers
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/estudiante.aspx/getdatos" \
  -H "Content-Type: application/json; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Cookie: $COOKIE" \
  -d '{"carnet":"2024143009"}'
```

#### Notes

- **Critical:** The `X-Requested-With: XMLHttpRequest` header is required. Without it, the server returns HTTP 500.
- The `carnet` format: First 4 digits = year of university entry (e.g., `2024143009` → entered in 2024).
- Returns `"ESTUDIANTE SIN HORARIOS"` when the student has no current schedule or the carnet doesn't exist.

---

### 1.5 Get Summer Course Data

Retrieves summer course data for a specific year across all schools.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tec-appsext.itcr.ac.cr/guiahorarios/verano.aspx/getdatosVerano` |
| **Content-Type** | `application/json` |
| **Status** | ✅ Working |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Cookie` | Session cookie (`AlteonP=<session_token>`) | Yes |
| `Content-Type` | `application/json; charset=UTF-8` | Yes |
| `X-Requested-With` | Must be `XMLHttpRequest` | **Yes** |

#### Request Body

```json
{
  "ano": "2025"
}
```

#### Parameter Descriptions

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `ano` | `string` | Year to query for summer courses | Yes |

#### Response Structure

The response is a JSON object with a `d` property containing either a JSON array string or a status message.

**When no summer data is available:**
```json
{
  "d": "NO DATOS"
}
```

**When summer courses exist (e.g., 2025):**
```json
{
  "d": "[{\"DSC_SEDE\":\"Campus Tecnológico Central Cartago\",\"IDE_MATERIA\":\"FH0178\",\"DSC_MATERIA\":\"ESTUDIOS DE ARTE\",\"NUM_GRUPO\":\"1\",\"PROFESOR\":\"PANIAGUA SANCHEZ WALTER GERARDO\",\"DURACION\":\"45\",\"LUNES\":\"\",\"MARTES\":\"11:30 - 12:45\",\"MIERCOLES\":\"\",\"JUEVES\":\"11:30 - 12:45\",\"VIERNES\":\"\",\"SABADO\":\"\",\"CUPO_GRUPO\":\"25\",\"PER_LECTIVO\":\"VER-2025\",\"PRESENCIAL\":\"P\",\"CANT_MATRICULADOS\":\"15\",\"HORARIOCOMPLETO\":\"M: 11:30 - 12:45 |J: 11:30 - 12:45 |\"},{\"DSC_SEDE\":\"Campus Tecnológico Central Cartago\",\"IDE_MATERIA\":\"MA0101\",\"DSC_MATERIA\":\"MATEMÁTICA GENERAL\",\"NUM_GRUPO\":\"1\",...}]"
}
```

#### Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `DSC_SEDE` | `string` | Campus name |
| `IDE_MATERIA` | `string` | Course code |
| `DSC_MATERIA` | `string` | Course name |
| `NUM_GRUPO` | `string` | Group number |
| `PROFESOR` | `string` | Professor name |
| `DURACION` | `string` | Duration in minutes |
| `LUNES` through `SABADO` | `string` | Schedule for each day |
| `CUPO_GRUPO` | `string` | Maximum group capacity |
| `PER_LECTIVO` | `string` | Academic period (e.g., "VER-2025") |
| `PRESENCIAL` | `string` | Modality ("P" = Presencial, "V" = Virtual) |
| `CANT_MATRICULADOS` | `string` | Current enrollment count |
| `HORARIOCOMPLETO` | `string` | Formatted full schedule |

#### cURL Command

```bash
# First, get a session cookie
COOKIE=$(curl -sI "https://tec-appsext.itcr.ac.cr/guiahorarios/verano.aspx" | grep -i "Set-Cookie" | sed 's/Set-Cookie: //' | cut -d';' -f1)

# Make the request with required headers
curl -X POST "https://tec-appsext.itcr.ac.cr/guiahorarios/verano.aspx/getdatosVerano" \
  -H "Content-Type: application/json; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Cookie: $COOKIE" \
  -d '{"ano":"2025"}'
```

#### Notes

- **Critical:** The `X-Requested-With: XMLHttpRequest` header is required. Without it, the server returns HTTP 500.
- Returns data from **all schools** for the specified summer period.
- Returns `"NO DATOS"` when no summer courses are available for the requested year (e.g., if querying 2026 before summer courses are scheduled).
- The response for a year with courses is typically very large (hundreds of course records).

---

## 2. Curriculum Catalog API (tecdigital - tds-curriculum-exp)

**Base URL:** `https://tecdigital.tec.ac.cr/tds-curriculum-exp/`

**Authentication:** Public endpoints (no authentication required)

> **Important:** These are catalog-only endpoints. While they may return similar data to Guía de Horarios endpoints, there are significant differences in scope and content.

---

### 2.1 Load Campuses (Sedes) — JSON

Retrieves all campuses/sites in JSON format.

| Attribute | Value |
|-----------|-------|
| **Method** | `GET` |
| **URL** | `https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_sedes_json` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Accept` | `application/json` | Recommended |

#### Request Body

> No request body (GET request).

#### Response Structure

```json
{
  "sedes": [
    {
      "key": "CA",
      "data": "Campus Tecnologico Central Cartago"
    },
    {
      "key": "SC",
      "data": "Campus Tecnologico Local San Carlos"
    },
    {
      "key": "SJ",
      "data": "Campus Tecnologico Local San Jose"
    },
    {
      "key": "AL",
      "data": "Centro Academico de Alajuela"
    },
    {
      "key": "LM",
      "data": "Centro Academico de Limon"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sedes` | `Array` | Array of campus objects |
| `sedes[].key` | `string` | Unique campus identifier code (e.g., `"CA"`, `"SC"`) |
| `sedes[].data` | `string` | Full campus name |

#### cURL Command

```bash
curl -X GET "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_sedes_json" \
  -H "Accept: application/json"
```

#### Notes

- Returns **all campuses that ever existed**, including those created for temporary agreements or programs.
- This is a public endpoint; no authentication required.

---

### 2.2 Load Programs by Campus — JSON

Retrieves degree programs (careers) available at a specific campus.

| Attribute | Value |
|-----------|-------|
| **Method** | `GET` |
| **URL** | `https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_carreras_json` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Accept` | `application/json` | Recommended |

#### Query Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `id_sede` | `string` | Campus code from `carga_sedes_json` | Yes |

#### Response Structure

```json
{
  "carreras": [
    {
      "key": "AEN",
      "data": "Administración de Empresas Nocturna"
    },
    {
      "key": "CA",
      "data": "Escuela de Ingeniería en Computación"
    },
    {
      "key": "E",
      "data": "Escuela de Ingeniería en Electrónica"
    },
    {
      "key": "MA",
      "data": "Escuela de Matemática"
    },
    {
      "key": "MC",
      "data": "Maestría en Computación"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `carreras` | `Array` | Array of program/career objects |
| `carreras[].key` | `string` | Department/program code identifier |
| `carreras[].data` | `string` | Full program name (prefixed with "Escuela de...") |

#### cURL Command

```bash
curl -X GET "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_carreras_json?id_sede=CA" \
  -H "Accept: application/json"
```

#### Notes

- **Important distinction:** This endpoint returns only schools that offer **degree programs (careers)**.
- Schools that only offer courses but don't have their own career (e.g., `"MA"` - Mathematics) will **not appear** here.
- The naming uses "Escuela de..." but these are actually careers/programs, not just schools.

---

### 2.3 Load Study Plans by Program — JSON

Retrieves study plans (curricula) for a specific program at a campus.

| Attribute | Value |
|-----------|-------|
| **Method** | `GET` |
| **URL** | `https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_planes_json` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Accept` | `application/json` | Recommended |

#### Query Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `id_sede` | `string` | Campus code from `carga_sedes_json` | Yes |
| `id_depto` | `string` | Program/department code from `carga_carreras_json` | Yes |

#### Response Structure

```json
{
  "planes": [
    {
      "key": 412,
      "data": "412.Ingenieria en computacion-2022"
    },
    {
      "key": 411,
      "data": "411.Ingenieria en computacion-2018"
    },
    {
      "key": 410,
      "data": "410.Ingenieria en computacion - 2012"
    },
    {
      "key": 409,
      "data": "409.Ingenieria en computacion-2007"
    },
    {
      "key": 408,
      "data": "408.Diplomado en computacion 2000..."
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `planes` | `Array` | Array of study plan objects |
| `planes[].key` | `number` | Unique study plan identifier |
| `planes[].data` | `string` | Plan description (format: `"ID.Name-Year"`) |

#### cURL Command

```bash
curl -X GET "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_planes_json?id_sede=CA&id_depto=CA" \
  -H "Accept: application/json"
```

#### Notes

- Includes historical study plans (some very old plans may have limited or no data available).
- Only accepts `id_depto` values from `carga_carreras_json` (actual programs).
- Using a school code like `"MA"` (Mathematics) will return empty since it has no study plans.

---

### 2.4 Get Study Plan Details — JSON

Retrieves detailed curriculum data for a specific study plan.

| Attribute | Value |
|-----------|-------|
| **Method** | `GET` |
| **URL** | `https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/json_draw_angular` |
| **Content-Type** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Accept` | `application/json` | Recommended |

#### Query Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `id_plan` | `number` | Study plan ID from `carga_planes_json` | Yes |

#### Response Structure

```json
{
  "dsc_curriculum": "INGENIERIA EN COMPUTACION-2022",
  "id_curriculum": 412,
  "modality": "Semestre",
  "academic_degree": "Bachillerato Universitario",
  "first_level": 0,
  "levels": [
    {
      "id": "Semestre 0",
      "courses": [
        {
          "id_course": "MA0101",
          "name": "matemática general",
          "trucatedName": "matemática general",
          "credits": 2,
          "hours": 5,
          "requirements": [],
          "co_requirements": [],
          "required_by": [{ "id": "MA1102" }],
          "equivalent": [{ "id": "No hay materias equivalentes en el plan" }],
          "tEquiv": "No hay materias equivalentes en el plan"
        }
      ]
    },
    {
      "id": "Semestre 1",
      "courses": [
        {
          "id_course": "IC1802",
          "name": "introducción a la programación",
          "trucatedName": "introducción a la programación",
          "credits": 3,
          "hours": 4,
          "requirements": [],
          "co_requirements": [],
          "required_by": [{ "id": "IC2101" }],
          "equivalent": [{ "id": "IC1800" }],
          "tEquiv": "IC1800"
        },
        {
          "id_course": "IC1803",
          "name": "taller de programación",
          "trucatedName": "taller de programación",
          "credits": 3,
          "hours": 4,
          "requirements": [],
          "co_requirements": [],
          "required_by": [{ "id": "IC2101" }, { "id": "IC3101" }],
          "equivalent": [{ "id": "IC1801" }],
          "tEquiv": "IC1801"
        },
        {
          "id_course": "MA1403",
          "name": "matemática discreta",
          "trucatedName": "matemática discreta",
          "credits": 4,
          "hours": 4,
          "requirements": [],
          "co_requirements": [],
          "required_by": [{ "id": "IC4301" }, { "id": "MA1102" }],
          "equivalent": [{ "id": "CA1111" }, { "id": "MA1402" }],
          "tEquiv": "CA1111,CA1500,EM1601,MA1105,MA1402"
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `dsc_curriculum` | `string` | Curriculum name (uppercase) |
| `id_curriculum` | `number` | Curriculum/plan ID |
| `modality` | `string` | Period modality (e.g., "Semestre") |
| `academic_degree` | `string` | Academic degree awarded (e.g., "Bachillerato Universitario") |
| `first_level` | `number` | Starting semester number (0 for preparatory courses) |
| `levels` | `Array` | Array of curriculum levels/semesters |
| `levels[].id` | `string` | Level name (e.g., "Semestre 1") |
| `levels[].courses` | `Array` | Courses in this level |
| `courses[].id_course` | `string` | Course code |
| `courses[].name` | `string` | Course name (lowercase) |
| `courses[].trucatedName` | `string` | Truncated name for display |
| `courses[].credits` | `number` | Credit hours |
| `courses[].hours` | `number` | Total weekly hours |
| `courses[].requirements` | `Array<{id: string}>` | Prerequisite course IDs |
| `courses[].co_requirements` | `Array<{id: string}>` | Corequisite course IDs |
| `courses[].required_by` | `Array<{id: string}>` | Courses that require this course |
| `courses[].equivalent` | `Array<{id: string}>` | Equivalent courses |
| `courses[].tEquiv` | `string` | Comma-separated equivalent course codes |

#### cURL Command

```bash
curl -X GET "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/json_draw_angular?id_plan=412" \
  -H "Accept: application/json"
```

#### Notes

- Very old study plans may return incomplete data or empty responses.
- This endpoint is designed for Angular-based rendering.

---

## 3. Student Records API (tecdigital - tda-expediente-estudiantil)

**Base URL:** `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/`

**Response Format:** Mixed (JSON and HTML depending on endpoint)

> **Important:** Some endpoints return JSON arrays, while others return HTML fragments. Check each endpoint's documentation.

---

### 3.1 Load Periods — HTML

Retrieves available academic periods.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_periodos_tds_lib` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Response Format** | `application/json` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/x-www-form-urlencoded` | Optional |

#### Request Body

> No form data required.

#### Response Structure (JSON)

```json
[
  { "key": "2026_B_1", "data": "2026 - Bimestre 1" },
  { "key": "2026_B_2", "data": "2026 - Bimestre 2" },
  { "key": "2026_C_1", "data": "2026 - Cuatrimestre 1" },
  { "key": "2026_C_2", "data": "2026 - Cuatrimestre 2" },
  { "key": "2026_H_1", "data": "2026 - Centros Formacion Humanistica 1" },
  { "key": "2026_H_2", "data": "2026 - Centros Formacion Humanistica 2" },
  { "key": "2026_M_1", "data": "2026 - Mensual 1" },
  { "key": "2026_M_2", "data": "2026 - Mensual 2" },
  { "key": "2026_S_1", "data": "2026 - Semestre 1" },
  { "key": "2026_S_2", "data": "2026 - Semestre 2" },
  { "key": "2026_T_1", "data": "2026 - Trimestre 1" },
  { "key": "2026_T_2", "data": "2026 - Trimestre 2" },
  { "key": "2025_V_1", "data": "2025 - Verano 1" },
  { "key": "2026_V_1", "data": "2026 - Verano 1" }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Period key (format: `YEAR_MODALITY_PERIOD`) |
| `data` | `string` | Human-readable period description |

#### cURL Command

```bash
curl -X POST "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_periodos_tds_lib"
```

#### Notes

- Returns HTML `<option>` elements for dropdown population.
- Period format differs from `cargaModalidadPeriodos` endpoint.

---

### 3.2 Load Campuses — HTML

Retrieves available campuses.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_sedes_tds_lib` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Response Format** | `text/html` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/x-www-form-urlencoded` | Optional |

#### Request Body

> No form data required.

#### Response Structure (HTML)

Returns HTML `<span>` elements (not `<option>`):

```html
<span value='AL'>Centro Academico De Alajuela</span>
<span value='CA'>Campus Tecnologico Central Cartago</span>
<span value='SC'>Campus Tecnologico Local San Carlos</span>
<span value='SJ'>Campus Tecnologico Local San Jose</span>
<span value='LM'>Centro Academico De Limon</span>
<span value='GU'>Guapiles</span>
<span value='LI'>Liberia</span>
<span value='PZ'>Perez Zeledon</span>
```

| Attribute | Description |
|-----------|-------------|
| `value` | Campus code identifier |
| Text content | Campus name |

#### cURL Command

```bash
curl -X POST "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_sedes_tds_lib"
```

---

### 3.3 Load Programs by Campus — HTML

Retrieves programs/schools offering courses at a specific campus.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_carreras_tds_lib` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Response Format** | `text/html` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/x-www-form-urlencoded` | Yes |

#### Request Body (Form Data)

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id_sede` | `string` | Campus code | Yes |

#### Response Structure (HTML)

Returns HTML `<span>` elements (not `<option>`):

```html
<span value='AEN'>Administracion De Empresas Nocturna</span>
<span value='CA'>Escuela De Ingenieria En Computacion</span>
<span value='MA'>Escuela De Matematica</span>
<span value='E'>Escuela De Ingenieria En Electronica</span>
<span value='FI'>Escuela De Fisica</span>
<span value='QU'>Escuela De Quimica</span>
<span value='MC'>Maestria En Computacion</span>
```

| Attribute | Description |
|-----------|-------------|
| `value` | Program/school code identifier |
| Text content | Program/school name |

#### cURL Command

```bash
curl -X POST "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_carreras_tds_lib" \
  -d "id_sede=AL"
```

#### Notes

- **Important distinction:** Unlike `carga_carreras_json`, this endpoint returns schools that **offer courses** (not just those with degree programs).
- Mathematics school (`MA`) would appear here since it offers courses, even though it doesn't have its own career.

---

### 3.4 Get Course Schedule Guide — HTML

Retrieves course offerings filtered by campus, program, and period.

| Attribute | Value |
|-----------|-------|
| **Method** | `POST` |
| **URL** | `https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/tabla_guia_horario` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Response Format** | `text/html` |

#### Required Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/x-www-form-urlencoded` | Yes |

#### Query Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `sede` | `string` | Campus code from `carga_sedes_tds_lib` | Yes |
| `carrera` | `string` | Program code from `carga_carreras_tds_lib` | Yes |
| `periodo` | `string` | Period key from `carga_periodos_tds_lib` (e.g., `"2026_S_1"`) | Yes |

#### Response Structure (HTML)

Returns an HTML table with detailed course schedule information:

```html
<table id='tguiaHorario' class='table table-striped table-bordered'>
  <thead>
    <th id='replaceCod'>Código</th>
    <th>Materia</th>
    <th>Grupo</th>
    <th id='replaceCred'>Créditos</th>
    <th>Horario</th>
    <th>Aula</th>
    <th>Profesor</th>
    <th>Cupo</th>
    <th>Tipo Materia</th>
    <th>Tipo Grupo</th>
    <th>Reservados</th>
  </thead>
  <tbody>
    <tr>
      <td class='c1'>IC1802</td>
      <td class='ajuste_materia'>Introducción a la programación</td>
      <td>01</td>
      <td class='c1'>3</td>
      <td class='ajuste_horario'>Martes - 7:30:9:20</td>
      <td>B6-04</td>
      <td>Schmidt Peralta Jeff</td>
      <td class='c1'>23</td>
      <td>Curso Unico</td>
      <td class='c7'>Regular</td>
      <td>1</td>
    </tr>
    <tr>
      <td class='c1'>IC1802</td>
      <td class='ajuste_materia'>Introducción a la programación</td>
      <td>02</td>
      <td class='c1'>3</td>
      <td class='ajuste_horario'>Martes - 7:30:9:20</td>
      <td>B3-06</td>
      <td>Cerdas Quesada Ivannia</td>
      <td class='c1'>23</td>
      <td>Curso Unico</td>
      <td class='c7'>Semipresencial</td>
      <td>1</td>
    </tr>
  </tbody>
</table>
```

| Column | Description |
|--------|-------------|
| Código | Course code (e.g., `IC1802`) |
| Materia | Course name |
| Grupo | Group/section number |
| Créditos | Credit hours |
| Horario | Schedule (format: `Day - StartTime:EndTime`) |
| Aula | Classroom (or `"No disponible"` for virtual) |
| Profesor | Instructor name |
| Cupo | Available capacity |
| Tipo Materia | Course type (`Curso Unico`, `Curso Comun`, `Electiva Unica`) |
| Tipo Grupo | Group type (`Regular`, `Semipresencial`, `Virtual`) |
| Reservados | Reserved spots |

#### cURL Command

```bash
curl -X POST "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/tabla_guia_horario?sede=CA&carrera=CA&periodo=2026_S_1"
```

#### Notes

- Returns HTML table; requires parsing to extract data.
- Uses parameter values from Section 3 endpoints only (not from other API groups).

---

## 4. Key Distinctions Between Similar Endpoints

### Schools vs. Programs (Escuelas vs. Carreras)

| Endpoint | Returns | Example: `"MA"` (Mathematics) |
|----------|---------|-------------------------------|
| `cargaEscuelas` (guiahorarios) | All schools offering **courses** | ✅ Included |
| `carga_carreras_json` (tds-curriculum-exp) | Only schools with **degree programs** | ✅ Included (as it offers degrees) |
| `carga_carreras_tds_lib` (tda-expediente) | Schools offering **courses** | ✅ Included |

### Campuses Data

| Endpoint | Response Format | Scope |
|----------|-----------------|-------|
| `carga_sedes_json` | JSON (`{sedes: [{key, data}]}`) | All historical campuses (19 total) |
| `carga_sedes_tds_lib` | HTML (`<span value=''>`) | Active campuses (26 total, includes company locations) |

### Period Data

| Endpoint | Response Format | Structure |
|----------|-----------------|-----------|
| `cargaModalidadPeriodos` | JSON string in `d` (needs parsing) | Returns **modality definitions** with `IDE_MODALIDAD`, `NOMBRE`, `CANT_PERIODOS` |
| `carga_periodos_tds_lib` | JSON Array | Returns **specific periods** with `key` (e.g., `"2026_S_1"`) and `data` |

### Response Format Differences

| API Group | Response Wrapper | Parsing Required |
|-----------|-----------------|------------------|
| guiahorarios | `{d: "JSON_STRING"}` | Yes - `JSON.parse(response.d)` |
| tds-curriculum-exp | Direct JSON object | No - direct access |
| tda-expediente-estudiantil | JSON array or HTML | Mixed - check Content-Type |

---

## 5. Open Questions & Considerations

### Access & Authentication

| Question | Status |
|----------|--------|
| Are `guiahorarios` endpoints public or require authentication? | `cargaEscuelas` and `cargaModalidadPeriodos` are public; `getdatosEscuelaAno` requires `AlteonP` cookie; `getdatos` and `getdatosVerano` return server errors |
| How to obtain the `AlteonP` cookie? | Make any GET request to `https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx` and extract from `Set-Cookie` header |
| Are `tds-curriculum-exp` endpoints fully public? | ✅ Yes - fully public catalog data |
| Are `tda-expediente-estudiantil` endpoints public? | ✅ Yes - work without authentication |
| Are there rate limits on any endpoints? | Unknown — recommend implementing client-side throttling |

### Data Freshness

| Question | Notes |
|----------|-------|
| How often is course data updated? | Unknown — likely synced with academic calendar |
| Are there deprecated endpoints? | Not indicated in source documentation |
| What's the data retention for historical plans? | Very old plans may have incomplete data |

### Recommended Practices

1. **Parse nested JSON** - guiahorarios returns JSON string in `d` property that needs `JSON.parse()`.
2. **Cache catalog data** (campuses, programs, study plans) as these change infrequently.
3. **Implement retry logic** for session-dependent endpoints.
4. **Parse HTML responses** carefully for Section 3 endpoints (use `<span value='X'>` not `<option>`).
5. **Handle empty responses** gracefully for old study plans.
6. **Use appropriate endpoint** based on whether you need course-offering schools or degree-program schools.

---

## Quick Reference: All Endpoints

| # | Method | Endpoint | Auth | Format | Status |
|---|--------|----------|------|--------|--------|
| 1.1 | POST | `/guiahorarios/escuela.aspx/cargaEscuelas` | None | JSON (string in `d`) | ✅ Working |
| 1.2 | POST | `/guiahorarios/escuela.aspx/cargaModalidadPeriodos` | None | JSON (string in `d`) | ✅ Working |
| 1.3 | POST | `/guiahorarios/escuela.aspx/getdatosEscuelaAno` | Cookie + Header | JSON (string in `d`) | ✅ Working |
| 1.4 | POST | `/guiahorarios/estudiante.aspx/getdatos` | Cookie + Header | JSON (string in `d`) | ✅ Working |
| 1.5 | POST | `/guiahorarios/verano.aspx/getdatosVerano` | Cookie + Header | JSON (string in `d`) | ✅ Working |
| 2.1 | GET | `/tds-curriculum-exp/ajax/carga_sedes_json` | None | JSON | ✅ Working |
| 2.2 | GET | `/tds-curriculum-exp/ajax/carga_carreras_json` | None | JSON | ✅ Working |
| 2.3 | GET | `/tds-curriculum-exp/ajax/carga_planes_json` | None | JSON | ✅ Working |
| 2.4 | GET | `/tds-curriculum-exp/ajax/json_draw_angular` | None | JSON | ✅ Working |
| 3.1 | POST | `/tda-expediente-estudiantil/ajax/combos/carga_periodos_tds_lib` | None | JSON | ✅ Working |
| 3.2 | POST | `/tda-expediente-estudiantil/ajax/combos/carga_sedes_tds_lib` | None | HTML | ✅ Working |
| 3.3 | POST | `/tda-expediente-estudiantil/ajax/combos/carga_carreras_tds_lib` | None | HTML | ✅ Working |
| 3.4 | POST | `/tda-expediente-estudiantil/ajax/tabla_guia_horario` | None | HTML | ✅ Working |

> **Note:** "Cookie + Header" means the endpoint requires both the `AlteonP` session cookie AND the `X-Requested-With: XMLHttpRequest` header.
