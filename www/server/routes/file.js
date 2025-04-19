import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const DATA_ROOT = path.resolve(__dirname, 'data'); // z. B. www/server/data

// Hilfsfunktion: slug → relativer Pfad zur Datei
function resolveSlugToPath(slug) {
  const relativePath = slug
    .replace(/__/g, '@@@')           // doppelter Unterstrich = echter Unterstrich
    .replace(/_/g, path.sep)         // _ → Pfadtrenner
    .replace(/@@@/g, '_')            // zurückwandeln
    + '.geojson';                    // immer .geojson anhängen
  return path.resolve(DATA_ROOT, relativePath);
}

router.get('/api/mapping/*', (req, res) => {
  const slug = req.params[0];

  const filePath = resolveSlugToPath(slug);

  console.log('📥 Slug:', slug);
  console.log('📁 Geladener Pfad:', filePath);
  console.log('📂 Existiert Datei?', fs.existsSync(filePath));

  // 🔒 Zugriff nur innerhalb des Datenverzeichnisses
  if (!filePath.startsWith(DATA_ROOT)) {
    return res.status(403).json({ error: 'Zugriff verweigert.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Mapping-Datei nicht gefunden.' });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    res.json(json);
  } catch (err) {
    console.error('❗ Fehler beim Lesen der Datei:', err);
    res.status(500).json({ error: 'Fehler beim Verarbeiten der Mapping-Datei.' });
  }
});

export default router;
