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


app.use(morgan('combined', { stream: logStream }));
app.use(cors());
app.use(express.json());

const DATA_ROOT = path.resolve(__dirname, 'data');

// 🔁 LRU-Caches
const plzCache = new LRUCache({ max: 100 });
const wahlCache = new LRUCache({ max: 100 });

// 📏 BBOX normalisieren
function normalizeBbox(bboxArray, digits = 0) {
  return bboxArray.map(num => Number(num.toFixed(digits)));
}

// Logging Endpoint

app.post('/api/frontend-log', (req, res) => {
  const { level, args, time } = req.body;
  const line = `[${time}] [${level.toUpperCase()}] ${args.join(' ')}\n`;
  fs.appendFile(path.join(LOG_DIR, 'frontend.log'), line, (err) => {
    if (err) console.error('Fehler beim Schreiben ins Frontend-Log:', err);
  });
  res.status(200).send('OK');
});

// ✅ /api/wahlen
app.get('/api/wahlen', (req, res) => {
  const filePath = path.join(DATA_ROOT, 'wahldateien.csv');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Datei konnte nicht gelesen werden' });

    const lines = data.trim().split('\n');
    const parsed = lines
      .map(line => line.trim())
      .filter(line => line.includes(','))
      .map(line => {
        const [rawPath, rawLabel] = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        return {
          value: rawPath.replace(/\\\\/g, '/'),
          label: rawLabel
        };
      });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(parsed);
  });
});

// ✅ Mapping-Endpunkt mit dynamischer Datei (GeoJSON)
app.get('/api/mapping', (req, res) => {
  const rawPath = req.query.path;

  if (!rawPath) {
    return res.status(400).json({ error: 'Pfad fehlt' });
  }

  const filePath = path.join(DATA_ROOT, rawPath.replace(/^data[\\/]/, ''));

  console.log('📥 Anfrage für:', rawPath);
  console.log('📁 Vollständiger Pfad:', filePath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Mapping-Datei nicht gefunden' });
  }

  try {
    const content = Buffer.from(fs.readFileSync(filePath)).toString('utf8');
    const json = JSON.parse(content);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(json);
  } catch (err) {
    console.error('❗ Fehler beim Parsen:', err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Datei' });
  }
});

// ✅ Live-Mapping-Endpoint
app.post('/api/map', async (req, res) => {
  const { wahlPath } = req.body;

  if (!wahlPath) return res.status(400).json({ error: 'wahlPath fehlt' });

  try {
    const wahlFile = path.join(DATA_ROOT, wahlPath.replace(/^data[\\/]/, ''));
    const plzFile = path.join(DATA_ROOT, 'plz/plz.geojson');

    const wahlGeo = JSON.parse(fs.readFileSync(wahlFile, 'utf8'));
    const plzGeo = JSON.parse(fs.readFileSync(plzFile, 'utf8'));

    const results = [];

    for (const plzFeature of plzGeo.features) {
      const plzGeom = plzFeature.geometry.type === 'Polygon'
        ? turf.polygon(plzFeature.geometry.coordinates)
        : turf.multiPolygon(plzFeature.geometry.coordinates);

      let match = null;

      for (const wahlFeature of wahlGeo.features) {
        const wkGeom = wahlFeature.geometry.type === 'Polygon'
          ? turf.polygon(wahlFeature.geometry.coordinates)
          : turf.multiPolygon(wahlFeature.geometry.coordinates);

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
    console.error('Serverfehler beim Mapping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ✅ Universeller Datei-Loader
app.get('/api/file', (req, res) => {
  const rawPath = req.query.path;
  if (!rawPath) {
    return res.status(400).json({ error: 'Pfad fehlt' });
  }

  const filePath = path.join(DATA_ROOT, rawPath.replace(/^data[\\/]/, ''));

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Fehler beim Laden der Datei:', err);
      return res.status(500).json({ error: 'Datei konnte nicht geladen werden' });
    }

    try {
      const json = JSON.parse(data);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(json);
    } catch (parseErr) {
      console.error('Fehler beim Parsen:', parseErr);
      res.status(500).json({ error: 'Ungültiges JSON' });
    }
  });
});

// ✅ /api/plz_bbox
app.get('/api/plz_bbox', (req, res) => {
  const bboxParam = req.query.bbox;
  if (!bboxParam) return res.status(400).json({ error: 'bbox fehlt' });

  const bbox = normalizeBbox(bboxParam.split(',').map(parseFloat));
  const bboxKey = bbox.join(',');

  if (plzCache.has(bboxKey)) {
    return res.json(plzCache.get(bboxKey));
  }

  const filePath = path.join(DATA_ROOT, 'plz/plz.geojson');
  try {
    const full = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const bboxPolygon = turf.bboxPolygon(bbox);

    const filtered = full.features.filter(f => turf.booleanIntersects(f, bboxPolygon));

    const simplified = filtered.map(f =>
      simplify(f, { tolerance: 0.001, highQuality: false })
    );

    const result = { type: 'FeatureCollection', features: simplified };

    plzCache.set(bboxKey, result);
    res.json(result);
  } catch (err) {
    console.error('Fehler beim BBOX-Filtern:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});


// ✅ /api/wahl_bbox
app.get('/api/wahl_bbox', (req, res) => {
  const { path: rawPath, bbox: bboxParam } = req.query;
  if (!rawPath || !bboxParam) return res.status(400).json({ error: 'Pfad und bbox erforderlich' });

  const bbox = normalizeBbox(bboxParam.split(',').map(parseFloat));
  const cacheKey = `${rawPath}|${bbox.join(',')}`;

  if (wahlCache.has(cacheKey)) {
    return res.json(wahlCache.get(cacheKey));
  }

  const filePath = path.join(DATA_ROOT, rawPath.replace(/^data[\\/]/, ''));
  try {
    const geo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const bboxPolygon = turf.bboxPolygon(bbox);

    const filtered = geo.features.filter(f => turf.booleanIntersects(f, bboxPolygon));

    const simplified = filtered.map(f =>
      simplify(f, { tolerance: 0.001, highQuality: false })
    );

    const result = { type: 'FeatureCollection', features: simplified };

    wahlCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Fehler beim Wahlkreis-BBOX:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Datei' });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server läuft unter http://localhost:${PORT}`);
});
