import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';

// Lade die Geodaten-URL und den Pfad aus der JSON-Datei
import geodataList from '../geodata_sources.json' with { type: 'json' };

// Funktion, um die Datei herunterzuladen
const downloadFile = async (url, outputPath) => {
  const response = await fetch(url);
  const fileStream = createWriteStream(outputPath);

  if (!response.ok) {
    throw new Error(`Fehler beim Herunterladen der Datei: ${url}`);
  }

  // Schreibe den Inhalt der Antwort direkt in die Datei
  response.body.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
};

// Funktion zum Entpacken einer ZIP-Datei
const extractZipFile = async (zipPath, outputDir) => {
  try {
    const directory = await unzipper.Open.file(zipPath);
    await directory.extract({ path: outputDir });

    // Überprüfe die entpackten Dateien und gebe sie aus
    const files = fs.readdirSync(outputDir);
    console.log(`Entpackte Dateien: ${files.join(', ')}`);

    // Falls die Shapefile-Dateien vorhanden sind, gib den richtigen Pfad an
    const shpFile = files.find(file => file.endsWith('.shp'));
    if (shpFile) {
      console.log(`Verwende Shapefile: ${path.join(outputDir, shpFile)}`);
    } else {
      console.error(`❌ Shapefile nicht gefunden in ${outputDir}`);
    }

  } catch (err) {
    console.error(`Fehler beim Entpacken der Datei: ${zipPath}`, err);
  }
};

// Funktion, um Leerzeichen im Dateinamen durch Unterstriche zu ersetzen
const sanitizeFilename = (filename) => {
  return filename.replace(/\s+/g, '_');
};

// Funktion zum Verarbeiten der Geodaten
const processGeoData = async () => {
  for (const { name, url, type, output } of geodataList) {
    console.log(`⬇️  Lade ${name}...`);

    // Zielpfad für die heruntergeladene Datei
    const outputPath = path.resolve(output);
    const outputDir = path.dirname(outputPath);

    // Erstelle das Verzeichnis, falls es nicht existiert
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Ersetze Leerzeichen durch Unterstriche im Dateinamen
    const sanitizedName = sanitizeFilename(name);
    const sanitizedOutputPath = path.join(outputDir, sanitizedName);

    try {
      // Lade die Datei herunter
      await downloadFile(url, sanitizedOutputPath);
      console.log(`✅ Datei ${sanitizedName} wurde erfolgreich heruntergeladen.`);

      // Wenn es eine ZIP-Datei ist, entpacke sie
      if (type === 'shapefile') {
        console.log(`⬇️ Entpacke Shapefile: ${sanitizedName}`);
        await extractZipFile(sanitizedOutputPath, outputDir);
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${name}: ${err.message}`);
    }
  }
};

// Starte das Geodaten-Processing
processGeoData();