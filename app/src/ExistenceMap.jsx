import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

const YEAR_MIN = 1810;
const YEAR_MAX = 2026;
const THIS_YEAR = new Date().getFullYear();

const INFO_DESCRIPTIONS = {
  built: 'Year of construction from the city assessor parcel records (par.dbf, field YRBUILT). Age is measured from the current year.',
  use: 'Land use classification from the assessor parcel file, describing the building\'s primary function: residential, commercial, industrial, institutional, or mixed.',
  vacant: 'Year the structure first appears in the city Vacant Building registry. Absent when there is no recorded vacancy. Source: City of St. Louis vacant building data.',
  assessed: 'Assessed value of improvements only, the structure itself excluding land, in dollars. Source: par.dbf, field ASMTIMPROV.',
};

export default function ExistenceMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const selectedHandleRef = useRef('');

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [infoTooltip, setInfoTooltip] = useState(null);

  const [yearRange, setYearRange] = useState([YEAR_MIN, YEAR_MAX]);
  const yearRangeRef = useRef([YEAR_MIN, YEAR_MAX]);

  const displayBuilding = selectedBuilding || hoveredBuilding;

  const applyYearFilter = useCallback((range) => {
    const map = mapRef.current;
    if (!map || !map.getLayer('buildings-existence')) return;
    const yearFilter = [
      'all',
      ['>=', ['get', 'yearBuilt'], range[0]],
      ['<=', ['get', 'yearBuilt'], range[1]],
    ];
    map.setFilter('buildings-existence', yearFilter);
    if (map.getLayer('buildings-selected')) {
      map.setFilter('buildings-selected',
        selectedHandleRef.current
          ? ['all', yearFilter, ['==', ['get', 'handle'], selectedHandleRef.current]]
          : ['==', ['get', 'handle'], '']
      );
    }
  }, []);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchStatus('Searching...');
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
              'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                10, 1.0,
                13, 0.92,
                15, 0.85,
              ],
            },
          },
          {
            id: 'buildings-selected',
            type: 'line',
            source: 'buildings',
            'source-layer': 'buildings',
            filter: ['==', ['get', 'handle'], ''],
            paint: {
              'line-color': '#fff8ee',
              'line-width': 2,
              'line-opacity': 0.9,
            },
          },
        ],
      },
      center: [-90.22, 38.63],
      zoom: 12,
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
      setHoveredBuilding(e.features[0].properties);
    });

    map.on('mouseleave', 'buildings-existence', () => {
      map.getCanvas().style.cursor = '';
      setHoveredBuilding(null);
    });

    map.on('click', 'buildings-existence', (e) => {
      const p = e.features[0].properties;
      if (selectedHandleRef.current === p.handle) {
        selectedHandleRef.current = '';
        setSelectedBuilding(null);
        applyYearFilter(yearRangeRef.current);
      } else {
        selectedHandleRef.current = p.handle;
        setSelectedBuilding(p);
        applyYearFilter(yearRangeRef.current);
        map.flyTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 16), duration: 1000, essential: true });
      }
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['buildings-existence'] });
      if (!features.length) {
        selectedHandleRef.current = '';
        setSelectedBuilding(null);
        if (map.getLayer('buildings-selected')) {
          map.setFilter('buildings-selected', ['==', ['get', 'handle'], '']);
        }
      }
    });

    return () => {
      map.remove();
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

  const minPct = ((yearRange[0] - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  const maxPct = ((yearRange[1] - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  const glass = {
    background: 'rgba(10, 8, 6, 0.78)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(244, 234, 213, 0.12)',
    borderRadius: 3,
    color: '#f4ead5',
  };

  const InfoLabel = ({ text, tipKey, style }) => (
    <div
      style={{ position: 'relative', display: 'inline-block', cursor: 'help', ...style }}
      onMouseEnter={() => setInfoTooltip(tipKey)}
      onMouseLeave={() => setInfoTooltip(null)}
    >
      <span style={{
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'rgba(244,234,213,0.45)',
        borderBottom: '1px dotted rgba(244,234,213,0.25)',
      }}>
        {text}
      </span> 
      {infoTooltip === tipKey && (
        <div style={{
          // in InfoLabel, tooltip div style:
          position: 'absolute', top: 'calc(100% + 6px)',
          right: -40, left: 'auto',
          width: 220, background: 'rgba(10,8,6,0.97)',
          border: '1px solid rgba(244,234,213,0.15)',
          borderRadius: 3, padding: '10px 12px',
          fontSize: 11, color: 'rgba(244,234,213,0.78)',
          lineHeight: 1.6, zIndex: 200, pointerEvents: 'none', zoom: 1.25,
        }}>
          {INFO_DESCRIPTIONS[tipKey]}
        </div>
      )}
    </div>
  );

  const isLocked = !!selectedBuilding;

  return (
    <div style={{ position: 'fixed', inset: 0, animation: 'fadeIn 0.8s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .search-input {
          background: transparent; border: none; outline: none;
          color: #f4ead5; font-size: 13px; font-family: inherit;
          width: 200px; letter-spacing: 0.02em;
        }
        .search-input::placeholder { color: rgba(244, 234, 213, 0.35); }
        .e-info-value {
          font-size: 13px; color: rgba(244,234,213,0.9);
          text-align: right; max-width: 160px;
        }
        .info-divider {
          border: none; border-top: 1px solid rgba(244, 234, 213, 0.08); margin: 8px 0;
        }
        .locked-indicator {
          position: absolute; top: 8px; right: 10px;
          font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(244,234,213,0.5);
        }
        .year-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 2px; background: transparent;
          outline: none; cursor: pointer; position: absolute;
          left: 0; pointer-events: none;
        }
        .year-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: #f4ead5; border: 2px solid rgba(237, 148, 85, 0.9);
          cursor: pointer; pointer-events: all;
          transition: transform 0.15s ease, background 0.15s ease;
          box-shadow: 0 0 6px rgba(237, 148, 85, 0.5);
        }
        .year-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25); background: #fff8ee;
        }
        .year-slider::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #f4ead5; border: 2px solid rgba(237, 148, 85, 0.9);
          cursor: pointer; pointer-events: all;
        }
      `}</style>

      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Back */}
      <Link to="/" className="back-btn" style={{
        ...glass, position: 'absolute', top: 20, left: 20,
        padding: '9px 16px', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'rgba(244,234,213,0.7)',
        textDecoration: 'none', display: 'block', zoom: 1.25,
      }}>
        Back
      </Link>

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        ...glass, position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 6, minWidth: 300, zIndex: 10, zoom: 1.25,
      }}>
        <input
          className="search-input" type="text"
          placeholder="Search address in St. Louis..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </form>

      {searchStatus && (
        <div style={{
          ...glass, position: 'absolute', top: 64, left: '50%',
          transform: 'translateX(-50%)', padding: '6px 16px',
          fontSize: 11, color: 'rgba(244,234,213,0.65)',
          whiteSpace: 'nowrap', zIndex: 10,
        }}>
          {searchStatus}
        </div>
      )}

      {/* Building info panel */}
      {displayBuilding && (
        <div style={{
          ...glass, position: 'absolute', top: 20, right: 20,
          width: 270, padding: '18px 20px', zIndex: 10,
          animation: 'panelIn 0.2s ease-out', zoom: 1.25,
        }}>
          {isLocked && <div className="locked-indicator">Pinned</div>}

          <div style={{
            fontSize: 15, color: '#f4ead5', lineHeight: 1.3,
            marginBottom: 4, letterSpacing: '-0.01em',
            paddingRight: isLocked ? 48 : 0,
          }}>
            {displayBuilding.address || 'Unknown address'}
          </div>

          {displayBuilding.neighborhood && (
            <div style={{
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(244,234,213,0.4)',
            }}>
            </div>
          )}

          <hr className="info-divider" />

          {displayBuilding.yearBuilt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
              <InfoLabel text="Built" tipKey="built" />
              <span className="e-info-value">
                {displayBuilding.yearBuilt} · {THIS_YEAR - Number(displayBuilding.yearBuilt)} yrs old
              </span>
            </div>
          )}

          {displayBuilding.vacantBldgYear && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
              <InfoLabel text="Vacant since" tipKey="vacant" />
              <span className="e-info-value" style={{ color: 'rgba(237,148,85,0.85)' }}>{displayBuilding.vacantBldgYear}</span>
            </div>
          )}

          {displayBuilding.assessedImprov > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
              <InfoLabel text="Assessed" tipKey="assessed" />
              <span className="e-info-value">${Number(displayBuilding.assessedImprov).toLocaleString()}</span>
            </div>
          )}

          {isLocked && (
            <div style={{
              marginTop: 14, fontSize: 10, letterSpacing: '0.08em',
              color: 'rgba(244,234,213,0.3)', textAlign: 'center', cursor: 'pointer',
            }} onClick={() => { selectedHandleRef.current = ''; setSelectedBuilding(null); applyYearFilter(yearRangeRef.current); }}>
              Click to unpin
            </div>
          )}
        </div>
      )}

      {/* Year range slider */}
      <div style={{
        ...glass, position: 'absolute', bottom: 32, left: '50%',
        transform: 'translateX(-50%)', padding: '18px 24px 20px',
        width: 340, zIndex: 10, zoom: 1.25,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline', marginBottom: 14,
        }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(244,234,213,0.4)' }}>
            Year built
          </span>
          <span style={{ fontSize: 13, color: 'rgba(244,234,213,0.75)', letterSpacing: '0.04em' }}>
            {yearRange[0]} – {yearRange[1]}
          </span>
        </div>

        <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'rgba(244, 234, 213, 0.12)', borderRadius: 1,
          }} />
          <div style={{
            position: 'absolute', left: `${minPct}%`, width: `${maxPct - minPct}%`,
            height: 2, background: 'linear-gradient(to right, #ffec9e, #ed9455)', borderRadius: 1,
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

        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 10,
          fontSize: 10, color: 'rgba(244,234,213,0.28)', letterSpacing: '0.06em',
        }}>
          {[1810, 1860, 1910, 1960, 2026].map(y => (
            <span key={y}>{y}</span>
          ))}
        </div>
      </div>
    </div>
  );
}