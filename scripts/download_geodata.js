import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';
import cliProgress from 'cli-progress';
import geodataList from '../geodata_sources.json' with { type: 'json' };

// Funktion zum Anzeigen des Fortschritts
const downloadFileWithProgress = async (url, outputPath) => {
  const response = await axios.get(url, { responseType: 'stream' });

  const totalLength = response.headers['content-length'] || 1024 * 1024; // Standard auf 1MB setzen

  const progressBar = new cliProgress.SingleBar({
    format: 'Download [{bar}] {percentage}% | {value}/{total} Bytes',
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(Number(totalLength), 0);

  const fileStream = createWriteStream(outputPath);

  response.data.on('data', (chunk) => {
    progressBar.increment(chunk.length);
    fileStream.write(chunk);
  });

  response.data.on('end', () => {
    progressBar.stop();
    fileStream.end();
  });
};

// Lade die Geo-Daten herunter und konvertiere sie bei Bedarf
const downloadGeoData = async () => {
  for (const { name, url, type, output } of geodataList) {
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
