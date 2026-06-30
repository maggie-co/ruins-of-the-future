import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

const THIS_YEAR = new Date().getFullYear();

const EXTREMES = {
  top10: [
    { address: "757 S 2ND ST", neighborhood: "Seventh Ward", riskScore: 95, yearBuilt: 1906, condemned: true, lraOwned: true, lng: -90.18940374355284, lat: 38.61779231729991 },
    { address: "2614 N BROADWAY", neighborhood: "North Riverfront", riskScore: 95, yearBuilt: 2025, condemned: true, lraOwned: true, lng: -90.1900812796728, lat: 38.652200478351695 },
    { address: "1325-7 MONROE ST", neighborhood: "JeffVanderLou", riskScore: 95, yearBuilt: 2017, condemned: true, lraOwned: true, lng: -90.19534097668766, lat: 38.64744052819566 },
    { address: "1442-8 MONTGOMERY ST", neighborhood: "JeffVanderLou", riskScore: 95, yearBuilt: 1893, condemned: true, lraOwned: true, lng: -90.19854159528596, lat: 38.649722086666806 },
    { address: "3244 IOWA AV", neighborhood: "Patch", riskScore: 95, yearBuilt: 1859, condemned: true, lraOwned: true, lng: -90.22796039412887, lat: 38.59587854304548 },
    { address: "3410 OREGON AV", neighborhood: "Bevo Mill", riskScore: 95, yearBuilt: 1890, condemned: true, lraOwned: true, lng: -90.230843355284, lat: 38.59354969508648 },
    { address: "3643 S COMPTON AV", neighborhood: "Bevo Mill", riskScore: 95, yearBuilt: 1914, condemned: true, lraOwned: true, lng: -90.23786546506008, lat: 38.58979418381016 },
    { address: "3843 MISSOURI AV", neighborhood: "Princeton Heights", riskScore: 95, yearBuilt: 1884, condemned: true, lraOwned: true, lng: -90.22491913467486, lat: 38.584564645254524 },
    { address: "4026 N 19TH ST", neighborhood: "College Hill", riskScore: 95, yearBuilt: 1886, condemned: true, lraOwned: true, lng: -90.20315481498754, lat: 38.665161596913414 },
    { address: "4201-11 N GRAND BLVD", neighborhood: "O'Fallon", riskScore: 95, yearBuilt: 2020, condemned: true, lraOwned: true, lng: -90.21273354681115, lat: 38.66683705471454 },
  ],
  bottom10: [
    { address: "10784 LOOKAWAY CT", neighborhood: "Riverview", riskScore: 0, yearBuilt: 1983, lng: -90.18361993869195, lat: 38.76511622745942 },
    { address: "10060 LOOKAWAY DR", neighborhood: "Riverview", riskScore: 0, yearBuilt: 2016, lng: -90.19854270723643, lat: 38.74665089108608 },
    { address: "9041 RIVERVIEW DR", neighborhood: "Riverview", riskScore: 0, yearBuilt: 1959, lng: -90.22296668726452, lat: 38.72790886543425 },
    { address: "560 TERMINAL ROW", neighborhood: "Riverview", riskScore: 0, yearBuilt: 1979, lng: -90.22161974522075, lat: 38.724157031780855 },
    { address: "5939 GOODFELLOW BLVD", neighborhood: "Riverview", riskScore: 0, yearBuilt: 1958, lng: -90.25406680883046, lat: 38.71437383296727 },
    { address: "4607R MCREE AV", neighborhood: "McRee Town", riskScore: 0, yearBuilt: 1926, lng: -90.26399812114819, lat: 38.62228134682193 },
    { address: "3148 S KINGSHIGHWAY BLVD", neighborhood: "Lindenwood Park", riskScore: 0, yearBuilt: 2000, lng: -90.26854691515297, lat: 38.602653517050655 },
    { address: "7460 HAMPTON AV", neighborhood: "Ellendale", riskScore: 0, yearBuilt: 2002, lng: -90.29354578222147, lat: 38.564695190349084 },
    { address: "303 S GRAND BLVD", neighborhood: "Tower Grove South", riskScore: 0, yearBuilt: 1969, lng: -90.23622118175271, lat: 38.632872135515974 },
    { address: "3238 DR MARTIN LUTHER KING DR", neighborhood: "Fountain Park", riskScore: 0, yearBuilt: 1919, lng: -90.22460688530994, lat: 38.64398377353994 },
  ],
};


const FORMULA_VARS = [
  {
    key: 'condemned',
    label: 'Condemnation',
    weight: 35,
    color: '#b01a1a',
    description: 'Whether the building has an active condemnation order from the City of St. Louis Building Division. Condemnation means the city has officially deemed the structure unsafe or uninhabitable. Source: City of St. Louis bldginsp.mdb, Condemn table (updated 2026).',
  },
  {
    key: 'lraOwned',
    label: 'LRA Ownership',
    weight: 25,
    color: '#d4621a',
    description: 'Whether the parcel is owned by the Land Reutilization Authority, the city land bank for tax-delinquent and abandoned properties. LRA ownership strongly predicts eventual demolition or clearance. Source: lra_public.mdb (updated 2018).',
  },
  {
    key: 'landRatio',
    label: 'Land Value Ratio',
    weight: 25,
    color: '#f0cf3f',
    description: 'Assessed land value divided by assessed improvement value. When land is worth more than the building on it, the economics favor demolition and redevelopment. Normalized against the 95th percentile across all parcels (p95 = 0.43). Source: par.dbf, fields ASMTLAND and ASMTIMPROV.',
  },
  {
    key: 'demoPerm',
    label: 'Demolition Permit',
    weight: 10,
    color: '#ea7e26',
    description: 'Whether a demolition permit has been issued for this parcel. A permit does not confirm demolition has occurred, only that it has been authorized. Source: prmbdo.mdb, PrmDemo table (updated 2026).',
  },
  {
    key: 'historicDist',
    label: 'Historic District',
    weight: -20,
    color: '#4a9e6e',
    description: 'Whether the parcel falls within a designated historic district boundary. Historic designation provides legal protection against demolition and typically requires review before alterations. This variable reduces the risk score. Source: historict_districts.shp, spatial join (updated 2014).',
  },
];

const INFO_DESCRIPTIONS = {
  riskScore: 'A composite index from 0 to 100 derived from five weighted variables: condemnation status, LRA ownership, land value ratio, demolition permits, and historic district protection. Higher scores indicate greater likelihood of demolition.',
  built: 'Year of construction from the city assessor records. Age is calculated from the current year. The lifespan estimate assumes a 120-year base lifespan for masonry construction, reduced proportionally by risk score.',
  status: 'Whether the building carries an active condemnation order from the City Building Division. Condemned buildings have been officially deemed unsafe or uninhabitable.',
  demoPerm: 'Whether a demolition permit has been issued for this parcel by the city. Indicates authorized intent to demolish, though permits do not confirm demolition has occurred.',
  landRatio: 'Ratio of assessed land value to assessed improvement value. A ratio above 1.0 means the land is worth more than the building, which signals redevelopment pressure. The city median is approximately 0.12.',
};

export default function PersistenceMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [tooltipVar, setTooltipVar] = useState(null);
  const [infoTooltip, setInfoTooltip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [tableTab, setTableTab] = useState('high');

  const displayBuilding = selectedBuilding || hoveredBuilding;

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

  const flyTo = useCallback((lng, lat) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1200, essential: true });
    setShowTable(false);
  }, []);

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
                0,   '#3a5a82',
                25,  '#4589a8',
                45,  '#52b3a0',
                60,  '#9fc857',
                72,  '#f0cf3f',
                85,  '#ea7e26',
                100, '#d8331f',
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
              'line-color': '#ffffff',
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

    map.on('mousemove', 'buildings-persistence', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      setHoveredBuilding(e.features[0].properties);
    });

    map.on('mouseleave', 'buildings-persistence', () => {
      map.getCanvas().style.cursor = '';
      setHoveredBuilding(null);
    });

    map.on('click', 'buildings-persistence', (e) => {
      const p = e.features[0].properties;
      setSelectedBuilding(prev => prev?.handle === p.handle ? null : p);
      map.setFilter('buildings-selected', ['==', ['get', 'handle'], p.handle]);
      map.flyTo({ center: e.lngLat, zoom: Math.max(map.getZoom(), 16), duration: 1000, essential: true });
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['buildings-persistence'] });
      if (!features.length) {
        setSelectedBuilding(null);
        map.setFilter('buildings-selected', ['==', ['get', 'handle'], '']);
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  const glass = {
    background: 'rgba(8, 10, 18, 0.88)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(180, 200, 255, 0.12)',
    borderRadius: 3,
    color: '#e8f0ff',
  };

  const riskLabel = (score) => {
    if (score >= 70) return { label: 'High risk', color: '#ea7e26' };
    if (score >= 40) return { label: 'Moderate risk', color: '#9fc857' };
    return { label: 'Low risk', color: '#4589a8' };
  };

  const InfoLabel = ({ text, tipKey, style }) => (
    <div
      style={{ position: 'relative', display: 'inline-block', cursor: 'help', ...style }}
      onMouseEnter={() => setInfoTooltip(tipKey)}
      onMouseLeave={() => setInfoTooltip(null)}
    >
      <span style={{
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'rgba(200,215,255,0.55)',
        borderBottom: '1px dotted rgba(200,215,255,0.25)',
      }}>
        {text}
      </span>
      {infoTooltip === tipKey && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)',
          right: 'calc(100% + 8px)', left: 'auto',
          width: 220, background: 'rgba(8,10,18,0.97)',
          border: '1px solid rgba(180,200,255,0.15)',
          borderRadius: 3, padding: '10px 12px',
          fontSize: 11, color: 'rgba(220,232,255,0.75)',
          lineHeight: 1.6, zIndex: 200, pointerEvents: 'none',  zoom: 1.25,
        }}>
          {INFO_DESCRIPTIONS[tipKey]}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, animation: 'fadeIn 0.8s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .p-search-input {
          background: transparent; border: none; outline: none;
          color: #e8f0ff; font-size: 13px; font-family: inherit;
          width: 200px; letter-spacing: 0.02em;
        }
        .p-search-input::placeholder { color: rgba(180,200,255,0.35); }
        .p-search-btn {
          background: none; border: none; color: rgba(180,200,255,0.5);
          cursor: pointer; padding: 0 0 0 8px; font-size: 15px; transition: color 0.2s;
        }
        .p-search-btn:hover { color: #e8f0ff; }
        .p-info-value {
          font-size: 13px; color: rgba(232,240,255,0.9);
          text-align: right; max-width: 160px;
        }
        .p-divider { border: none; border-top: 1px solid rgba(180,200,255,0.08); margin: 8px 0; }
        .formula-row {
          display: flex; align-items: center; gap: 10px;
          padding: 7px 0; border-bottom: 1px solid rgba(180,200,255,0.06);
          cursor: pointer; position: relative; transition: background 0.15s;
        }
        .formula-row:last-child { border-bottom: none; }
        .formula-row:hover { background: rgba(180,200,255,0.04); }
        .formula-tooltip {
          position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
          background: rgba(8,10,18,0.97);
          border: 1px solid rgba(180,200,255,0.15);
          border-radius: 3px; padding: 10px 12px;
          font-size: 11px; color: rgba(220,232,255,0.75);
          line-height: 1.6; z-index: 100; pointer-events: none;
        }
        .locked-indicator {
          position: absolute; top: 8px; right: 10px;
          font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(180,200,255,0.5);
        }
        .table-row {
          display: grid; grid-template-columns: 1fr auto;
          padding: 8px 4px; border-bottom: 1px solid rgba(180,200,255,0.06);
          cursor: pointer; transition: background 0.15s; gap: 12px;
          align-items: center;
        }
        .table-row:hover { background: rgba(180,200,255,0.05); }
        .table-row:last-child { border-bottom: none; }
        .tab-btn {
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 10px; letter-spacing: 0.12em;
          text-transform: uppercase; padding: 6px 12px;
          transition: color 0.2s, border-color 0.2s;
        }
      `}</style>

      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Back */}
      <Link to="/" className="back-btn" style={{
        ...glass, position: 'absolute', top: 20, left: 20,
        padding: '9px 16px', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'rgba(200,215,255,0.7)',
        textDecoration: 'none', display: 'block',  zoom: 1.25,
      }}>
        Back
      </Link>

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        ...glass, position: 'absolute', top: 20, left: '50%',
        transform: 'translateX(-50%)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 6, minWidth: 300, zIndex: 10,  zoom: 1.25,
      }}>
        <input
          className="p-search-input" type="text"
          placeholder="Search address in St. Louis..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        </form>

      {searchStatus && (
        <div style={{
          ...glass, position: 'absolute', top: 64, left: '50%',
          transform: 'translateX(-50%)', padding: '6px 16px',
          fontSize: 11, color: 'rgba(200,215,255,0.65)',
          whiteSpace: 'nowrap', zIndex: 10,
        }}>
          {searchStatus}
        </div>
      )}

{/* Building info panel */}
{displayBuilding && (() => {
        const { label, color } = riskLabel(displayBuilding.riskScore);
        const isLocked = !!selectedBuilding;
        return (
          <div style={{
            ...glass, position: 'absolute', top: 20, right: 20,
            width: 270, padding: '18px 20px', zIndex: 10,
            animation: 'panelIn 0.2s ease-out', zoom: 1.25,
          }}>
            {isLocked && <div className="locked-indicator">Pinned</div>}

            <div style={{
              fontSize: 15, color: '#e8f0ff', lineHeight: 1.3,
              marginBottom: 4, letterSpacing: '-0.01em',
              paddingRight: isLocked ? 48 : 0,
            }}>
              {displayBuilding.address || 'Unknown address'}
            </div>

            <hr className="p-divider" />

            {/* Persistence risk index — collapsible formula */}
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => setLegendExpanded(v => !v)}
              >
                <span style={{
                  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'rgba(200,215,255,0.5)',
                }}>
                  Persistence risk index
                </span>
                <span style={{
                  fontSize: 10, color: 'rgba(200,215,255,0.4)',
                  transform: legendExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease', display: 'inline-block',
                }}>
                  ▶
                </span>
              </div>

              <div style={{
                height: 6, borderRadius: 3, marginTop: 8,
                background: 'linear-gradient(to right, #3a5a82, #52b3a0, #9fc857, #f0cf3f, #ea7e26, #d8331f)',
              }} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: 'rgba(200,215,255,0.4)', letterSpacing: '0.06em',
                marginTop: 6,
              }}>
                <span>Safe</span><span>Moderate</span><span>High risk</span>
              </div>

              {legendExpanded && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'rgba(200,215,255,0.35)', marginBottom: 8,
                  }}>
                    Weighted variables / hover for details
                  </div>
                  {FORMULA_VARS.map(v => (
                    <div
                      key={v.key}
                      className="formula-row"
                      onMouseEnter={() => setTooltipVar(v.key)}
                      onMouseLeave={() => setTooltipVar(null)}
                    >
                      {tooltipVar === v.key && (
                        <div className="formula-tooltip">{v.description}</div>
                      )}
                      <div style={{
                        width: 28, height: 3, borderRadius: 1, flexShrink: 0,
                        background: v.weight < 0 ? '#4a9e6e' : v.color,
                        opacity: Math.abs(v.weight) / 35,
                      }} />
                      <div style={{ flex: 1, fontSize: 12, color: 'rgba(220,232,255,0.85)' }}>
                        {v.label}
                      </div>
                      <div style={{
                        fontSize: 11, fontFamily: 'monospace',
                        color: v.weight < 0 ? '#4a9e6e' : v.color,
                        letterSpacing: '0.04em',
                      }}>
                        {v.weight > 0 ? `+${v.weight}` : v.weight}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: 10, fontSize: 10, color: 'rgba(200,215,255,0.25)',
                    lineHeight: 1.6,
                  }}>
                    Score = sum of weighted variables, clamped 0 to 100.<br />
                    Source: City of St. Louis Open Data Portal, 2021 to 2026.
                  </div>
                </div>
              )}
            </div>

            <hr className="p-divider" />

            {/* Persistence risk score */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Persistence risk" tipKey="riskScore" />
                <span style={{ fontSize: 13, color, fontWeight: 500 }}>
                  {displayBuilding.riskScore} / {label}
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(180,200,255,0.1)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', width: `${displayBuilding.riskScore}%`,
                  background: `linear-gradient(to right, #3a5a82, ${color})`,
                  borderRadius: 2, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            <hr className="p-divider" />

            {/* Built */}
            {displayBuilding.yearBuilt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
                <InfoLabel text="Built" tipKey="built" />
                <span className="p-info-value">
                  {displayBuilding.yearBuilt} · {THIS_YEAR - displayBuilding.yearBuilt} yrs old
                </span>
              </div>
            )}

            {/* Demo permit */}
            {displayBuilding.demoPerm && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Demo permit" tipKey="demoPerm" />
                <span style={{ fontSize: 13, color: '#d4621a' }}>Issued</span>
              </div>
            )}

            {/* Land ratio */}
            {displayBuilding.landRatio > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Land ratio" tipKey="landRatio" />
                <span className="p-info-value">{Number(displayBuilding.landRatio).toFixed(2)}</span>
              </div>
            )}

            {/* Remaining flags */}
            {displayBuilding.condemned && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Status" tipKey="status" />
                <span style={{ fontSize: 13, color: '#c83a3a' }}>Condemned</span>
              </div>
            )}
            {displayBuilding.lraOwned && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Ownership" tipKey="riskScore" />
                <span style={{ fontSize: 13, color: '#d4621a' }}>City land bank</span>
              </div>
            )}
            {displayBuilding.historicDist && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
                <InfoLabel text="Protection" tipKey="riskScore" />
                <span style={{ fontSize: 13, color: '#4a9e6e' }}>Historic district</span>
              </div>
            )}

            {isLocked && (
              <div style={{
                marginTop: 14, fontSize: 10, letterSpacing: '0.08em',
                color: 'rgba(180,200,255,0.3)', textAlign: 'center', cursor: 'pointer',
              }} onClick={() => setSelectedBuilding(null)}>
                Click to unpin
              </div>
            )}
          </div>
        );
      })()}
      {/*
      <button onClick={() => setShowTable(v => !v)} style={{
        ...glass, position: 'absolute', top: 20, left: 100,
        padding: '9px 16px', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'rgba(200,215,255,0.7)',
        cursor: 'pointer', border: '1px solid rgba(180,200,255,0.12)',
      }}>
        {showTable ? 'Hide table' : 'Risk extremes'}
      </button>

      
        {showTable && ( 
        <div style={{
          ...glass, position: 'absolute', top: 68, left: 20,
          width: 380, maxHeight: 480, overflowY: 'auto',
          padding: '16px 20px', zIndex: 20,
          animation: 'panelIn 0.2s ease-out',  zoom: 1.25,
        }}>
          <div style={{
            fontSize: 13, color: '#e8f0ff', marginBottom: 4, fontWeight: 400,
          }}>
            Risk extremes
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(200,215,255,0.4)',
            lineHeight: 1.6, marginBottom: 14,  zoom: 1.25,
          }}>
            Within this dataset only. The index reflects administrative signals
            (condemnation, LRA ownership, demolition permits) available in public
            city records as of 2021 to 2026. Buildings with missing data, recent
            ownership changes, or newly at-risk conditions may not be reflected.
            Scores are not a prediction of demolition dates.
          </div>

          
          <div style={{
            display: 'flex', borderBottom: '1px solid rgba(180,200,255,0.1)',
            marginBottom: 12,
          }}>
            <button className="tab-btn" onClick={() => setTableTab('high')} style={{
              color: tableTab === 'high' ? '#ea7e26' : 'rgba(200,215,255,0.4)',
              borderBottom: tableTab === 'high' ? '1px solid #ea7e26' : '1px solid transparent',
            }}>
              Highest risk
            </button>
            <button className="tab-btn" onClick={() => setTableTab('low')} style={{
              color: tableTab === 'low' ? '#4589a8' : 'rgba(200,215,255,0.4)',
              borderBottom: tableTab === 'low' ? '1px solid #4589a8' : '1px solid transparent',
            }}>
              Lowest risk
            </button>
          </div>

          {(tableTab === 'high' ? EXTREMES.top10 : EXTREMES.bottom10).map((b, i) => (
            <div
              key={i}
              className="table-row"
              onClick={() => flyTo(b.lng, b.lat)}
            >
              <div>
                <div style={{ fontSize: 12, color: '#e8f0ff', marginBottom: 2 }}>
                  {b.address}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(200,215,255,0.4)', letterSpacing: '0.06em' }}>
                  {b.neighborhood} · Built {b.yearBuilt}
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 500, flexShrink: 0,
                color: tableTab === 'high' ? '#ea7e26' : '#4589a8',
              }}>
                {b.riskScore}
              </div>
            </div>
          ))} 

          <div style={{
            marginTop: 12, fontSize: 10, color: 'rgba(200,215,255,0.25)',
            letterSpacing: '0.06em', lineHeight: 1.6,
          }}>
            Click any row to fly to that location.
          </div>
        </div>
      )} */}

    </div>
  );
}