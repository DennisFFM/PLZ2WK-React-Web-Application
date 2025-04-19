import argparse
import subprocess
import sys
from pathlib import Path

from utils import setup_logger

def run_script(script_name, args, logger):
    base_path = Path(__file__).parent.resolve()
    script_path = base_path / script_name
    cmd = [sys.executable, str(script_path)] + args
    logger.info(f"▶️  Starte: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

def main():
    parser = argparse.ArgumentParser(
        description="Steuer-Skript für die Wahlverarbeitungs-Pipeline (Konvertierung, Mapping, CSV-Generierung)"
    )
    parser.add_argument("--convert", action="store_true", help="Shapefiles in GeoJSON umwandeln")
    parser.add_argument("--map", action="store_true", help="PLZ-Wahlkreis-Zuordnung durchführen")
    parser.add_argument("--generate", action="store_true", help="CSV-Dateien für Wahlen generieren")
    parser.add_argument("--all", action="store_true", help="Alle Schritte durchführen: convert + map + generate")
    parser.add_argument("--only", type=str, help="Nur eine bestimmte Wahl verarbeiten, z.B. 'btw2025' oder 'ltw2026_nrw'")
    parser.add_argument("--force", action="store_true", help="Erzwingt die Verarbeitung auch bei vorhandenen Dateien")
    parser.add_argument("--verbose", action="store_true", help="Ausgabe zusätzlich auf die Konsole schreiben")

    args = parser.parse_args()
    logger = setup_logger("main", verbose=args.verbose)

    if args.all:
        args.convert = True
        args.map = True
        args.generate = True

    base_args = []
    if args.only:
        base_args += ["--only", args.only]
    if args.force:
        base_args.append("--force")
    if args.verbose:
        base_args.append("--verbose")

    try:
        if args.convert:
            run_script("convert_shapefiles.py", base_args, logger)
        if args.map:
            run_script("map_plz_wahlkreis.py", base_args, logger)
        if args.generate:
            run_script("generate_wahldateien.py", base_args, logger)

        if not (args.convert or args.map or args.generate):
            logger.warning("⚠️  Keine Aktion angegeben. Nutze --convert, --map, --generate oder --all.")
            parser.print_help()

    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Fehler beim Ausführen eines Skripts: {e}")

if __name__ == "__main__":
    main()
