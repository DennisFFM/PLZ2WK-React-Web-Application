import geopandas as gpd
import fiona
from pathlib import Path
import argparse

from utils import setup_logger

def convert_all_shapefiles(verbose=False):
    logger = setup_logger("convert_shapefiles", verbose)
    SCRIPT_DIR = Path(__file__).parent.resolve()
    DATA_ROOT = SCRIPT_DIR / "data"
    SHAPE_TYPES = ["bundestagswahlen", "landtagswahlen", "kommunalwahlen"]

    logger.info(f"🔍 Suche Shapefiles in: {DATA_ROOT}")
    count = 0
    skipped = 0
    fehler = []

    for typ in SHAPE_TYPES:
        for shp_file in (DATA_ROOT / typ).rglob("*.shp"):
            geojson_file = shp_file.with_suffix(".geojson")

            if geojson_file.exists():
                logger.info(f"⏭️  Überspringe (bereits konvertiert): {geojson_file.relative_to(SCRIPT_DIR)}")
                skipped += 1
                continue

            logger.info(f"🔄 Konvertiere: {shp_file.relative_to(SCRIPT_DIR)}")
            try:
                with fiona.Env(encoding='cp1252'):
                    with fiona.open(shp_file, encoding='cp1252') as src:
                        gdf = gpd.GeoDataFrame.from_features(src, crs=src.crs)

                gdf.to_file(geojson_file, driver="GeoJSON")
                logger.info(f"✅ Gespeichert: {geojson_file.relative_to(SCRIPT_DIR)}")
                count += 1

            except Exception as e:
                logger.error(f"❌ Fehler bei {shp_file.name}: {e}")
                fehler.append(shp_file)

    logger.info(f"\n✅ Konvertierung abgeschlossen. {count} Dateien erstellt, {skipped} übersprungen.")
    if fehler:
        logger.warning(f"⚠️  {len(fehler)} Dateien konnten nicht konvertiert werden:")
        for f in fehler:
            logger.warning(f"   {f.relative_to(SCRIPT_DIR)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Konvertiert alle Shapefiles in GeoJSON.")
    parser.add_argument("--verbose", action="store_true", help="Logge zusätzlich in die Konsole")
    parser.add_argument("--force", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--only", type=str, help=argparse.SUPPRESS)
    args, _ = parser.parse_known_args()

    convert_all_shapefiles(verbose=args.verbose)
