import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_ROOT = path.resolve(__dirname, 'data');

// ✅ Liste verfügbarer Wahlen aus CSV-Datei
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
    console.log('🔍 JSON-Inhalt, erste Zeile:', json.features[1].properties.wahlkreis);
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
    const plzFile = path.join(DATA_ROOT, 'plz/PLZ_Gebiete_2313071530551189147.geojson');

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

// ✅ EINZIGER Startpunkt
app.listen(PORT, () => {
  console.log(`🚀 Server läuft unter http://localhost:${PORT}`);
});
