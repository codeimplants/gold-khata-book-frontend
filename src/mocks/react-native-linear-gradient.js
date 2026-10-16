// Web stub: the real package uses Flow syntax that webpack's babel-loader
// can't parse, and native gradient rendering has no web equivalent anyway.
// Approximates the same visual with a CSS linear-gradient background.
const React = require('react');
const { View } = require('react-native');

// start/end are fractions of the box, as on native. Corner and side pairs map
// to CSS keywords: `to bottom right` also runs corner to corner on a box that
// is not square, as CAGradientLayer and Android's gradient do. Anything else
// falls back to an angle. With no start/end the stub keeps its old 135deg.
function direction(start, end) {
  if (!start || !end) return '135deg';
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const edge = v => v === 0 || Math.abs(v) === 1;
  if (edge(dx) && edge(dy) && (dx || dy)) {
    const v = dy > 0 ? 'bottom' : dy < 0 ? 'top' : '';
    const h = dx > 0 ? 'right' : dx < 0 ? 'left' : '';
    return `to ${[v, h].filter(Boolean).join(' ')}`;
  }
  return `${Math.round((Math.atan2(dx, -dy) * 180) / Math.PI)}deg`;
}

function colorsToCss(colors, start, end, locations) {
  if (!colors || colors.length === 0) return undefined;
  if (colors.length === 1) return colors[0];
  const stops = colors.map((c, i) =>
    locations && locations[i] != null ? `${c} ${locations[i] * 100}%` : c,
  );
  return `linear-gradient(${direction(start, end)}, ${stops.join(', ')})`;
}

const LinearGradient = ({ colors, start, end, locations, style, children, ...rest }) => {
  const backgroundImage = colorsToCss(colors, start, end, locations);
  return React.createElement(
    View,
    {
      ...rest,
      style: [style, backgroundImage ? { backgroundImage } : null],
    },
    children,
  );
};

module.exports = LinearGradient;
module.exports.default = LinearGradient;
