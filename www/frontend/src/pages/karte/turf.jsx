import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvent } from 'react-leaflet';
import * as turf from '@turf/turf';

export default function KarteMitTurf() {
  const [wahlGeo, setWahlGeo] = useState(null);
  const [plzGeo, setPlzGeo] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [showPlz, setShowPlz] = useState(true);
  const [showWahl, setShowWahl] = useState(true);

  const plzRef = useRef(null);
  const wahlRef = useRef(null);

  useEffect(() => {
    fetch('/api/mapping?path=bundestagswahlen/2025/btw25_geometrie_wahlkreise_vg250_shp_geo.geojson')
      .then((res) => res.json())
      .then((json) => {
        setWahlGeo(json);
        wahlRef.current = json;
      });

    fetch('/api/file?path=plz/PLZ_Gebiete_2313071530551189147.geojson')
      .then((res) => res.json())
      .then((json) => {
        setPlzGeo(json);
        plzRef.current = json;
      });
  }, []);

  // 📍 Globaler Maus-Tracker mit Turf.js
  const MouseTracker = () => {
    useMapEvent('mousemove', (e) => {
      const { lat, lng } = e.latlng;
      const point = turf.point([lng, lat]);

      const matches = {};

      if (wahlRef.current && showWahl) {
        const match = wahlRef.current.features.find((feature) =>
          turf.booleanPointInPolygon(point, feature)
        );
        if (match) {
          matches.wahl = match.properties;
        }
      }

      if (plzRef.current && showPlz) {
        const match = plzRef.current.features.find((feature) =>
          turf.booleanPointInPolygon(point, feature)
        );
        if (match) {
          matches.plz = match.properties;
        }
      }

      setHoverInfo(Object.keys(matches).length > 0 ? matches : null);
    });

    useMapEvent('mouseout', () => {
      setHoverInfo(null);
    });

    return null;
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Karte mit globalem Layer-Matching (Turf.js)</h1>

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

      <div className="h-[600px] relative border rounded shadow">
        <MapContainer center={[51, 10]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MouseTracker />

          {showWahl && wahlGeo && (
            <GeoJSON
              data={wahlGeo}
              style={{ color: 'blue', weight: 1, fillOpacity: 0.2 }}
            />
          )}

          {showPlz && plzGeo && (
            <GeoJSON
              data={plzGeo}
              style={{ color: 'green', weight: 0.5, fillOpacity: 0.05 }}
            />
          )}
        </MapContainer>

        {/* ℹ️ Info-Box */}
        {hoverInfo && (
          <div className="absolute bottom-4 right-4 bg-white shadow-lg border rounded p-4 text-sm max-w-xs z-[9999]">
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
      </div>
    </div>
  );
}
