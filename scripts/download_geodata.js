import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import shp from 'shpjs'; // Importiere das gesamte shpjs-Modul
import unzipper from 'unzipper';
import cliProgress from 'cli-progress';

// Verwenden von 'import' ohne assert, um die JSON-Datei direkt zu importieren
import geodataList from '../geodata_sources.json' with { type: 'json' };  // Beachte, dass dies korrekt ist

// Erstelle eine Funktion zum Anzeigen des Fortschritts
const downloadFileWithProgress = async (url, outputPath) => {
  const response = await fetch(url);
  const totalLength = response.headers.get('content-length');

  if (!totalLength) {
    console.error('Fehler: Keine Dateigröße gefunden.');
    return;
  }

  const progressBar = new cliProgress.SingleBar({
    format: 'Download [{bar}] {percentage}% | {value}/{total} Bytes',
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(Number(totalLength), 0);

  const fileStream = createWriteStream(outputPath);
  const buffer = await response.buffer();  // Buffer anstelle von getReader
  fileStream.write(buffer);
  progressBar.update(buffer.length);
  progressBar.stop();
};

// Lade die Geo-Daten herunter und konvertiere sie bei Bedarf
const downloadGeoData = async () => {
  for (const { name, url, type, output } of geodataList) {  // Zugriff auf den Inhalt der JSON-Datei
    console.log(`⬇️  Lade ${name}...`);

    const outputPath = path.resolve(output);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      if (type === 'geojson') {
        // Wenn GeoJSON-Datei, direkt herunterladen
        await downloadFileWithProgress(url, outputPath);
        console.log(`✅ ${name} wurde heruntergeladen und gespeichert.`);
      } else if (type === 'shapefile') {
        // Wenn Shapefile, erst als ZIP herunterladen und dann entpacken und konvertieren
        const zipPath = path.resolve(outputDir, `${name}.zip`);
        await downloadFileWithProgress(url, zipPath);

        // Entpacken und Shapefile konvertieren
        console.log(`⬇️ Entpacke Shapefile: ${name}`);
        const directory = await unzipper.Open.file(zipPath);
        await directory.extract({ path: outputDir });

        // Angenommen, die Shapefiles befinden sich nach dem Entpacken im Verzeichnis
        const shpFiles = fs.readdirSync(outputDir).filter((file) => file.endsWith('.shp'));

        if (shpFiles.length === 0) {
          console.error(`❌ Shapefile für ${name} nicht gefunden.`);
          continue;
        }

        const shpFile = path.join(outputDir, shpFiles[0]);

        // Konvertiere Shapefile zu GeoJSON
        const geojson = shp.parseShp(shpFile);  // Verwende die `parseShp` Methode von shpjs
        const geoJsonPath = path.join(outputDir, `${name}.geojson`);
        fs.writeFileSync(geoJsonPath, JSON.stringify(geojson));

        console.log(`✅ ${name} wurde entpackt und als GeoJSON gespeichert.`);
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${name}: ${err.message}`);
    }
  }
};

// Starte den Download-Prozess
downloadGeoData();
