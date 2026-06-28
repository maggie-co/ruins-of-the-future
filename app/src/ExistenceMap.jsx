import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

const YEAR_MIN = 1810;
const YEAR_MAX = 2026;
const THIS_YEAR = new Date().getFullYear();

export default function ExistenceMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [yearRange, setYearRange] = useState([YEAR_MIN, YEAR_MAX]);
  const yearRangeRef = useRef([YEAR_MIN, YEAR_MAX]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [hoveredBuilding, setHoveredBuilding] = useState(null);

  const applyYearFilter = useCallback((range) => {
    const map = mapRef.current;
    if (!map || !map.getLayer('buildings-existence')) return;
    map.setFilter('buildings-existence', [
      'all',
      ['>=', ['get', 'yearBuilt'], range[0]],
      ['<=', ['get', 'yearBuilt'], range[1]],
    ]);
  }, []);

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
            url: 'pmtiles:///tiles/buildings.pmtiles',
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          {
            id: 'buildings-existence',
            type: 'fill',
            source: 'buildings',
            'source-layer': 'buildings',
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['get', 'yearBuilt'],
                1810, '#fffbda',
                1880, '#ffec9e',
                1920, '#ffbb70',
                1960, '#ed9455',
                2000, '#a85a2a',
                2026, '#4a2818',
              ],
              'fill-opacity': 0.85,
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

    map.on('load', () => {
      applyYearFilter(yearRangeRef.current);
    });

    map.on('mousemove', 'buildings-existence', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      setHoveredBuilding({
        address: p.address || null,
        yearBuilt: p.yearBuilt || null,
        age: p.yearBuilt ? THIS_YEAR - p.yearBuilt : null,
        neighborhood: p.neighborhood || null,
        landUse: p.landUse || null,
        vacantBldgYear: p.vacantBldgYear || null,
        assessedImprov: p.assessedImprov || null,
      });
    });

    map.on('mouseleave', 'buildings-existence', () => {
      map.getCanvas().style.cursor = '';
      setHoveredBuilding(null);
    });

    return () => {
      map.remove();
      maplibregl.removeProtocol('pmtiles');
    };
  }, [applyYearFilter]);

  const handleYearChange = (which, val) => {
    const parsed = parseInt(val);
    const next = which === 'min'
      ? [Math.min(parsed, yearRange[1] - 10), yearRange[1]]
      : [yearRange[0], Math.max(parsed, yearRange[0] + 10)];
    setYearRange(next);
    yearRangeRef.current = next;
    applyYearFilter(next);
  };

  // Slider track gradient fill percentages
  const minPct = ((yearRange[0] - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const maxPct = ((yearRange[1] - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  const glass = {
    background: 'rgba(10, 8, 6, 0.78)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(244, 234, 213, 0.12)',
    borderRadius: 3,
    color: '#f4ead5',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, animation: 'fadeIn 0.8s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .search-input {
          background: transparent;
          border: none;
          outline: none;
          color: #f4ead5;
          font-size: 13px;
          font-family: inherit;
          width: 200px;
          letter-spacing: 0.02em;
        }
        .search-input::placeholder { color: rgba(244, 234, 213, 0.35); }
        .search-btn {
          background: none;
          border: none;
          color: rgba(244, 234, 213, 0.45);
          cursor: pointer;
          padding: 0 0 0 8px;
          font-size: 15px;
          transition: color 0.2s;
          line-height: 1;
        }
        .search-btn:hover { color: #f4ead5; }

        /* Slider base */
        .year-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          background: transparent;
          outline: none;
          cursor: pointer;
          position: absolute;
          left: 0;
          pointer-events: none;
        }
        .year-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #f4ead5;
          border: 2px solid rgba(237, 148, 85, 0.9);
          cursor: pointer;
          pointer-events: all;
          transition: transform 0.15s ease, background 0.15s ease;
          box-shadow: 0 0 6px rgba(237, 148, 85, 0.5);
        }
        .year-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25);
          background: #fff8ee;
        }
        .year-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #f4ead5;
          border: 2px solid rgba(237, 148, 85, 0.9);
          cursor: pointer;
          pointer-events: all;
        }

        .info-row { display: flex; justify-content: space-between; align-items: baseline; }
        .info-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(244, 234, 213, 0.4);
        }
        .info-value {
          font-size: 13px;
          color: rgba(244, 234, 213, 0.88);
          text-align: right;
          max-width: 160px;
        }
        .info-divider {
          border: none;
          border-top: 1px solid rgba(244, 234, 213, 0.08);
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
        color: 'rgba(244,234,213,0.6)',
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
          className="search-input"
          type="text"
          placeholder="Search address in St. Louis…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button className="search-btn" type="submit">↵</button>
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
          letterSpacing: '0.06em',
          color: 'rgba(244,234,213,0.55)',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          {searchStatus}
        </div>
      )}

      {/* Hovered building info panel */}
      {hoveredBuilding && (
        <div style={{
          ...glass,
          position: 'absolute',
          top: 20,
          right: 20,
          width: 240,
          padding: '18px 20px',
          zIndex: 10,
          animation: 'panelIn 0.2s ease-out',
        }}>
          {/* Address */}
          <div style={{
            fontSize: 15,
            fontWeight: 400,
            color: '#f4ead5',
            lineHeight: 1.3,
            marginBottom: 14,
            letterSpacing: '-0.01em',
          }}>
            {hoveredBuilding.address || 'Unknown address'}
          </div>

          {hoveredBuilding.neighborhood && (
            <div style={{ marginBottom: 14, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(244,234,213,0.4)' }}>
              {hoveredBuilding.neighborhood}
            </div>
          )}

          <hr className="info-divider" />

          {hoveredBuilding.yearBuilt && (
            <div className="info-row" style={{ marginBottom: 6 }}>
              <span className="info-label">Built</span>
              <span className="info-value">{hoveredBuilding.yearBuilt} · {hoveredBuilding.age} yrs</span>
            </div>
          )}

          {hoveredBuilding.landUse && (
            <div className="info-row" style={{ marginBottom: 6 }}>
              <span className="info-label">Use</span>
              <span className="info-value" style={{ fontSize: 12 }}>{hoveredBuilding.landUse}</span>
            </div>
          )}

          {hoveredBuilding.vacantBldgYear && (
            <div className="info-row" style={{ marginBottom: 6 }}>
              <span className="info-label">Vacant since</span>
              <span className="info-value" style={{ color: 'rgba(237,148,85,0.8)' }}>{hoveredBuilding.vacantBldgYear}</span>
            </div>
          )}

          {hoveredBuilding.assessedImprov > 0 && (
            <div className="info-row">
              <span className="info-label">Assessed</span>
              <span className="info-value">${Number(hoveredBuilding.assessedImprov).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Year range slider */}
      <div style={{
        ...glass,
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '18px 24px 20px',
        width: 340,
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(244,234,213,0.4)' }}>
            Year built
          </span>
          <span style={{ fontSize: 13, color: 'rgba(244,234,213,0.75)', letterSpacing: '0.04em' }}>
            {yearRange[0]} – {yearRange[1]}
          </span>
        </div>

        {/* Dual slider track */}
        <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          {/* Track background */}
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            height: 2,
            background: 'rgba(244, 234, 213, 0.12)',
            borderRadius: 1,
          }} />
          {/* Active track fill */}
          <div style={{
            position: 'absolute',
            left: `${minPct}%`,
            width: `${maxPct - minPct}%`,
            height: 2,
            background: 'linear-gradient(to right, #ffec9e, #ed9455)',
            borderRadius: 1,
          }} />
          <input
            type="range" className="year-slider"
            min={YEAR_MIN} max={YEAR_MAX}
            value={yearRange[0]}
            onChange={e => handleYearChange('min', e.target.value)}
          />
          <input
            type="range" className="year-slider"
            min={YEAR_MIN} max={YEAR_MAX}
            value={yearRange[1]}
            onChange={e => handleYearChange('max', e.target.value)}
          />
        </div>

        {/* Tick labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 10,
          color: 'rgba(244,234,213,0.28)',
          letterSpacing: '0.06em',
        }}>
          {[1810, 1860, 1910, 1960, 2026].map(y => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
    </div>
  );
}