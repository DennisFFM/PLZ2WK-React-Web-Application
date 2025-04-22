import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';

export default function KarteEbenen() {
  const [wahlGeo, setWahlGeo] = useState(null);
  const [plzGeo, setPlzGeo] = useState(null);
  const [showWahl, setShowWahl] = useState(true);
  const [showPlz, setShowPlz] = useState(true);

  // Aktuelle Hover-Infos beider Layer
  const [hoveredWahlkreis, setHoveredWahlkreis] = useState(null);
  const [hoveredPlz, setHoveredPlz] = useState(null);

  // GeoJSON laden
  useEffect(() => {
    fetch('/api/mapping?path=bundestagswahlen/2025/btw25_geometrie_wahlkreise_vg250_shp_geo.geojson')
      .then((res) => res.json())
      .then(setWahlGeo)
      .catch((err) => console.error('Wahlkreis-GeoJSON konnte nicht geladen werden:', err));
  }, []);

  useEffect(() => {
    fetch('/api/file?path=plz/PLZ_Gebiete_2313071530551189147.geojson')
      .then((res) => res.json())
      .then(setPlzGeo)
      .catch((err) => console.error('PLZ-GeoJSON konnte nicht geladen werden:', err));
  }, []);

  // Feature-Events
  const createFeatureHandlers = (layerType) => (feature, layer) => {
    const props = feature.properties;

    layer.on({
      mouseover: () => {
        if (layerType === 'wahl') setHoveredWahlkreis(props);
        if (layerType === 'plz') setHoveredPlz(props);
        layer.setStyle({ weight: 3, fillOpacity: 0.4 });
      },
      mouseout: () => {
        if (layerType === 'wahl') setHoveredWahlkreis(null);
        if (layerType === 'plz') setHoveredPlz(null);
        layer.setStyle({
          weight: layerType === 'wahl' ? 1 : 0.5,
          fillOpacity: layerType === 'wahl' ? 0.2 : 0.05
        });
      }
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Karte mit Ebenensteuerung</h1>

      <div className="mb-4 flex gap-6">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={showWahl}
            onChange={() => setShowWahl(!showWahl)}
            className="mr-2"
          />
          Wahlkreise anzeigen
        </label>
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={showPlz}
            onChange={() => setShowPlz(!showPlz)}
            className="mr-2"
          />
          Postleitzahlen anzeigen
        </label>
      </div>

      <div className="h-[600px] border rounded shadow relative">
        <MapContainer center={[51, 10]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          

          {showPlz && plzGeo && (
            <GeoJSON
              data={plzGeo}
              style={{ color: 'green', weight: 0.5, fillOpacity: 0.05 }}
              onEachFeature={createFeatureHandlers('plz')}
              interactive={false}
            />
          )}
          {showWahl && wahlGeo && (
            <GeoJSON
              data={wahlGeo}
              style={{ color: 'blue', weight: 1, fillOpacity: 0.2 }}
              onEachFeature={createFeatureHandlers('wahl')}
              interactive={false}
            />
          )}
        </MapContainer>

        {/* 🧠 Kombinierter Tooltip */}
        {(hoveredPlz || hoveredWahlkreis) && (
          <div className="absolute bottom-4 right-4 bg-white shadow-lg border rounded p-4 text-sm max-w-xs z-[9999]">
            <h3 className="text-md font-semibold mb-2">Info</h3>
            {hoveredWahlkreis && (
              <div className="mb-2">
                <div>🗳️ <strong>{hoveredWahlkreis.WKR_NAME}</strong></div>
                <div>#️⃣ Nummer: {hoveredWahlkreis.WKR_NR}</div>
              </div>
            )}
            {hoveredPlz && (
              <div>
                <div>📮 PLZ: <strong>{hoveredPlz.plz || hoveredPlz.PLZ || 'unbekannt'}</strong></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
