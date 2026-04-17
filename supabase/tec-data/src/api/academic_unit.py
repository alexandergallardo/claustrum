"""API client for academic unit/career data."""

import json
import re
from pathlib import Path
from typing import Any

import requests

from src.api.base import APIClient


class AcademicUnitClient(APIClient):
    """Client for academic unit/career endpoints."""

    def __init__(self, verify_ssl: bool = True) -> None:
        super().__init__()
        self._alteonp_cookie: str = ""
        self._altesp_cookie: str = ""
        self._verify_ssl = verify_ssl

    def _get_cookies(self) -> tuple[str, str]:
        """Get AlteonP and AltesP cookies from page."""
        if self._alteonp_cookie and self._altesp_cookie:
            return self._alteonp_cookie, self._altesp_cookie

        try:
            self.session.get(
                "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx",
                verify=False,  # SSL issues only on this endpoint
            )
            # Extract cookies
            for cookie in self.session.cookies:
                if cookie.name == "AlteonP":
                    self._alteonp_cookie = cookie.value
                elif cookie.name == "AltesP":
                    self._altesp_cookie = cookie.value
        except requests.RequestException:
            pass

        return self._alteonp_cookie, self._altesp_cookie

    def get_carreras_json(self, campus_code: str) -> Any:
        """GET carga_carreras_json - returns JSON data (tecdigital, no SSL issues)."""
        endpoint = "tds-curriculum-exp/ajax/carga_carreras_json"
        params = {"id_sede": campus_code}
        response = self.session.get(
            f"{self.base_url}/{endpoint}", params=params, verify=True
        )
        response.raise_for_status()
        return response.json()

    def get_carreras_html(self, campus_code: str) -> dict[str, str]:
        """POST carga_carreras_tds_lib - returns HTML with career data."""
        endpoint = "tda-expediente-estudiantil/ajax/combos/carga_carreras_tds_lib"
        data = {"id_sede": campus_code, "accion": "cargar"}
        response = self.session.post(
            f"{self.base_url}/{endpoint}", data=data, verify=True
        )
        response.raise_for_status()

        # Parse HTML response: <span value='CODE'>Name</span>
        pattern = r"<span value='([^']+)'>([^<]+)</span>"
        matches = re.findall(pattern, response.text)
        return {code: name.upper().strip() for code, name in matches}

    def get_escuelas_with_cookie(self) -> dict[str, Any] | None:
        """POST cargaEscuelas - requires AlteonP/AltesP cookies."""
        # First ensure we have cookies
        alteonp, altesp = self._get_cookies()

        endpoint = (
            "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/cargaEscuelas"
        )
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.8",
            "Connection": "keep-alive",
            "Content-Length": "0",
            "Content-Type": "application/json; charset=utf-8",
            "Cookie": f"AlteonP={alteonp}; AltesP={altesp}",
            "Origin": "https://tec-appsext.itcr.ac.cr",
            "Referer": "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Sec-GPC": "1",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
        }

        try:
            # Post with empty body (Content-Length: 0)
            response = self.session.post(
                endpoint,
                headers=headers,
                verify=False,  # SSL issues only on this endpoint
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching escuelas: {e}")
            return None

    def get_oferta_cursos(self, school_code: str, year: str) -> Any:
        """POST getdatosEscuelaAno - returns course offer data for a school and year."""
        alteonp, altesp = self._get_cookies()

        endpoint = "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx/getdatosEscuelaAno"
        payload = {"escuela": school_code, "ano": year}
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.8",
            "Connection": "keep-alive",
            "Content-Type": "application/json; charset=utf-8",
            "Cookie": f"AlteonP={alteonp}; AltesP={altesp}",
            "Origin": "https://tec-appsext.itcr.ac.cr",
            "Referer": "https://tec-appsext.itcr.ac.cr/guiahorarios/escuela.aspx",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Sec-GPC": "1",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
        }

        try:
            response = self.session.post(
                endpoint,
                headers=headers,
                json=payload,
                verify=False,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"Error fetching oferta cursos for {school_code} year {year}: {e}")
            return None

    def download_oferta_cursos(
        self, output_dir: Path, school_codes: list[str], year: str
    ) -> dict[str, Path]:
        """Download course offer data for all schools for a given year."""
        output_dir = output_dir / "course_offer" / year
        output_dir.mkdir(parents=True, exist_ok=True)

        files: dict[str, Path] = {}

        for code in school_codes:
            try:
                oferta = self.get_oferta_cursos(code, year)
                if oferta and self._has_course_offer_data(oferta):
                    data = self._parse_oferta_cursos(oferta)
                    if data:
                        file_path = output_dir / f"{code}.json"
                        file_path.write_text(
                            json.dumps(data, indent=2, ensure_ascii=False)
                        )
                        files[code] = file_path
            except requests.RequestException as e:
                print(f"Error downloading course offer for {code}: {e}")

        return files

    def _parse_oferta_cursos(self, response: Any) -> Any:
        """Parse the course offer response, extracting and parsing the 'd' field."""
        if not response or not isinstance(response, dict):
            return None
        data_str = response.get("d")
        if not data_str or not isinstance(data_str, str):
            return None
        try:
            return json.loads(data_str)
        except json.JSONDecodeError:
            return None

        return files

    def _has_course_offer_data(self, response: Any) -> bool:
        """Check if the response contains actual course offer data."""
        if not response or not isinstance(response, dict):
            return False
        data = response.get("d")
        if data is None or data == "" or data == "NO DATOS":
            return False
        return True

    def get_horario_guia(self, sede: str, carrera: str, periodo: str) -> str:
        """POST tabla_guia_horario - returns HTML schedule data for a specific combination."""
        endpoint = "tda-expediente-estudiantil/ajax/tabla_guia_horario"
        data = {"sede": sede, "carrera": carrera, "periodo": periodo}
        try:
            response = self.session.post(
                f"{self.base_url}/{endpoint}", data=data, verify=True
            )
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching horario guia for {sede}/{carrera}/{periodo}: {e}")
            return ""

    def download_horarios_from_course_offer(
        self, output_dir: Path, year: str
    ) -> dict[str, Path]:
        """Download schedule data using already downloaded course offer files."""
        course_offer_dir = output_dir / "course_offer" / year
        if not course_offer_dir.exists():
            print(f"Course offer data not found at {course_offer_dir}")
            return {}

        output_dir = output_dir / "schedule_guia" / year
        output_dir.mkdir(parents=True, exist_ok=True)

        campus_path = output_dir.parent.parent / "campus" / "data.json"
        if not campus_path.exists():
            print(f"Campus data not found at {campus_path}")
            return {}

        campuses = json.loads(campus_path.read_text())
        dsc_sede_to_code = {c["name"]: c["code"] for c in campuses}

        files: dict[str, Path] = {}

        combinaciones: dict[tuple[str, str, str], str] = {}

        for course_file in course_offer_dir.glob("*.json"):
            school_code = course_file.stem
            data = json.loads(course_file.read_text())
            if not data:
                continue

            for row in data:
                dsc_sede = row.get("DSC_SEDE", "")
                sede_code = dsc_sede_to_code.get(dsc_sede)
                if not sede_code:
                    continue

                num_ano = str(row.get("NUM_ANO", ""))
                ide_modalidad = row.get("IDE_MODALIDAD", "")
                ide_per_mod = str(row.get("IDE_PER_MOD", ""))
                periodo = f"{num_ano}_{ide_modalidad}_{ide_per_mod}"

                key = (sede_code, school_code, periodo)
                if key not in combinaciones:
                    combinaciones[key] = dsc_sede

        total_combinaciones = len(combinaciones)
        print(
            f"Found {total_combinaciones} unique (sede, carrera, periodo) combinations to download"
        )

        downloaded = 0
        failed = 0
        skipped = 0
        total_courses = 0

        for idx, ((sede, carrera, periodo), dsc_sede) in enumerate(
            combinaciones.items(), 1
        ):
            try:
                print(
                    f"[{idx}/{total_combinaciones}] Downloading {sede}/{carrera}/{periodo}...",
                    end=" ",
                )
                html = self.get_horario_guia(sede, carrera, periodo)
                if html:
                    parsed_data = self._parse_horario_html(html)
                    if parsed_data:
                        file_name = f"{sede}_{carrera}_{periodo}.json"
                        file_path = output_dir / file_name
                        file_path.write_text(
                            json.dumps(parsed_data, indent=2, ensure_ascii=False)
                        )
                        files[file_name] = file_path
                        downloaded += 1
                        total_courses += len(parsed_data)
                        print(f"OK ({len(parsed_data)} courses)")
                    else:
                        skipped += 1
                        print("SKIPPED (no course data)")
                else:
                    skipped += 1
                    print("SKIPPED (empty response)")
            except requests.RequestException as e:
                failed += 1
                print(f"FAILED ({e})")

        print(
            f"\nDownload complete: {downloaded} files, {total_courses} courses, {skipped} skipped, {failed} failed"
        )

        return files

    def _parse_horario_html(self, html: str) -> list[dict[str, Any]]:
        """Parse HTML table into structured JSON format."""
        import re

        from bs4 import BeautifulSoup

        if not html:
            return []

        try:
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table", {"id": "tguiaHorario"})
            if not table:
                return []

            all_rows = table.find_all("tr")
            if len(all_rows) < 2:
                return []

            data_rows = []
            for row in all_rows:
                cells = row.find_all("td")
                if len(cells) >= 11:
                    data_rows.append(row)

            if not data_rows:
                return []

            result: list[dict[str, Any]] = []

            for row in data_rows:
                cells = row.find_all(["td"])
                if len(cells) < 11:
                    continue

                codigo = cells[0].get_text(strip=True)
                materia = cells[1].get_text(strip=True)
                grupo = cells[2].get_text(strip=True)
                creditos = cells[3].get_text(strip=True)
                raw_horario = cells[4].get_text(strip=True)
                aula = cells[5].get_text(strip=True)
                profesor = cells[6].get_text(strip=True)
                capacidad = cells[7].get_text(strip=True)
                tipo_materia = cells[8].get_text(strip=True).upper()
                tipo_grupo = cells[9].get_text(strip=True).upper()

                entries = self._parse_horario_entry(
                    codigo=codigo,
                    materia=materia,
                    grupo=grupo,
                    creditos=creditos,
                    raw_horario=raw_horario,
                    aula=aula,
                    profesor=profesor,
                    capacidad=capacidad,
                    tipo_materia=tipo_materia,
                    tipo_grupo=tipo_grupo,
                )

                result.extend(entries)

            return result
        except Exception as e:
            return []

    def _parse_horario_entry(
        self,
        codigo: str,
        materia: str,
        grupo: str,
        creditos: str,
        raw_horario: str,
        aula: str,
        profesor: str,
        capacidad: str,
        tipo_materia: str,
        tipo_grupo: str,
    ) -> list[dict[str, Any]]:
        """Parse a single horario entry, splitting multi-day entries."""
        pattern = r"([A-Za-zÁÉÍÓÚáéíóúñ]+)\s*-\s*(\d{1,2}:\d{1,2}:\d{1,2}:\d{1,2})"
        matches = re.findall(pattern, raw_horario)

        if not matches:
            return []

        entries = []
        for dia, time_range in matches:
            parts = time_range.split(":")
            if len(parts) != 4:
                continue
            h_inicio = f"{int(parts[0]):02d}:{int(parts[1]):02d}"
            h_fin = f"{int(parts[2]):02d}:{int(parts[3]):02d}"
            entries.append(
                {
                    "IDE_MATERIA": codigo,
                    "DSC_MATERIA": materia,
                    "IDE_GRUPO": grupo,
                    "CAN_CREDITOS": int(creditos) if creditos.isdigit() else 0,
                    "CAPACIDAD": int(capacidad) if capacidad.isdigit() else 0,
                    "NOM_DIA": dia.upper(),
                    "HINICIO": h_inicio,
                    "HFIN": h_fin,
                    "AULA": aula,
                    "NOM_PROFESOR": profesor,
                    "TIPO_MATERIA": tipo_materia,
                    "TIPO_GRUPO": tipo_grupo,
                }
            )

        return entries
