import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import * as shp from 'shpjs';

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
        console.log(`📦 Verarbeite ZIP direkt mit shpjs.parseZip: ${tempPath}`);
        const zipBuffer = fs.readFileSync(tempPath);
        const geojson = await shp.parseZip(zipBuffer);
        fs.writeFileSync(outputPath, JSON.stringify(geojson));
        console.log(`✅ GeoJSON gespeichert: ${outputPath}`);
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
