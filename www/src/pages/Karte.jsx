import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';

export default function Karte() {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState('');
  const [geoData, setGeoData] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [visibleFields, setVisibleFields] = useState([]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/wahlen');
        const data = await res.json();
        setOptions(data);
      } catch (err) {
        console.error('Fehler beim Laden der Wahldaten:', err);
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    if (!selected) return;

    const loadGeo = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/mapping?path=${encodeURIComponent(selected)}`);
        const json = await res.json();
        setGeoData(json);

        // Dynamische Feld-Erkennung (außer Pflichtfelder)
        const allProps = json.features.flatMap(f => Object.keys(f.properties));
        const uniqueFields = [...new Set(allProps)].filter(
          key => key !== 'wahlkreis' && key !== 'wahlkreis_nr'
        );
        setAvailableFields(uniqueFields);
        setVisibleFields([]); // oder: `setVisibleFields(uniqueFields)` für alle aktiviert
      } catch (err) {
        console.error('Fehler beim Laden der GeoJSON-Datei:', err);
      }
    };

    loadGeo();
  }, [selected]);

  const handleCheckboxChange = (field) => {
    setVisibleFields((prev) =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const renderTooltip = (props) => {
    const lines = [
      `🗳️ Wahlkreis: ${props.wahlkreis}`,
      `#️⃣ Nummer: ${props.wahlkreis_nr}`,
      ...visibleFields.map(f => `${f}: ${props[f]}`)
    ];
    return lines.join('\n');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Interaktive Karte</h1>

      {/* Dropdown für Wahldateien */}
      <div className="mb-6">
        <label className="block mb-2 text-md font-medium text-gray-900">Wähle eine Wahl:</label>
        <select
          className="w-full p-2 border border-gray-300 rounded-md"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Bitte wählen...</option>
          {options.map((o, idx) => (
            <option key={idx} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Dynamische Checkboxen */}
      {availableFields.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-gray-800 font-medium">Zusätzliche Felder anzeigen:</p>
          <div className="flex flex-wrap gap-4">
            {availableFields.map((field) => (
              <label key={field} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={visibleFields.includes(field)}
                  onChange={() => handleCheckboxChange(field)}
                />
                {field}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Karte */}
      <div className="h-[600px] border rounded shadow">
        <MapContainer center={[51, 10]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && (
            <GeoJSON
              data={geoData}
              onEachFeature={(feature, layer) => {
                const props = feature.properties;
                layer.bindTooltip(renderTooltip(props), {
                  sticky: true,
                  direction: 'top',
                  offset: [0, -8],
                  className: 'leaflet-tooltip'
                });
              }}
              style={{
                color: '#444',
                weight: 1,
                fillOpacity: 0.3
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
