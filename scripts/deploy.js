import { execSync } from 'child_process';
import { argv } from 'process';

const skipBuild = argv.includes('--no-build');

try {
  console.log('\n🚀 Starte Deployment...');

  // Stelle sicher, dass lokale Änderungen verworfen werden
  console.log('🧹 Bereinige lokale Änderungen...');
  execSync('git reset --hard', { stdio: 'inherit' });

  // Hole den neuesten Stand vom main-Branch
  console.log('⬇️  Hole letzte Änderungen aus dem Repository...');
  execSync('git pull origin main', { stdio: 'inherit' });

  // Installiere Abhängigkeiten ohne postinstall (um Doppel-Download zu vermeiden)
  console.log('📦 Installiere Abhängigkeiten...');
  execSync('npm install --ignore-scripts', { stdio: 'inherit' });

  // Lade Geo-Daten explizit
  console.log('🌍 Lade Geo-Daten herunter...');
  execSync('npm run download_geodata', { stdio: 'inherit' });

  if (!skipBuild) {
    console.log('🛠️  Baue das Frontend...');
    execSync('npm run build', { stdio: 'inherit' });
  } else {
    console.log('⏭️  Build übersprungen (--no-build gesetzt)');
  }

  // Starte oder restarte den Server mit PM2
  console.log('🔁 Starte Server mit PM2 neu...');
  execSync('pm2 reload plz2wk-server || pm2 start www/server/index.js --name plz2wk-server', { stdio: 'inherit' });

  console.log('\n✅ Deployment erfolgreich abgeschlossen.');

} catch (err) {
  console.error('\n❌ Fehler während des Deployments:', err.message);
  process.exit(1);
}
