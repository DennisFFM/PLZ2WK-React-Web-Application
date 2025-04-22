import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import BboxLayers from '../../components/BboxLayers';

export default function KarteMitSidebar() {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [clickedFeatures, setClickedFeatures] = useState([]);
  const [showPlz, setShowPlz] = useState(false);
  const [showWahl, setShowWahl] = useState(false);
  const [wahlPath, setWahlPath] = useState('');
  const [wahlOptions, setWahlOptions] = useState([]);
  const activeWahlLabel = wahlOptions.find(opt => opt.value === wahlPath)?.label || '';

  const germanyBounds = [
    [47.2701, 5.8663],   // Südwest
    [55.0581, 15.0419],  // Nordost
  ];

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await fetch('/api/wahlen');
        const json = await res.json();
        setWahlOptions(json);
      } catch (err) {
        console.error('Fehler beim Laden der Wahlen:', err);
      }
    };
    loadOptions();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Karte mit BoundingBox-Optimierung</h1>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-6 gap-4">
        <div className="w-full sm:w-80">
          <label htmlFor="wahl-select" className="block mb-1 text-sm font-medium text-gray-700">Wahl auswählen</label>
          <select
            id="wahl-select"
            value={wahlPath}
            onChange={(e) => setWahlPath(e.target.value)}
            className="block w-full p-2 border rounded shadow-sm bg-white text-black"
          >
            <option value="">Bitte wählen...</option>
            {wahlOptions.map((opt, i) => (
              <option key={i} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-6">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={showWahl} onChange={() => setShowWahl(!showWahl)} className="mr-2" />
            Wahlkreise anzeigen
          </label>
          <label className="inline-flex items-center">
            <input type="checkbox" checked={showPlz} onChange={() => setShowPlz(!showPlz)} className="mr-2" />
            Postleitzahlen anzeigen
          </label>
        </div>
      </div>

      <div className="relative h-[600px] border rounded shadow overflow-hidden">
        <MapContainer
          bounds={germanyBounds}
          center={[51.1657, 10.4515]}
          zoom={12}
          minZoom={6}
          maxZoom={12}
          maxBounds={germanyBounds}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BboxLayers
            showPlz={showPlz}
            showWahl={showWahl && wahlPath !== ''}
            wahlPath={wahlPath}
            setHoverInfo={setHoverInfo}
            setClickedFeatures={setClickedFeatures}
          />
        </MapContainer>

        {hoverInfo && (
          <div
            className={`absolute bottom-4 bg-white shadow-lg border rounded p-4 text-sm max-w-xs z-[9999] transition-all duration-300 ${
              clickedFeatures.length > 0 ? 'right-80' : 'right-4'
            }`}
          >
            <h3 className="text-md font-semibold mb-2">Info</h3>
            {hoverInfo.wahl && (
              <div className="mb-2">
                <div>🗳️ <strong>{hoverInfo.wahl.WKR_NAME}</strong></div>
                <div>#️⃣ Nummer: {hoverInfo.wahl.WKR_NR}</div>
              </div>
            )}
            {hoverInfo.plz && (
              <div>
                <div>📮 PLZ: <strong>{hoverInfo.plz.plz || hoverInfo.plz.PLZ || 'unbekannt'}</strong></div>
              </div>
            )}
          </div>
        )}

        {clickedFeatures.length > 0 && (
          <div className="absolute top-0 right-0 w-80 max-w-full h-full bg-white shadow-xl border-l overflow-y-auto p-4 z-[9999]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Details {activeWahlLabel && <span className="text-sm text-gray-500 ml-2">({activeWahlLabel})</span>}
              </h2>
              <button
                onClick={() => setClickedFeatures([])}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            {clickedFeatures.map((item, idx) => (
              <div key={idx} className="mb-6">
                <h3 className="font-medium text-blue-700 mb-2">{item.layer}</h3>
                <table className="w-full text-sm table-auto border">
                  <tbody>
                    {Object.entries(item.properties).map(([key, value]) => (
                      <tr key={key} className="odd:bg-gray-50">
                        <td className="border px-2 py-1 font-medium text-gray-600">{key}</td>
                        <td className="border px-2 py-1">{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
