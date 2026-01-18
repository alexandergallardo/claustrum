import json
import requests
from bs4 import BeautifulSoup
import urllib3
import sys
import re
from typing import Set, Tuple, Dict, Any

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

session = requests.Session()

DAY_ORDER = {
    "LUNES": 0,
    "MARTES": 1,
    "MIERCOLES": 2,
    "JUEVES": 3,
    "VIERNES": 4,
    "SABADO": 5,
    "DOMINGO": 6,
}


def get_alteon_cookie() -> str:
    try:
        resp = session.get(
            "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx",
            timeout=10,
            verify=False,
        )
        resp.raise_for_status()
        for cookie in session.cookies:
            if cookie.name == "AlteonP":
                value = cookie.value
                print(
                    f"Cookie AlteonP obtenida: {value[:20]}...",
                    file=sys.stderr,
                    flush=True,
                )
                return value
    except Exception as e:
        print(f"Error obteniendo cookie: {e}", file=sys.stderr, flush=True)
    return ""


alteon_cookie = get_alteon_cookie()


def load_sede_map() -> dict:
    print("Cargando mapa de sedes...", file=sys.stderr, flush=True)
    sede_map = {}
    try:
        resp1 = session.get(
            "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/combos/carga_sedes_tds_lib",
            timeout=10,
            verify=False,
        )
        resp1.raise_for_status()
        soup = BeautifulSoup(resp1.text, "html.parser")
        for span in soup.find_all("span", value=True):
            code = span.get("value")
            name = span.get_text(strip=True)
            if code and name:
                sede_map[name.upper()] = code
    except Exception as e:
        print(f"Error cargando sedes HTML: {e}", file=sys.stderr, flush=True)
    try:
        resp2 = session.get(
            "https://tecdigital.tec.ac.cr/tds-curriculum-exp/ajax/carga_sedes_json",
            timeout=10,
            verify=False,
        )
        resp2.raise_for_status()
        data = resp2.json()
        for item in data.get("sedes", []):
            code = item.get("key")
            name = item.get("data")
            if code and name:
                sede_map[name.upper()] = code
    except Exception as e:
        print(f"Error cargando sedes JSON: {e}", file=sys.stderr, flush=True)
    print(
        f"Mapa de sedes cargado: {len(sede_map)} entradas", file=sys.stderr, flush=True
    )
    return sede_map


SEDE_MAP = load_sede_map()


def load_modality_map() -> dict:
    print("Cargando mapa de modalidades...", file=sys.stderr, flush=True)
    modality_map = {}
    try:
        url = "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaModalidadPeriodos"
        resp = session.post(url, json={}, timeout=10, verify=False)
        resp.raise_for_status()
        data = resp.json()
        raw = json.loads(data.get("d", "[]"))
        for item in raw:
            ide = item.get("IDE_MODALIDAD", "")
            nombre = item.get("NOMBRE", "")
            if ide and nombre:
                modality_map[ide] = nombre.upper()
        print(
            f"Mapa de modalidades cargado: {len(modality_map)} entradas",
            file=sys.stderr,
            flush=True,
        )
    except Exception as e:
        print(f"Error cargando modalidades: {e}", file=sys.stderr, flush=True)
    return modality_map


MODALITY_MAP = load_modality_map()


def load_escuela_map() -> dict:
    print("Cargando mapa de escuelas...", file=sys.stderr, flush=True)
    escuela_map = {}
    try:
        url = "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaEscuelas"
        resp = session.post(url, json={}, timeout=10, verify=False)
        resp.raise_for_status()
        data = resp.json()
        raw = json.loads(data.get("d", "[]"))
        for item in raw:
            codigo = item.get("IDE_DEPTO", "")
            nombre = item.get("DSC_DEPTO", "")
            if codigo and nombre:
                escuela_map[nombre.upper()] = codigo
        print(
            f"Mapa de escuelas cargado: {len(escuela_map)} entradas",
            file=sys.stderr,
            flush=True,
        )
    except Exception as e:
        print(f"Error cargando escuelas: {e}", file=sys.stderr, flush=True)
    return escuela_map


ESCUELA_MAP = load_escuela_map()


def normalize_header(text: str) -> str:
    text = re.sub(r"</?[^>]+>", "", text)
    text = text.strip()
    text = text.replace(" ", "_")
    text = (
        text.replace("í", "I")
        .replace("á", "A")
        .replace("é", "E")
        .replace("ó", "O")
        .replace("ú", "U")
    )
    text = text.replace("ñ", "N")
    return text.upper()


def upper(text: Any) -> Any:
    if isinstance(text, str):
        return text.upper()
    return text


def build_period(row: dict) -> str:
    ano = row.get("NUM_ANO")
    modalidad = row.get("IDE_MODALIDAD")
    per_mod = row.get("IDE_PER_MOD")
    return f"{ano}_{modalidad}_{per_mod}"


def map_sede(name: str) -> str:
    return SEDE_MAP.get(name.upper(), name[:2].upper())


def map_escuela(name: str) -> str:
    return ESCUELA_MAP.get(name.upper(), name[:2].upper())


def get_modality_name(ide_modalidad: str) -> str:
    return MODALITY_MAP.get(ide_modalidad, ide_modalidad)


def normalize_grupo(grupo: Any) -> int:
    try:
        return int(grupo)
    except (ValueError, TypeError):
        try:
            return int(str(grupo).lstrip("0"))
        except (ValueError, TypeError):
            return 0


def session_day_order(session_tuple: tuple) -> int:
    day = session_tuple[0] if session_tuple[0] else ""
    return DAY_ORDER.get(day.upper() if day else "", 99)


def fetch_guia_horarios(escuela: str, ano: str) -> list[dict]:
    print(
        f"Consultando guia horarios: escuela={escuela}, ano={ano}",
        file=sys.stderr,
        flush=True,
    )
    url = "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno"
    payload = {"escuela": escuela, "ano": ano}
    headers = {"Content-Type": "application/json"}
    resp = session.post(url, json=payload, headers=headers, timeout=30, verify=False)
    resp.raise_for_status()
    data = resp.json()
    if data.get("d") == "NO DATOS" or not data.get("d"):
        print("No hay datos para esta escuela/año", file=sys.stderr, flush=True)
        return []
    raw = json.loads(data["d"])
    if isinstance(raw, list):
        print(f"Datos recibidos: {len(raw)} filas", file=sys.stderr, flush=True)
        return raw
    print("Datos recibidos: 1 fila", file=sys.stderr, flush=True)
    return [raw] if raw else []


def fetch_all_tecdigital_data(
    combinations: Set[Tuple[str, str, str]],
) -> dict[Tuple[str, str, str], list[dict]]:
    print(
        f"Consultando TEC Digital para {len(combinations)} combinaciones...",
        file=sys.stderr,
        flush=True,
    )
    results = {}
    base = "https://tecdigital.tec.ac.cr/tda-expediente-estudiantil/ajax/tabla_guia_horario"
    for sede, carrera, periodo in sorted(combinations):
        print(
            f"  Consultando: sede={sede}, carrera={carrera}, periodo={periodo}",
            file=sys.stderr,
            flush=True,
        )
        params = {"sede": sede, "carrera": carrera, "periodo": periodo}
        resp = session.get(base, params=params, timeout=30, verify=False)
        resp.raise_for_status()
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table")
        if not table:
            results[(sede, carrera, periodo)] = []
            continue
        thead = table.find("thead")
        if not thead:
            results[(sede, carrera, periodo)] = []
            continue
        header_ths = thead.find_all("th")
        if not header_ths:
            results[(sede, carrera, periodo)] = []
            continue
        header = [normalize_header(str(th)) for th in header_ths]
        print(f"    Headers: {header}", file=sys.stderr, flush=True)
        data = []
        tbody = table.find("tbody")
        if tbody:
            rows = tbody.find_all("tr")
        else:
            rows = table.find_all("tr")[1:]
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all(["th", "td"])]
            if len(cells) == len(header):
                row_dict = dict(zip(header, cells))
                data.append(row_dict)
        print(f"    Datos: {len(data)} filas", file=sys.stderr, flush=True)
        results[(sede, carrera, periodo)] = data
    print("TEC Digital completado", file=sys.stderr, flush=True)
    return results


def find_tecdigital_row(
    tecdigital_data: dict,
    sede_codigo: str,
    carrera: str,
    periodo: str,
    ide_materia: str,
    ide_grupo: int,
) -> dict | None:
    key = (sede_codigo, carrera, periodo)
    if key not in tecdigital_data:
        return None
    for tec_row in tecdigital_data[key]:
        tec_codigo = tec_row.get("CODIGO", "")
        tec_grupo = normalize_grupo(tec_row.get("GRUPO", 0))
        if tec_codigo == ide_materia and tec_grupo == ide_grupo:
            return tec_row
    return None


def build_nested_structure(
    guia_rows: list[dict], tecdigital_data: dict, carrera: str
) -> list[dict]:
    periods_dict: Dict[str, Dict] = {}
    guia_rows.sort(
        key=lambda x: (
            x.get("NUM_ANO", 0),
            x.get("IDE_MODALIDAD", ""),
            x.get("IDE_PER_MOD", 0),
            x.get("IDE_MATERIA", ""),
            x.get("IDE_GRUPO", 0),
        )
    )

    for row in guia_rows:
        periodo = build_period(row)
        ide_materia = row["IDE_MATERIA"]
        ide_grupo = normalize_grupo(row["IDE_GRUPO"])
        sede_nombre = row["DSC_SEDE"]
        sede_codigo = map_sede(sede_nombre)
        escuela_nombre = row["DSC_DEPTO"]
        escuela_codigo = map_escuela(escuela_nombre)

        if periodo not in periods_dict:
            periods_dict[periodo] = {
                "periodo": periodo,
                "cursos": {},
            }

        periodo_data = periods_dict[periodo]
        cursos = periodo_data["cursos"]

        tec_row = find_tecdigital_row(
            tecdigital_data, sede_codigo, carrera, periodo, ide_materia, ide_grupo
        )
        tipo_materia = None
        if tec_row:
            tipo_materia = (
                tec_row.get("TIPO_MATERIA")
                or tec_row.get("TIPO_MATERIA ")
                or tec_row.get("TIPOMATERIA")
                or tec_row.get("TIPO")
            )
            if tipo_materia:
                tipo_materia = upper(tipo_materia)

        if ide_materia not in cursos:
            cursos[ide_materia] = {
                "codigo": ide_materia,
                "nombre": upper(row["DSC_MATERIA"]),
                "creditos": row.get("CAN_CREDITOS"),
                "horas": row.get("HORAS"),
                "escuela": {
                    "codigo": escuela_codigo,
                    "nombre": upper(escuela_nombre),
                },
                "modalidad": upper(get_modality_name(row.get("IDE_MODALIDAD", ""))),
                "tipo_materia": upper(tipo_materia) if tipo_materia else None,
                "grupos": {},
            }

        curso = cursos[ide_materia]
        if curso["tipo_materia"] is None and tipo_materia:
            curso["tipo_materia"] = upper(tipo_materia)
        grupos = curso["grupos"]

        group_key = f"{ide_grupo}_{sede_codigo}"
        if group_key not in grupos:
            grupos[group_key] = {
                "numero": ide_grupo,
                "sede": {
                    "codigo": sede_codigo,
                    "nombre": upper(sede_nombre),
                },
                "profesores": [],
                "modalidad": upper(row.get("TIPO_CURSO", "")),
                "reservas": {
                    "sede": upper(row.get("RESERVA_SEDE", "")),
                    "escuela": upper(row.get("RESERVA_DEPTO", "")),
                    "plan": upper(row.get("RESERVA_PLAN", "")),
                },
                "capacidad": None,
                "aula": None,
                "horarios": set(),
            }

        grupo = grupos[group_key]

        profesor = row.get("NOM_PROFESOR", "")
        if profesor:
            profesor_upper = upper(profesor)
            if profesor_upper not in grupo["profesores"]:
                grupo["profesores"].append(profesor_upper)

        session_key = (row.get("NOM_DIA"), row.get("HINICIO"), row.get("HFIN"))
        if session_key[0] and session_key[1] and session_key[2]:
            grupo["horarios"].add(session_key)

        if tec_row:
            if grupo["capacidad"] is None:
                grupo["capacidad"] = tec_row.get("CUPO")
            if grupo["aula"] is None:
                aula_val = tec_row.get("AULA")
                if aula_val and aula_val.upper() != "NO DISPONIBLE":
                    grupo["aula"] = upper(aula_val)
            horario = tec_row.get("HORARIO", "")
            if horario and " - " in horario:
                parts = horario.split(" - ")
                if len(parts) >= 3:
                    tec_session = (
                        upper(parts[0]) if parts[0] else None,
                        parts[1] if len(parts) > 1 else None,
                        parts[2] if len(parts) > 2 else None,
                    )
                    if tec_session[0] and tec_session[1] and tec_session[2]:
                        grupo["horarios"].add(tec_session)

    output = []
    for periodo, periodo_data in sorted(periods_dict.items()):
        cursos_list = []
        for ide_materia, curso in sorted(periodo_data["cursos"].items()):
            grupos_list = []
            for grupo_key, grupo in sorted(
                curso["grupos"].items(), key=lambda x: x[1]["numero"]
            ):
                horarios_list = []
                for dia, hinicio, hfin in sorted(
                    grupo["horarios"], key=session_day_order
                ):
                    horarios_list.append(
                        {
                            "dia": upper(dia) if dia else None,
                            "inicio": hinicio,
                            "fin": hfin,
                            "aula": grupo["aula"],
                        }
                    )
                grupos_list.append(
                    {
                        "numero": grupo["numero"],
                        "sede": grupo["sede"],
                        "profesores": sorted(grupo["profesores"]),
                        "modalidad": grupo["modalidad"],
                        "reservas": grupo["reservas"],
                        "capacidad": grupo["capacidad"],
                        "horarios": horarios_list,
                    }
                )
            cursos_list.append(
                {
                    "codigo": curso["codigo"],
                    "nombre": curso["nombre"],
                    "creditos": curso["creditos"],
                    "horas": curso["horas"],
                    "escuela": curso["escuela"],
                    "modalidad": curso["modalidad"],
                    "tipo_materia": curso["tipo_materia"],
                    "grupos": grupos_list,
                }
            )
        output.append(
            {
                "periodo": periodo,
                "cursos": cursos_list,
            }
        )

    return output


def main():
    if len(sys.argv) < 3:
        print("Usage: python script.py <escuela> <ano>", file=sys.stderr)
        sys.exit(1)
    escuela, ano = sys.argv[1], sys.argv[2]

    guia_rows = fetch_guia_horarios(escuela, ano)
    if not guia_rows:
        print("No hay datos para esta escuela/año", file=sys.stderr)
        sys.exit(0)

    combinations: Set[Tuple[str, str, str]] = set()
    for row in guia_rows:
        periodo = build_period(row)
        sede = map_sede(row["DSC_SEDE"])
        combinations.add((sede, escuela, periodo))

    tecdigital_data = fetch_all_tecdigital_data(combinations)

    output = build_nested_structure(guia_rows, tecdigital_data, escuela)

    archivo_salida = f"{escuela}_{ano}.json"
    with open(archivo_salida, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Resultados guardados en: {archivo_salida}", file=sys.stderr)


if __name__ == "__main__":
    main()
