import { useEffect, useState } from 'react';

export default function Mapping() {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState('');
  const [mapping, setMapping] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterPlz, setFilterPlz] = useState('');
  const [filterWk, setFilterWk] = useState('');
  const [filterNr, setFilterNr] = useState('');

  useEffect(() => {
    const loadOptionsFromApi = async () => {
      try {
        const res = await fetch('/api/wahlen');
        const json = await res.json();
        setOptions(json);
      } catch (err) {
        console.error('Fehler beim Laden der Daten von der API:', err);
      }
    };

    loadOptionsFromApi();
  }, []);

  useEffect(() => {
    const loadMappedGeojsonFromServer = async () => {
      if (!selected) return;
      setLoading(true);
      setMapping([]);

      const cleaned = selected.replaceAll('\\\\', '/');
      console.log('🌐 Lade Mapping für:', cleaned);
      console.time('📥 Mapping geladen');

      try {
        const res = await fetch(`/api/mapping?path=${encodeURIComponent(cleaned)}`);

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Serverantwort (${res.status}):`, errorText);
          return;
        }

        const geojson = await res.json();

        const results = geojson.features.map(f => ({
          plz: f.properties.plz,
          wahlkreis: f.properties.wahlkreis,
          wahlkreis_nr: f.properties.wahlkreis_nr
        }));

        console.log('📌 Beispiel-Wahlkreis:', results[1]);
        console.log(`✅ Mapping geladen – ${results.length} Einträge`);
        setMapping(results);
      } catch (err) {
        console.error('❗ Fehler beim Laden der gemappten Datei:', err);
      } finally {
        console.timeEnd('📥 Mapping geladen');
        setLoading(false);
      }
    };

    loadMappedGeojsonFromServer();
  }, [selected]);

  const filteredMapping = mapping.filter((row) =>
    row.plz.toString().includes(filterPlz.trim()) &&
    row.wahlkreis.toLowerCase().includes(filterWk.trim().toLowerCase()) &&
    row.wahlkreis_nr.toString().includes(filterNr.trim())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">PLZ-Wahlkreis-Mapping</h1>

      <label htmlFor="wahl-select" className="block mb-2 text-md font-medium text-gray-900">
        Wähle einen Datensatz:
      </label>
      <select
        id="wahl-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-blue-200 mb-6"
      >
        <option value="">Bitte wählen...</option>
        {options.map((option, idx) => (
          <option key={idx} value={option.value}>{option.label}</option>
        ))}
      </select>

      {loading && (
        <div className="text-blue-600 font-medium mb-4">Mapping wird geladen...</div>
      )}

      {!loading && mapping.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">PLZ-Zuordnungen:</h2>
          <table className="w-full table-auto border border-gray-300">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-600">
                <th className="border px-4 py-2 text-left">
                  <input
                    type="text"
                    placeholder="PLZ filtern..."
                    value={filterPlz}
                    onChange={(e) => setFilterPlz(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </th>
                <th className="border px-4 py-2 text-left">
                  <input
                    type="text"
                    placeholder="Wahlkreis filtern..."
                    value={filterWk}
                    onChange={(e) => setFilterWk(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </th>
                <th className="border px-4 py-2 text-left">
                  <input
                    type="text"
                    placeholder="Nr. filtern..."
                    value={filterNr}
                    onChange={(e) => setFilterNr(e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">PLZ</th>
                <th className="border px-4 py-2 text-left">Wahlkreis</th>
                <th className="border px-4 py-2 text-left">Wahlkreis-Nr.</th>
              </tr>
            </thead>
            <tbody>
              {filteredMapping.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-4 py-2">{row.plz}</td>
                  <td className="border px-4 py-2">{row.wahlkreis}</td>
                  <td className="border px-4 py-2">{row.wahlkreis_nr}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMapping.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">Keine Einträge gefunden.</p>
          )}
        </div>
      )}
    </div>
  );
}
