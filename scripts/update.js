import { execSync } from 'child_process';
import readline from 'readline';

// Erstelle das readline Interface für Benutzerbestätigung
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Zeige eine Warnung an und fordere Bestätigung
rl.question('Warnung: Alle lokalen Änderungen werden verloren gehen. Möchten Sie fortfahren? (J/N): ', (answer) => {
  if (answer.toLowerCase() === 'j') {
    try {
      // Verwerfe alle lokalen Änderungen an Dateien wie package-lock.json
      console.log('Verwerfe alle lokalen Änderungen...');
      execSync('git reset --hard', { stdio: 'inherit' });

      // Hole die neuesten Änderungen vom Remote-Repo
      console.log('Hole neueste Änderungen vom Repository...');
      execSync('git pull origin main', { stdio: 'inherit' });

      // Führe npm install aus, um die Abhängigkeiten zu installieren
      console.log('Installiere Abhängigkeiten...');
      execSync('npm install', { stdio: 'inherit' });

      // Lade die Geo-Daten herunter
      console.log('Lade Geo-Daten herunter...');
      execSync('npm run download_geodata', { stdio: 'inherit' });

      // Baue das Projekt neu
      console.log('Baue das Projekt...');
      execSync('npm run build', { stdio: 'inherit' });

      console.log('Update abgeschlossen.');
    } catch (error) {
      console.error('Fehler beim Ausführen des Update-Skripts:', error.message);
    } finally {
      rl.close();
    }
  } else {
    console.log('Abbruch des Updates.');
    rl.close();
  }
});
