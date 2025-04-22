import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // Importiere node-fetch (Version 3)
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';
import cliProgress from 'cli-progress';
import { pipeline } from 'stream';
import { promisify } from 'util';

// Verwenden von 'import' ohne assert, um die JSON-Datei direkt zu importieren
import geodataList from '../geodata_sources.json' with { type: 'json' };  // Beachte, dass dies korrekt ist

const streamPipeline = promisify(pipeline); // Nutze promisify, um die Pipeline als async Funktion zu verwenden

// Erstelle eine Funktion zum Anzeigen des Fortschritts
const downloadFileWithProgress = async (url, outputPath) => {
  const response = await fetch(url); // Verwende fetch aus node-fetch v3

  const totalLength = response.headers.get('content-length') || 1024 * 1024; // Standard auf 1MB setzen

  const progressBar = new cliProgress.SingleBar({
    format: 'Download [{bar}] {percentage}% | {value}/{total} Bytes',
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(Number(totalLength), 0);

  const fileStream = createWriteStream(outputPath);
  const reader = response.body.getReader();
  let receivedLength = 0;

  // Lies die Daten und schreibe sie in die Datei, während der Fortschritt angezeigt wird
  const pump = () =>
    reader.read().then(({ done, value }) => {
      if (done) {
        progressBar.stop();
        return;
      }

      receivedLength += value.length;
      fileStream.write(value);
      progressBar.update(receivedLength);

      pump();
    });

  pump();
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
        await downloadFileWithProgress(url, outputPath);
        console.log(`✅ ${name} wurde heruntergeladen und gespeichert.`);
      } else if (type === 'shapefile') {
        const zipPath = path.resolve(outputDir, `${name}.zip`);
        await downloadFileWithProgress(url, zipPath);

        console.log(`⬇️ Entpacke Shapefile: ${name}`);
        const directory = await unzipper.Open.file(zipPath);
        await directory.extract({ path: outputDir });

        const shpFiles = fs.readdirSync(outputDir).filter((file) => file.endsWith('.shp'));

        if (shpFiles.length === 0) {
          console.error(`❌ Shapefile für ${name} nicht gefunden.`);
          continue;
        }

        const shpFile = path.join(outputDir, shpFiles[0]);
        const geojson = await shp(shpFile);
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
