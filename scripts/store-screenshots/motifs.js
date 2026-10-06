// The app's keri (paisley) motif as inline SVG, for the store images that
// frame.js and feature.js compose: the same one the app draws in
// src/components/ledger/Motifs.tsx, so the listing looks like the app it shows.

const KERI = 'M60 152 C26 152 8 126 8 96 C8 60 34 34 64 22 C80 15 92 8 98 2 C104 14 100 30 90 40 C110 60 114 92 104 118 C96 140 80 152 60 152 Z';
const about = (x, y, t) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

/** A filigree keri, `height` px tall, as an <svg> element string. */
const keriSvg = ({ height, color = '#D9B96A', opacity = 0.12, rotate = -16, style = '' }) => {
  const width = (height * 120) / 160;
  const petals = [0, 60, 120, 180, 240, 300]
    .map(a => `<g transform="${about(58, 108, `rotate(${a})`)}"><path d="M58 108 C54 101 55 95 58 92 C61 95 62 101 58 108 Z" fill="${color}"/></g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 120 160" style="${style}" opacity="${opacity}">
    <g transform="${about(60, 90, `rotate(${rotate})`)}">
      <g transform="${about(60, 92, 'scale(1.07)')}"><path d="${KERI}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0.01 7.5"/></g>
      <path d="${KERI}" fill="none" stroke="${color}" stroke-width="2.2"/>
      <g transform="${about(60, 100, 'scale(0.66)')}"><path d="${KERI}" fill="none" stroke="${color}" stroke-width="2.6"/></g>
      <g transform="${about(60, 106, 'scale(0.38)')}"><path d="${KERI}" fill="none" stroke="${color}" stroke-width="3.6"/></g>
      ${petals}<circle cx="58" cy="108" r="2.6" fill="${color}"/>
      <path d="M98 2 C88 6 84 16 90 22 C94 26 100 22 98 17" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </g>
  </svg>`;
};

module.exports = { keriSvg };
