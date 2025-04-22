import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import shp from 'shpjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_PATH = path.resolve(__dirname, '../geodata_sources.json');

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(url, targetPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fehler beim Herunterladen von ${url}`);
  const buffer = await res.buffer();
  await ensureDirExists(targetPath);
  fs.writeFileSync(targetPath, buffer);
  return buffer;
}

async function processGeojson(entry) {
  console.log(`⬇️  Lade GeoJSON: ${entry.name}`);
  const buffer = await downloadFile(entry.url, entry.output);
  console.log(`✅ Gespeichert: ${entry.output}`);
}

async function processShapefile(entry) {
  console.log(`⬇️  Lade ZIP-Archiv (Shapefile): ${entry.name}`);
  const zipBuffer = await downloadFile(entry.url, entry.output.replace(/\.geojson$/, '.zip'));

  // Temporäres Entpacken im Speicher
  const zip = await unzipper.Open.buffer(zipBuffer);
  const files = {};
  for (const file of zip.files) {
    if (!file.path.match(/\.(shp|shx|dbf|prj)$/i)) continue;
    files[file.path] = await file.buffer();
  }

  // Konvertieren mit shpjs
  const geojson = await shp.combine([await shp.parseShp(files), await shp.parseDbf(files)]);
  await ensureDirExists(entry.output);
  fs.writeFileSync(entry.output, JSON.stringify(geojson));
  console.log(`✅ Konvertiert & gespeichert: ${entry.output}`);
}

async function run() {
  const entries = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  for (const entry of entries) {
    try {
      if (entry.type === 'geojson') {
        await processGeojson(entry);
      } else if (entry.type === 'shapefile') {
        await processShapefile(entry);
      } else {
        console.warn(`⚠️  Unbekannter Typ bei ${entry.name}: ${entry.type}`);
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${entry.name}:`, err.message);
    }
  }
}

run();
