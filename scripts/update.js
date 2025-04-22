import { execSync } from 'child_process';

function run(command, description) {
  try {
    console.log(`\n▶ ${description}`);
    execSync(command, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ Fehler bei: ${description}`);
    process.exit(1);
  }
}

run('git pull', 'Hole neueste Änderungen von GitHub');
run('npm install', 'Installiere Abhängigkeiten');
run('npm run download_geodata', 'Lade Geo-Daten');
run('npm run build', 'Baue Frontend neu');
console.log('\n✅ Projekt erfolgreich aktualisiert!');
