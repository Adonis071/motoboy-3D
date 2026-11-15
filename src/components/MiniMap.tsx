import React, { useMemo } from 'react';
import { VERTICAL_AVENUES_X, HORIZONTAL_AVENUES_Z } from '../game/cityEnvironment';
import { CITY_SHELTERS } from '../game/shelters';

interface MiniMapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  targetX?: number;
  targetZ?: number;
  isPickup?: boolean;
  showShelters?: boolean;
}

const MAP_SIZE = 144;
const MIN_X = -180;
const MAX_X = 460;
const MIN_Z = -210;
const MAX_Z = 210;
const clampMap = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
const toMapX = (x: number) =>
  ((clampMap(x, MIN_X, MAX_X) - MIN_X) / (MAX_X - MIN_X)) * MAP_SIZE;
const toMapZ = (z: number) =>
  ((clampMap(z, MIN_Z, MAX_Z) - MIN_Z) / (MAX_Z - MIN_Z)) * MAP_SIZE;

export const MiniMap: React.FC<MiniMapProps> = React.memo(({
  playerX,
  playerZ,
  playerHeading,
  targetX,
  targetZ,
  isPickup,
  showShelters,
}) => {
  const staticGrid = useMemo(() => {
    const coreVert = VERTICAL_AVENUES_X.filter(x => x >= -150 && x <= 440);
    const coreHoriz = HORIZONTAL_AVENUES_Z.filter(z => z >= -180 && z <= 180);

    return (
      <svg
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        className="absolute inset-0 w-full h-full opacity-90"
      >
        {/* Ocean Channel separating Main City and Nova Metrópole */}
        <rect
          x={toMapX(95)}
          y={0}
          width={toMapX(255) - toMapX(95)}
          height={MAP_SIZE}
          fill="#0369a1"
          opacity="0.65"
        />

        {/* Horizontal Avenues (split across the Ocean except the Z = -15 Bridge!) */}
        {coreHoriz.map((z, i) =>
          z === -15 ? (
            <g key={`h-bridge-${i}`}>
              <line
                x1={0}
                y1={toMapZ(z)}
                x2={MAP_SIZE}
                y2={toMapZ(z)}
                stroke="#64748b"
                strokeWidth="2"
              />
              {/* Highlighted Cable-Stayed Bridge Span */}
              <line
                x1={toMapX(90)}
                y1={toMapZ(z)}
                x2={toMapX(260)}
                y2={toMapZ(z)}
                stroke="#00f3ff"
                strokeWidth="3.5"
              />
            </g>
          ) : (
            <g key={`h-${i}`}>
              <line
                x1={0}
                y1={toMapZ(z)}
                x2={toMapX(92)}
                y2={toMapZ(z)}
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <line
                x1={toMapX(258)}
                y1={toMapZ(z)}
                x2={MAP_SIZE}
                y2={toMapZ(z)}
                stroke="#64748b"
                strokeWidth="1.5"
              />
            </g>
          )
        )}

        {/* Vertical Avenues in Main City & Nova Metrópole */}
        {coreVert.map((x, i) => (
          <line
            key={`v-${i}`}
            x1={toMapX(x)}
            y1={0}
            x2={toMapX(x)}
            y2={MAP_SIZE}
            stroke={x >= 280 ? '#38bdf8' : '#64748b'}
            strokeWidth="1.6"
          />
        ))}

        {/* 3D Soccer Stadiums */}
        <rect
          x={toMapX(-62)}
          y={toMapZ(150)}
          width={toMapX(-18) - toMapX(-62)}
          height={toMapZ(186) - toMapZ(150)}
          rx="3"
          fill="#16a34a"
          stroke="#fbbf24"
          strokeWidth="1.2"
        />
        <rect
          x={toMapX(328)}
          y={toMapZ(-186)}
          width={toMapX(372) - toMapX(328)}
          height={toMapZ(-150) - toMapZ(-186)}
          rx="3"
          fill="#16a34a"
          stroke="#38bdf8"
          strokeWidth="1.2"
        />
      </svg>
    );
  }, []);

  // Compute GPS Route Points & Direction Arrows
  const routeOverlay = useMemo(() => {
    if (targetX === undefined || targetZ === undefined) return null;

    const px = toMapX(playerX);
    const pz = toMapZ(playerZ);
    const tx = toMapX(targetX);
    const tz = toMapZ(targetZ);

    const crossesBridge =
      (playerX < 160 && targetX > 180) || (playerX > 180 && targetX < 160);

    const waypoints: Array<{ x: number; y: number }> = [{ x: px, y: pz }];
    if (crossesBridge) {
      const bridgeY = toMapZ(-15);
      waypoints.push({ x: px, y: bridgeY });
      waypoints.push({ x: tx, y: bridgeY });
    } else {
      waypoints.push({ x: px, y: tz });
    }
    waypoints.push({ x: tx, y: tz });

    const pointsStr = waypoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const routeColor = isPickup ? '#fbbf24' : '#10b981';

    // Generate directional chevron arrows along each segment
    const arrows: Array<{ x: number; y: number; deg: number; key: string }> = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 12) continue;
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const steps = Math.max(1, Math.min(3, Math.floor(len / 26)));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        arrows.push({
          x: a.x + dx * t,
          y: a.y + dy * t,
          deg,
          key: `arr-${i}-${s}`,
        });
      }
    }

    return (
      <svg
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      >
        <polyline
          points={pointsStr}
          fill="none"
          stroke={routeColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
        />
        <polyline
          points={pointsStr}
          fill="none"
          stroke={routeColor}
          strokeWidth="1.8"
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {arrows.map(arr => (
          <g
            key={arr.key}
            transform={`translate(${arr.x.toFixed(1)}, ${arr.y.toFixed(1)}) rotate(${arr.deg.toFixed(1)})`}
          >
            <polygon points="-3,-2.6 3.5,0 -3,2.6" fill="#ffffff" stroke={routeColor} strokeWidth="0.6" />
          </g>
        ))}
      </svg>
    );
  }, [playerX, playerZ, targetX, targetZ, isPickup]);

  return (
    <div className="relative w-[136px] h-[136px] sm:w-[152px] sm:h-[152px] bg-slate-900/75 border-2 border-emerald-500/40 rounded-2xl overflow-hidden shadow-2xl">
      <div className="absolute inset-0 bg-slate-950/60" />
      {staticGrid}
      {routeOverlay}

      {/* Gas Stations & Shelters Overlay */}
      {CITY_SHELTERS.map(s => {
        if (!showShelters && s.type !== 'gas_station') return null;
        const isGas = s.type === 'gas_station';
        return (
          <div
            key={s.id}
            title={s.name}
            className={`absolute w-2.5 h-2.5 rounded-sm border border-white z-10 ${
              isGas
                ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.9)]'
                : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse'
            }`}
            style={{
              left: `${(toMapX(s.x) / MAP_SIZE) * 100}%`,
              top: `${(toMapZ(s.z) / MAP_SIZE) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}

      {/* Target Marker */}
      {targetX !== undefined && targetZ !== undefined && (
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg z-20 animate-pulse"
          style={{
            left: `${(toMapX(targetX) / MAP_SIZE) * 100}%`,
            top: `${(toMapZ(targetZ) / MAP_SIZE) * 100}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: isPickup ? '#f59e0b' : '#10b981',
          }}
        />
      )}

      {/* Player Directional Arrow Marker */}
      <div
        className="absolute z-30"
        style={{
          left: `${(toMapX(playerX) / MAP_SIZE) * 100}%`,
          top: `${(toMapZ(playerZ) / MAP_SIZE) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${(-playerHeading * 180) / Math.PI + 180}deg)`,
        }}
      >
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.9)]" />
      </div>

      {/* GPS Badge */}
      <div className="absolute bottom-1 left-1.5 z-30 bg-slate-950/85 border border-emerald-500/40 px-1.5 py-0.5 rounded text-[8px] font-black text-emerald-400 uppercase tracking-wider pointer-events-none">
        GPS ROTA 🗺️
      </div>
    </div>
  );
});


