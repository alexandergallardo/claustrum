#!/bin/bash
set -e # Detiene el script inmediatamente si algún comando falla

# Verifica que se haya pasado el año como argumento
if [ -z "$1" ]; then
    echo "Error: Debes indicar el año (ej: ./sync-all.sh 2026)"
    exit 1
fi

YEAR=$1
DEFAULT_YEARS="2024,2025,2026"
echo "========================================================"
echo "Iniciando descarga y procesamiento de datos para $YEAR..."
echo "========================================================"

# 1. Datos Base (Sedes, Escuelas, Períodos)
echo ">> [1/4] Descargando y procesando datos base..."
uv run tec-data download
uv run tec-data process --entity campus
uv run tec-data process --entity academic_unit
uv run tec-data process --entity academic_period

# Asegura que el academic_term del año solicitado exista,
# incluso si no está en el rango por defecto del process general.
if [ "$YEAR" != "2024" ] && [ "$YEAR" != "2025" ] && [ "$YEAR" != "2026" ]; then
    echo ">> Ajustando periodos académicos para incluir $YEAR..."
    uv run tec-data process --entity academic_period --years "$DEFAULT_YEARS,$YEAR"
fi

# 2. Planes de estudio
echo ">> [2/4] Descargando y procesando planes de estudio..."
uv run tec-data download --entity study_plan
uv run tec-data process --entity study_plan

# 3. Oferta de cursos y horarios
echo ">> [3/4] Descargando de oferta y horarios ($YEAR)..."
uv run tec-data download --entity course_offer --year "$YEAR"
uv run tec-data download --entity schedule_guia --year "$YEAR"

echo ">> Procesando relación final de ofertas y profesores ($YEAR)..."
uv run tec-data process --entity course_offering --years "$YEAR"

# 4. Generación final de SQL
echo ">> [4/4] Generando seed.sql en la raíz de supabase..."
uv run tec-data sql

echo "========================================================"
echo "¡Proceso completado exitosamente!"
echo "========================================================"
