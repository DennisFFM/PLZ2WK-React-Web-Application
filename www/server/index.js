import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';
import { LRUCache } from 'lru-cache';
import simplify from '@turf/simplify';
import morgan from 'morgan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3001;
const LOG_DIR = path.resolve(__dirname, '../log');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const logStream = fs.createWriteStream(path.join(LOG_DIR, 'server.log'), { flags: 'a' });

// Lade geodata_sources.json einmalig beim Start
const GEODATA_SOURCES = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'geodata_sources.json'), 'utf8')
);

function getGeojsonPathByName(name) {
  const entry = GEODATA_SOURCES.find(e => e.name === name);
  if (!entry || !entry.output) return null;
  return path.resolve(process.cwd(), entry.output);
}

function resolveGeoJsonRequestPath(rawPath) {
  const cleanedPath = rawPath.replace(/^data[\/]/, '');
  return path.resolve(process.cwd(), 'www/server/data', cleanedPath);
}

app.use(morgan('combined', { stream: logStream }));
app.use(cors());
app.use(express.json());

const DATA_ROOT = path.resolve(__dirname, 'data');
const plzCache = new LRUCache({ max: 100 });
const wahlCache = new LRUCache({ max: 100 });

function normalizeBbox(bboxArray, digits = 0) {
  return bboxArray.map(num => Number(num.toFixed(digits)));
}

app.post('/api/frontend-log', (req, res) => {
  const { level, args, time } = req.body;
  const line = `[${time}] [${level.toUpperCase()}] ${args.join(' ')}\n`;
  fs.appendFile(path.join(LOG_DIR, 'frontend.log'), line, (err) => {
    if (err) console.error('Fehler beim Schreiben ins Frontend-Log:', err);
  });
  res.status(200).send('OK');
});

app.get('/api/wahlen', (req, res) => {
  const sourcesPath = path.resolve(process.cwd(), 'geodata_sources.json');
  try {
    const geodataSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

    const options = geodataSources
      .filter(entry => {
        if (entry.name === 'PLZ-Gebiete') return false;
        const absPath = path.resolve(process.cwd(), entry.output);
        const exists = fs.existsSync(absPath);
        console.log(`📂 Prüfe ${entry.name}: ${absPath} → ${exists ? '✅' : '❌'}`);
        return (
          entry.output.endsWith('.geojson') &&
          entry.name &&
          exists
        );
      })
      .map(entry => ({
        value: entry.output.replace(/^www[\\\/]server[\\\/]data[\\\/]/, 'data/'),
        label: entry.name
      }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(options);
  } catch (err) {
    console.error('Fehler beim Einlesen von geodata_sources.json:', err);
    res.status(500).json({ error: 'Konnte Wahldaten nicht laden' });
  }
});

app.get('/api/mapping', (req, res) => {
  const rawPath = req.query.path;
  if (!rawPath) return res.status(400).json({ error: 'Pfad fehlt' });

  try {
    const filePath = resolveGeoJsonRequestPath(rawPath);
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(json);
  } catch (err) {
    console.error('Fehler bei /api/mapping:', err.message);
    res.status(404).json({ error: 'Mapping-Datei nicht gefunden' });
  }
});

app.post('/api/map', async (req, res) => {
  const { wahlPath } = req.body;
  if (!wahlPath) return res.status(400).json({ error: 'wahlPath fehlt' });

  try {
    const wahlFile = resolveGeoJsonRequestPath(wahlPath);
    const plzFile = getGeojsonPathByName('PLZ-Gebiete');

    if (!fs.existsSync(plzFile)) {
      return res.status(404).json({ error: 'PLZ-Datei nicht gefunden' });
    }

    const wahlGeo = JSON.parse(fs.readFileSync(wahlFile, 'utf8'));
    const plzGeo = JSON.parse(fs.readFileSync(plzFile, 'utf8'));

    const results = [];

    for (const plzFeature of plzGeo.features) {
      const plzGeom = turf.getGeom(plzFeature);
      let match = null;

      for (const wahlFeature of wahlGeo.features) {
        const wkGeom = turf.getGeom(wahlFeature);
        if (turf.booleanIntersects(plzGeom, wkGeom)) {
          match = wahlFeature;
          break;
        }
      }

      if (match) {
        results.push({
          plz: plzFeature.properties.plz || plzFeature.properties.PLZ || 'Unbekannt',
          wahlkreis: match.properties.name || match.properties.WKR_NAME || 'Unbekannt'
        });
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(results);
  } catch (err) {
    console.error('Serverfehler bei /api/map:', err.message);
    res.status(500).json({ error: 'Mapping fehlgeschlagen' });
  }
});

app.get('/api/file', (req, res) => {
  const rawPath = req.query.path;
  if (!rawPath) return res.status(400).json({ error: 'Pfad fehlt' });

  try {
    const filePath = resolveGeoJsonRequestPath(rawPath);
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(json);
  } catch (err) {
    console.error('Fehler bei /api/file:', err.message);
    res.status(404).json({ error: 'Datei konnte nicht geladen werden' });
  }
});

import geojsonRbush from 'geojson-rbush';

app.get('/api/plz_bbox', (req, res) => {
  const bboxParam = req.query.bbox;
  const wahlPath = req.query.wahlPath;

  if (!bboxParam) return res.status(400).json({ error: 'bbox fehlt' });

  const bbox = normalizeBbox(bboxParam.split(',').map(parseFloat));
  const cacheKey = `plz|${bbox.join(',')}${wahlPath ? `|${wahlPath}` : ''}`;

  if (plzCache.has(cacheKey)) {
    return res.json(plzCache.get(cacheKey));
  }

  const plzFile = getGeojsonPathByName('PLZ-Gebiete');
  if (!plzFile || !fs.existsSync(plzFile)) {
    return res.status(404).json({ error: 'PLZ-Datei nicht gefunden' });
  }

  try {
    const start = Date.now();

    const plzGeo = JSON.parse(fs.readFileSync(plzFile, 'utf8'));
    const bboxPolygon = turf.bboxPolygon(bbox);

    // Nur PLZ innerhalb der BBOX
    let plzFeatures = plzGeo.features.filter(f => turf.booleanIntersects(f, bboxPolygon));
    console.log(`📦 ${plzFeatures.length} PLZ nach BBOX`);

    if (wahlPath) {
      const wahlFile = resolveGeoJsonRequestPath(wahlPath);
      if (!fs.existsSync(wahlFile)) {
        return res.status(404).json({ error: 'Wahlkreis-Datei nicht gefunden' });
      }

      const wahlGeo = JSON.parse(fs.readFileSync(wahlFile, 'utf8'));
      const index = geojsonRbush();
      index.load(wahlGeo);
      console.log(`📊 Index enthält ${wahlGeo.features.length} Wahlkreise`);

      const t0 = Date.now();
      plzFeatures = plzFeatures.filter(plz => {
        const candidates = index.search(plz);
        return candidates.some(wahl => turf.booleanIntersects(plz, wahl));
      });
      const t1 = Date.now();
      console.log(`🧠 Spatial filter für ${plzFeatures.length} PLZ: ${t1 - t0}ms`);
    }


    const simplified = plzFeatures.map(f =>
      simplify(f, { tolerance: 0.001, highQuality: false })
    );

    const result = { type: 'FeatureCollection', features: simplified };

    plzCache.set(cacheKey, result);

    const end = Date.now();
    console.log(`⏱️ /api/plz_bbox (indexed) in ${end - start}ms [${plzFeatures.length} PLZ]`);
    res.json(result);
  } catch (err) {
    console.error('❌ Fehler bei /api/plz_bbox:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});




app.get('/api/wahl_bbox', (req, res) => {
  const { path: rawPath, bbox: bboxParam } = req.query;
  console.log('📥 [API] wahl_bbox rawPath:', rawPath);
  const cleaned = rawPath.replace(/^data[\\/]/, '');
  console.log('🧪 [API] nach clean:', cleaned);
  const filePath = path.resolve(process.cwd(), 'www/server/data', cleaned);
  console.log('📁 [API] resolved:', filePath);

  if (!rawPath || !bboxParam) return res.status(400).json({ error: 'Pfad und bbox erforderlich' });

  const bbox = normalizeBbox(bboxParam.split(',').map(parseFloat));
  const cacheKey = `${rawPath}|${bbox.join(',')}`;

  if (wahlCache.has(cacheKey)) {
    return res.json(wahlCache.get(cacheKey));
  }

  try {
    const geo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const bboxPolygon = turf.bboxPolygon(bbox);
    const filtered = geo.features.filter(f => turf.booleanIntersects(f, bboxPolygon));
    const simplified = filtered.map(f => simplify(f, { tolerance: 0.001, highQuality: false }));
    const result = { type: 'FeatureCollection', features: simplified };
    wahlCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Fehler bei /api/wahl_bbox:', err.message);
    res.status(500).json({ error: 'Datei konnte nicht geladen werden' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft unter http://localhost:${PORT}`);
});
