import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { useEffect, useState } from 'react';

export default function Karte() {
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    const loadGeoJson = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/mapping?path=bundestagswahlen/2025/btw2025_mapped.geojson');
        const json = await res.json();
        setGeoData(json);
      } catch (err) {
        console.error('Fehler beim Laden der GeoJSON-Daten:', err);
      }
    };

    loadGeoJson();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Kartenansicht</h1>
      <p className="text-gray-700 mb-4">Hier kannst du die PLZ-Wahlkreis-Zuordnung als interaktive Karte betrachten.</p>

      <div className="h-[600px] border rounded shadow">
        <MapContainer center={[51, 10]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoData && <GeoJSON data={geoData} />}
        </MapContainer>
      </div>
    </div>
  );
}
