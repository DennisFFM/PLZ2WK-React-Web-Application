import fs from 'fs';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';
import cliProgress from 'cli-progress';

// Erstelle eine Funktion zum Anzeigen des Fortschritts
const downloadFileWithProgress = async (url, outputPath) => {
  const response = await fetch(url);

  // Wenn keine Dateigröße vorhanden ist, setze eine Schätzung auf 1MB, um den Fortschritt zu berechnen
  const totalLength = response.headers.get('content-length') || 1024 * 1024; // Standard auf 1MB setzen
  const progressBar = new cliProgress.SingleBar({
    format: 'Download [{bar}] {percentage}% | {value}/{total} Bytes',
    hideCursor: true,
  }, cliProgress.Presets.shades_classic);

  progressBar.start(Number(totalLength), 0);

  const fileStream = createWriteStream(outputPath);
  const reader = response.body.getReader();
  let receivedLength = 0;

  // Wenn die Dateigröße bekannt ist, wird der Fortschritt anhand der realen Größe berechnet
  if (totalLength !== 1024 * 1024) {
    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          progressBar.stop();
          return;
        }

        receivedLength += value.length;
        fileStream.write(value);
        progressBar.update(receivedLength);

        pump();
      });
    pump();
  } else {
    // Wenn die Dateigröße unbekannt ist, simulieren wir den Fortschritt, basierend auf den empfangenen Bytes
    let lastReceivedLength = 0;
    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          progressBar.stop();
          return;
        }

        receivedLength += value.length;
        fileStream.write(value);

        // Schätze den Fortschritt basierend auf der Menge der empfangenen Daten
        const progress = (receivedLength / 1024 / 1024).toFixed(2); // Schätze den Fortschritt in MB
        progressBar.update(receivedLength);

        pump();
      });
    pump();
  }
};

export default downloadFileWithProgress;
