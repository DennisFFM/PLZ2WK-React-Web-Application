import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import unzipper from 'unzipper';
import shp from 'shpjs'; // Um das Shapefile zu konvertieren

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

    return files;
  } catch (err) {
    console.error(`Fehler beim Entpacken der Datei: ${zipPath}`, err);
  }
};

// Funktion, um die Dateiendung basierend auf dem Dateityp zu setzen
const getFileExtensionFromURL = (url) => {
  const extname = path.extname(url);
  return extname || '.zip';  // Falls keine Endung vorhanden ist, standardmäßig .zip
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
    const sanitizedName = sanitizeFilename(name);  // Bereinige den Dateinamen
    const extname = getFileExtensionFromURL(url); // Bestimme die Dateiendung
    const outputPath = path.resolve(output); // Setze den vollen Dateipfad
    const outputDir = path.dirname(outputPath);  // Extrahiere nur das Verzeichnis

    // Erstelle das Verzeichnis, falls es nicht existiert
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Lade die Datei herunter
      await downloadFile(url, outputPath);
      console.log(`✅ Datei ${sanitizedName}${extname} wurde erfolgreich heruntergeladen.`);

      // Wenn es eine ZIP-Datei ist, entpacke sie
      if (type === 'shapefile') {
        console.log(`⬇️ Entpacke Shapefile: ${sanitizedName}${extname}`);
        const files = await extractZipFile(outputPath, outputDir);

        // Überprüfe die entpackten Dateien und speichere das GeoJSON an die gewünschte Stelle
        const shpFile = files.find(file => file.endsWith('.shp'));
        if (shpFile) {
          const shpFilePath = path.join(outputDir, shpFile);
          console.log(`Verwende Shapefile: ${shpFilePath}`);

          // Konvertiere die Shapefile-Datei zu GeoJSON
          const geojson = shp.parseShp(shpFilePath);

          // Bestimme den Zielpfad für die GeoJSON-Datei
          const geoJsonName = `${sanitizedName}.geojson`; // Benenne GeoJSON-Datei
          const geoJsonPath = path.join(outputDir, geoJsonName); // Speicherort für GeoJSON

          // Speichere das GeoJSON
          fs.writeFileSync(geoJsonPath, JSON.stringify(geojson));
          console.log(`✅ ${geoJsonName} wurde erfolgreich als GeoJSON gespeichert.`);
        } else {
          console.error(`❌ Shapefile für ${sanitizedName} nicht gefunden.`);
        }
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${name}: ${err.message}`);
    }
  }
};

// Starte das Geodaten-Processing
processGeoData();
