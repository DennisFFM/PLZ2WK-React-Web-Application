import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Warnung: Alle lokalen Änderungen werden verloren gehen. Möchten Sie fortfahren? (J/N): ', (answer) => {
  if (answer.toLowerCase() === 'j') {
    try {
      console.log('Verwerfe alle lokalen Änderungen...');
      execSync('git reset --hard', { stdio: 'inherit' });

      console.log('Hole neueste Änderungen vom Repository...');
      execSync('git pull origin main', { stdio: 'inherit' });

      console.log('Installiere Abhängigkeiten (ohne Geo-Daten doppelt zu laden)...');
      // Führe nur npm install ohne postinstall aus, um doppelten Download zu vermeiden
      execSync('npm install --ignore-scripts', { stdio: 'inherit' });

      // Jetzt explizit die Geo-Daten laden
      console.log('Lade Geo-Daten herunter...');
      execSync('npm run download_geodata', { stdio: 'inherit' });

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
