import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';
import shp from 'shpjs';

// Lade die Geodaten-URL und den Pfad aus der JSON-Datei
import geodataList from '../geodata_sources.json' with { type: 'json' };

const downloadFile = async (url, outputPath) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fehler beim Herunterladen der Datei: ${url}`);
  }
  const fileStream = createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
};

const extractZipFile = async (zipPath, outputDir) => {
  const directory = await unzipper.Open.file(zipPath);
  await directory.extract({ path: outputDir });
  const files = fs.readdirSync(outputDir);
  console.log(`Entpackte Dateien: ${files.join(', ')}`);
  return files;
};

const sanitizeFilename = (filename) => filename.replace(/\s+/g, '_');

const processGeoData = async () => {
  for (const { name, url, type, output } of geodataList) {
    console.log(`\n⬇️  Lade ${name}...`);

    const sanitizedName = sanitizeFilename(name);
    const outputPath = path.resolve(output);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const tempPath = path.join(outputDir, sanitizedName + path.extname(url));

    try {
      await downloadFile(url, tempPath);
      console.log(`✅ Heruntergeladen: ${tempPath}`);

      if (type === 'geojson') {
        fs.renameSync(tempPath, outputPath);
        console.log(`✅ Umbenannt zu: ${outputPath}`);
      } else if (type === 'shapefile') {
        console.log(`⬇️ Entpacke ZIP: ${tempPath}`);
        const files = await extractZipFile(tempPath, outputDir);

        const shpFile = files.find(file => file.endsWith('.shp'));
        if (!shpFile) {
          console.error(`❌ Keine .shp-Datei in ZIP für ${name}`);
          continue;
        }

        const shpFilePath = path.join(outputDir, shpFile);
        const geojson = await shp(shpFilePath);
        fs.writeFileSync(outputPath, JSON.stringify(geojson));
        console.log(`✅ GeoJSON gespeichert: ${outputPath}`);

        // Optional: Temp-ZIP löschen
        fs.unlinkSync(tempPath);
      } else {
        console.warn(`⚠️ Unbekannter Typ: ${type} (übersprungen)`);
      }

    } catch (err) {
      console.error(`❌ Fehler bei ${name}: ${err.message}`);
    }
  }
};

processGeoData();