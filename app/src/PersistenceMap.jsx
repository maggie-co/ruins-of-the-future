import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

const THIS_YEAR = new Date().getFullYear();

export default function PersistenceMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchStatus('Searching…');
    try {
      const q = encodeURIComponent(searchQuery + ', St. Louis, MO');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (!data.length) { setSearchStatus('No results found.'); return; }
      const { lat, lon } = data[0];
      mapRef.current?.flyTo({
        center: [parseFloat(lon), parseFloat(lat)],
        zoom: 15, duration: 1400, essential: true,
      });
      setSearchStatus('');
    } catch {
      setSearchStatus('Search failed.');
    }
  }, [searchQuery]);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'OpenStreetMap, CARTO',
          },
          buildings: {
            type: 'vector',
            url: 'pmtiles:///tiles/persistence.pmtiles',
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'buildings-persistence',
            type: 'fill',
            source: 'buildings',
            'source-layer': 'buildings',
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['to-number', ['get', 'riskScore']],
                0,   '#3a5a82',   // visible slate blue — safe
                25,  '#4589a8',   // clear blue
                45,  '#52b3a0',   // teal — moderate
                60,  '#9fc857',   // green — elevated
                72,  '#f0cf3f',   // yellow — high
                85,  '#ea7e26',   // orange — very high
                100, '#d8331f',   // red — condemned / land bank
              ],
              'fill-opacity': 0.9,
            },
          },
        ],
      },
      center: [-90.22, 38.63],
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('mousemove', 'buildings-persistence', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      setHoveredBuilding(p);
    });

    map.on('mouseleave', 'buildings-persistence', () => {
      map.getCanvas().style.cursor = '';
      setHoveredBuilding(null);
    });

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  const glass = {
    background: 'rgba(8, 10, 18, 0.82)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(180, 200, 255, 0.1)',
    borderRadius: 3,
    color: '#dde8ff',
  };

  const riskLabel = (score) => {
    if (score >= 70) return { label: 'High risk', color: '#d4621a' };
    if (score >= 40) return { label: 'Moderate risk', color: '#4a9e6e' };
    return { label: 'Low risk', color: '#2d6a7a' };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, animation: 'fadeIn 0.8s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .p-search-input {
          background: transparent;
          border: none;
          outline: none;
          color: #dde8ff;
          font-size: 13px;
          font-family: inherit;
          width: 200px;
          letter-spacing: 0.02em;
        }
        .p-search-input::placeholder { color: rgba(180, 200, 255, 0.35); }
        .p-search-btn {
          background: none;
          border: none;
          color: rgba(180, 200, 255, 0.45);
          cursor: pointer;
          padding: 0 0 0 8px;
          font-size: 15px;
          transition: color 0.2s;
        }
        .p-search-btn:hover { color: #dde8ff; }
        .p-info-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(180, 200, 255, 0.4);
        }
        .p-info-value {
          font-size: 13px;
          color: rgba(220, 232, 255, 0.85);
          text-align: right;
          max-width: 160px;
        }
        .p-divider {
          border: none;
          border-top: 1px solid rgba(180, 200, 255, 0.08);
          margin: 8px 0;
        }
      `}</style>

      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Back */}
      <Link to="/" className="back-btn" style={{
        ...glass,
        position: 'absolute',
        top: 20, left: 20,
        padding: '9px 16px',
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(180,200,255,0.6)',
        textDecoration: 'none',
        display: 'block',
      }}>
        ← Back
      </Link>

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        ...glass,
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 300,
        zIndex: 10,
      }}>
        <input
          className="p-search-input"
          type="text"
          placeholder="Search address in St. Louis…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button className="p-search-btn" type="submit">↵</button>
      </form>

      {searchStatus && (
        <div style={{
          ...glass,
          position: 'absolute',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 16px',
          fontSize: 11,
          color: 'rgba(180,200,255,0.55)',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          {searchStatus}
        </div>
      )}

      {/* Hovered building info panel */}
      {hoveredBuilding && (() => {
        const { label, color } = riskLabel(hoveredBuilding.riskScore);
        return (
          <div style={{
            ...glass,
            position: 'absolute',
            top: 20, right: 20,
            width: 250,
            padding: '18px 20px',
            zIndex: 10,
            animation: 'panelIn 0.2s ease-out',
          }}>
            <div style={{
              fontSize: 15,
              color: '#dde8ff',
              lineHeight: 1.3,
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}>
              {hoveredBuilding.address || 'Unknown address'}
            </div>

            {hoveredBuilding.neighborhood && (
              <div style={{
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(180,200,255,0.4)',
                marginBottom: 14,
              }}>
                {hoveredBuilding.neighborhood}
              </div>
            )}

            <hr className="p-divider" />

            {/* Risk score bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <span className="p-info-label">Persistence risk</span>
                <span style={{ fontSize: 13, color, fontWeight: 500 }}>
                  {hoveredBuilding.riskScore} — {label}
                </span>
              </div>
              <div style={{
                height: 3,
                background: 'rgba(180,200,255,0.1)',
                borderRadius: 2,
              }}>
                <div style={{
                  height: '100%',
                  width: `${hoveredBuilding.riskScore}%`,
                  background: color,
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {hoveredBuilding.yearBuilt && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                <span className="p-info-label">Built</span>
                <span className="p-info-value">
                  {hoveredBuilding.yearBuilt} · {THIS_YEAR - hoveredBuilding.yearBuilt} yrs
                </span>
              </div>
            )}

            {hoveredBuilding.condemned && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                <span className="p-info-label">Status</span>
                <span style={{ fontSize: 13, color: '#b01a1a' }}>Condemned</span>
              </div>
            )}

            {hoveredBuilding.lraOwned && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                <span className="p-info-label">Ownership</span>
                <span style={{ fontSize: 13, color: '#d4621a' }}>City land bank</span>
              </div>
            )}

            {hoveredBuilding.historicDist && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                <span className="p-info-label">Protection</span>
                <span style={{ fontSize: 13, color: '#4a9e6e' }}>Historic district</span>
              </div>
            )}

            {hoveredBuilding.demoPerm && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
                <span className="p-info-label">Demo permit</span>
                <span style={{ fontSize: 13, color: '#d4621a' }}>Issued</span>
              </div>
            )}

            {hoveredBuilding.landRatio > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span className="p-info-label">Land ratio</span>
                <span className="p-info-value">{hoveredBuilding.landRatio.toFixed(2)}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{
        ...glass,
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '16px 24px',
        zIndex: 10,
        minWidth: 300,
      }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(180,200,255,0.4)',
          marginBottom: 10,
        }}>
          Persistence risk index
        </div>
        <div style={{
          height: 6,
          borderRadius: 3,
          background: 'linear-gradient(to right, #3a5a82, #52b3a0, #9fc857, #f0cf3f, #ea7e26, #d8331f)',
          marginBottom: 8,
        }} />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'rgba(180,200,255,0.35)',
          letterSpacing: '0.06em',
        }}>
          <span>Safe</span>
          <span>Moderate</span>
          <span>High risk</span>
        </div>
      </div>
    </div>
  );
}