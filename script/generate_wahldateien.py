import csv
import re
from pathlib import Path
import argparse

from utils import setup_logger

def generate_csv(force=False, verbose=False):
    logger = setup_logger("generate_wahldateien", verbose)

    SCRIPT_DIR = Path(__file__).parent.resolve()
    PROJECT_ROOT = SCRIPT_DIR.parent
    WAHL_ROOT = PROJECT_ROOT / "www" / "server" / "data"
    WAHL_CSV = WAHL_ROOT / "wahldateien.csv"
    WAHLTYPEN = ["bundestagswahlen", "landtagswahlen", "kommunalwahlen"]

    if WAHL_CSV.exists() and not force:
        logger.info(f"⏭️  CSV-Datei existiert bereits: {WAHL_CSV} – verwende --force zum Überschreiben.")
        return

    logger.info("🔍 Scanne Verzeichnisse nach gemappten GeoJSON-Dateien...")
    logger.info(f"📂 Basisverzeichnis: {WAHL_ROOT}")

    wahl_dateien = []
    labels_seen = set()
    paths_seen = set()
    warnungen = []

    for typ in WAHLTYPEN:
        typ_dir = WAHL_ROOT / typ
        logger.info(f"🔍 Suche in {typ_dir.resolve()} ...")

        if not typ_dir.exists():
            warnungen.append(f"⚠️  Verzeichnis nicht gefunden: {typ_dir}")
            continue

        for file in typ_dir.rglob("*_mapped.geojson"):
            rel_path = f"data/{file.relative_to(WAHL_ROOT)}".replace("\\", "/")
            logger.info(f"🔎 Datei gefunden: {rel_path}")

            if typ == "bundestagswahlen":
                match = re.search(rf"{typ}/(\d{{4}})/", rel_path)
                if match:
                    jahr = match.group(1)
                    label = f"Bundestagswahl {jahr}"
                else:
                    warnungen.append(f"⚠️  Ignoriere Pfad (kein Jahr gefunden): {rel_path}")
                    continue

            elif typ == "landtagswahlen":
                match = re.search(rf"{typ}/([^/]+)/(\d{{4}})/", rel_path)
                if match:
                    bundesland = match.group(1).replace("_", " ").title()
                    jahr = match.group(2)
                    label = f"Landtagswahl {bundesland} {jahr}"
                else:
                    warnungen.append(f"⚠️  Ignoriere Pfad (kein Jahr/Bundesland): {rel_path}")
                    continue

            elif typ == "kommunalwahlen":
                match = re.search(rf"{typ}/([^/]+)/(\d{{4}})/", rel_path)
                if match:
                    kommune = match.group(1).replace("_", " ").title()
                    jahr = match.group(2)
                    label = f"Kommunalwahl {kommune} {jahr}"
                else:
                    warnungen.append(f"⚠️  Ignoriere Pfad (kein Jahr/Kommune): {rel_path}")
                    continue

            if label in labels_seen:
                warnungen.append(f"⚠️  Doppeltes Label: {label}")
            if rel_path in paths_seen:
                warnungen.append(f"⚠️  Doppelter Pfad: {rel_path}")

            labels_seen.add(label)
            paths_seen.add(rel_path)
            wahl_dateien.append((rel_path, label))

    wahl_dateien.sort(key=lambda x: x[1], reverse=True)

    logger.info(f"💾 Schreibe {len(wahl_dateien)} Einträge in {WAHL_CSV} ...")
    with open(WAHL_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        for path, label in wahl_dateien:
            writer.writerow([path, label])

    logger.info("✅ Fertig.")

    if warnungen:
        logger.warning(f"\n⚠️  {len(warnungen)} Warnungen:")
        for w in warnungen:
            logger.warning(f"   {w}")
    else:
        logger.info("✅ Keine Warnungen.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Erzeugt die zentrale wahldateien.csv")
    parser.add_argument("--force", action="store_true", help="Überschreibt vorhandene Datei")
    parser.add_argument("--verbose", action="store_true", help="Logge zusätzlich in die Konsole")
    parser.add_argument("--only", type=str, help=argparse.SUPPRESS)
    args, _ = parser.parse_known_args()

    generate_csv(force=args.force, verbose=args.verbose)
