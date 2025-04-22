import geopandas as gpd
from shapely.geometry import mapping
from pathlib import Path
from tqdm import tqdm
import json
import numpy as np
import argparse
import re
import sys

from utils import setup_logger

# 🧠 Pfadkontext
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_ROOT = SCRIPT_DIR / "data"
OUTPUT_ROOT = PROJECT_ROOT / "www" / "server" / "data"
PLZ_PATH = DATA_ROOT / "plz" / "plz.geojson"

# 🔐 JSON-Typ-Sicherer Konverter
def json_safe(val):
    if isinstance(val, (np.integer, np.int32, np.int64)):
        return int(val)
    elif isinstance(val, (np.floating, np.float32, np.float64)):
        return float(val)
    elif isinstance(val, (np.bool_)):
        return bool(val)
    elif isinstance(val, np.str_):
        return str(val)
    elif isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    elif isinstance(val, (list, tuple, np.ndarray)):
        return [json_safe(v) for v in val]
    elif isinstance(val, dict):
        return {json_safe(k): json_safe(v) for k, v in val.items()}
    return val

# 🔍 Automatische Erkennung geeigneter Property-Keys
def detect_keys(wk_gdf, logger):
    all_cols = wk_gdf.columns.tolist()
    lower_cols = [col.lower() for col in all_cols]

    name_candidates = ["wkr_name", "wahlkreisname", "gen", "bez", "name", "kreis_name", "wahlkreis", "lwk_name"]
    nr_candidates = ["wkr_nr", "wahlkreisnummer", "nummer", "wk_nr", "nr", "lwk"]

    wk_name_key = next((col for col in all_cols if col.lower() in name_candidates), None)
    wk_nr_key = next((col for col in all_cols if col.lower() in nr_candidates), None)

    if not wk_name_key or not wk_nr_key:
        logger.warning("⚠️  Spalten konnten nicht eindeutig erkannt werden.")
        logger.info(f"🔍 Gefundene Spalten: {all_cols}")

        def similar(candidates):
            return [col for col in all_cols if any(cand in col.lower() for cand in candidates)]

        if not wk_name_key:
            logger.info(f"🤔 Mögliche 'wahlkreis'-Spalten: {similar(name_candidates) or 'keine erkennbar'}")
        if not wk_nr_key:
            logger.info(f"🤔 Mögliche 'wahlkreis_nr'-Spalten: {similar(nr_candidates) or 'keine erkennbar'}")

    return wk_name_key or "Unbekannt", wk_nr_key or "Unbekannt"

# 🗺 Mapping-Funktion
def map_wahlkreis_to_plz(wahl_path, output_path, wk_name_key, wk_nr_key, logger):
    try:
        plz_gdf = gpd.read_file(PLZ_PATH)
        wk_gdf = gpd.read_file(wahl_path)

        if plz_gdf.crs != wk_gdf.crs:
            wk_gdf = wk_gdf.to_crs(plz_gdf.crs)

        wk_sindex = wk_gdf.sindex
        features = []

        for plz_row in tqdm(plz_gdf.itertuples(), total=len(plz_gdf), desc=wahl_path.name[:25]):
            plz_geom = plz_row.geometry.buffer(0)
            plz_code = getattr(plz_row, "plz", None) or getattr(plz_row, "PLZ", None)
            candidate_idxs = list(wk_sindex.intersection(plz_geom.bounds))

            for idx in candidate_idxs:
                wk_row = wk_gdf.iloc[idx]
                wk_geom = wk_row.geometry.buffer(0)

                if plz_geom.intersects(wk_geom):
                    intersection = plz_geom.intersection(wk_geom)
                    if not intersection.is_empty:
                        features.append({
                            "type": "Feature",
                            "geometry": mapping(intersection),
                            "properties": {
                                "plz": json_safe(plz_code),
                                "wahlkreis": json_safe(wk_row.get(wk_name_key, "Unbekannt")),
                                "wahlkreis_nr": json_safe(wk_row.get(wk_nr_key, "Unbekannt"))
                            }
                        })
                    break
                logger.debug(f"➕ PLZ {plz_code} trifft Wahlkreis {wk_row.get(wk_name_key)}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8', errors='replace') as f:
            json.dump({
                "type": "FeatureCollection",
                "features": [json_safe(f) for f in features]
            }, f, ensure_ascii=False, indent=2)

        logger.info(f"✅ Gemappt: {output_path.relative_to(PROJECT_ROOT)} ({len(features)} Einträge)")

    except Exception as e:
        logger.error(f"❌ Fehler bei {wahl_path.name}: {e}")

# 📆 Hauptfunktion
def map_all(force=False, only=None, years=None, verbose=False):
    logger = setup_logger("map_plz_wahlkreis", verbose)
    SHAPE_TYPES = ["bundestagswahlen", "landtagswahlen", "kommunalwahlen"]

    logger.info(f"🔍 Lade PLZ-Datei aus: {PLZ_PATH}")
    logger.info(f"🛠 Mapping-Modus: {'Erzwinge Neuberechnung (--force)' if force else 'Nur fehlende Dateien'}")
    if only:
        logger.info(f"🌟 Eingeschränkte Wahltypen: {', '.join(only)}")
    if years:
        logger.info(f"🌟 Eingeschränkte Jahre: {', '.join(years)}")

    if not PLZ_PATH.exists():
        logger.error("❌ PLZ-Datei nicht gefunden.")
        return

    for typ in SHAPE_TYPES:
        short_typ = {"bundestagswahlen": "btw", "landtagswahlen": "ltw", "kommunalwahlen": "kw"}[typ]
        if only and short_typ not in only:
            continue

        for geojson_file in (DATA_ROOT / typ).rglob("*.geojson"):
            if "_mapped" in geojson_file.name:
                continue

            rel_path = geojson_file.relative_to(DATA_ROOT)
            parts = rel_path.parts

            try:
                if typ == "bundestagswahlen":
                    jahr = parts[1]
                    filename = f"btw{jahr}_mapped.geojson"
                    output_path = OUTPUT_ROOT / typ / jahr / filename

                elif typ == "landtagswahlen":
                    bundesland = parts[1].lower().replace(" ", "_")
                    jahr = parts[2]
                    filename = f"ltw{jahr}_mapped.geojson"
                    output_path = OUTPUT_ROOT / typ / bundesland / jahr / filename

                elif typ == "kommunalwahlen":
                    kommune = parts[1].lower().replace(" ", "_")
                    jahr = parts[2]
                    filename = f"kw{kommune}{jahr}_mapped.geojson"
                    output_path = OUTPUT_ROOT / typ / kommune / jahr / filename
                else:
                    continue

                if years and jahr not in years:
                    logger.info(f"⏭️ Überspringe Jahr {jahr}: {geojson_file.name}")
                    continue

                if output_path.exists() and not force:
                    logger.info(f"⏭️ Bereits vorhanden: {output_path.relative_to(PROJECT_ROOT)}")
                    continue

                wk_gdf_probe = gpd.read_file(geojson_file)
                wk_name_key, wk_nr_key = detect_keys(wk_gdf_probe, logger)

                logger.info(f"🔄 Verarbeite: {geojson_file.name}")
                logger.info(f"🔑  → name={wk_name_key or '❓'}, nr={wk_nr_key or '❓'}")

                if wk_name_key == "Unbekannt" or wk_nr_key == "Unbekannt":
                    logger.warning(f"⏭️ Überspringe Datei wegen fehlender Spalten: {geojson_file.name}")
                    continue

                map_wahlkreis_to_plz(geojson_file, output_path, wk_name_key, wk_nr_key, logger)

            except Exception as e:
                logger.error(f"❌ Fehler bei {geojson_file.name}: {e}")

    logger.info("✅ Mapping abgeschlossen.")

# 🔺 CLI
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mappt Wahlkreis- und PLZ-Geometrien.")
    parser.add_argument("--force", action="store_true", help="Überschreibt vorhandene Mapping-Dateien")
    parser.add_argument("--only", type=str, help="Nur bestimmte Wahltypen (z. B. btw,ltw,kw)")
    parser.add_argument("--year", type=str, help="Nur bestimmte Jahre (z. B. 2017,2021)")
    parser.add_argument("--verbose", action="store_true", help="Logge zusätzlich in die Konsole")

    args = parser.parse_args()
    selected_types = set(args.only.lower().split(",")) if args.only else None
    selected_years = set(args.year.split(",")) if args.year else None

    map_all(force=args.force, only=selected_types, years=selected_years, verbose=args.verbose)
