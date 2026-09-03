// Web stub: the real package uses Flow syntax that webpack's babel-loader
// can't parse, and native gradient rendering has no web equivalent anyway.
// Approximates the same visual with a CSS linear-gradient background.
const React = require('react');
const { View } = require('react-native');

function colorsToCss(colors) {
  if (!colors || colors.length === 0) return undefined;
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

const LinearGradient = ({ colors, start, end, style, children, ...rest }) => {
  const backgroundImage = colorsToCss(colors);
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
