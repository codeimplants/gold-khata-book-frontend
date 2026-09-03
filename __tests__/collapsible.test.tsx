/**
 * @format
 *
 * Regression cover for the 1.0.15 bug where every disclosure built on
 * Collapsible — Old Ornament Exchange, Ornament Photos, Witnesses, Bank
 * Details — flipped its toggle but never revealed its block.
 *
 * The component opens to a height it measures from its own content. The
 * measuring view used to be a normal in-flow child of the wrapper that is
 * clamped to `height: 0` until that first measurement, which is a
 * self-reinforcing zero: the clamped parent sizes the child to 0, the child
 * reports 0, the parent interpolates 0 -> 0 and stays clamped, so no further
 * layout pass ever fires and nothing can reopen it.
 *
 * Taking the measuring view out of flow is what breaks the loop — its height
 * becomes its own content's height rather than the parent's current one.
 *
 * These tests run under react-native-web (see jest.config.js), so they pin the
 * component's contract; they cannot exercise native Yoga layout, which is where
 * the zero originated.
 */

import React from 'react';
import { Text, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import Collapsible from '../src/components/common/Collapsible';

const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 320, height } },
});

/** The single onLayout-bearing view Collapsible wraps its children in. */
const measuringView = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root.findAllByType(View).find(v => typeof v.props.onLayout === 'function');

/** Style of the animated wrapper, read off the rendered output rather than the
 *  element tree — Animated.View is not a `View` under react-native-web. */
const wrapperStyle = (root: ReactTestRenderer.ReactTestRenderer) =>
  (root.toJSON() as any)?.props?.style ?? {};

const child = (
  <View>
    <Text>exchange row</Text>
  </View>
);

const mount = async (expanded: boolean) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <Collapsible expanded={expanded}>{child}</Collapsible>,
    );
  });
  return renderer;
};

test('renders nothing while collapsed', async () => {
  const renderer = await mount(false);
  expect(renderer.toJSON()).toBeNull();
});

test('mounts its children once expanded', async () => {
  const renderer = await mount(false);
  await ReactTestRenderer.act(() => {
    renderer.update(<Collapsible expanded={true}>{child}</Collapsible>);
  });

  expect(renderer.root.findAllByType(Text)).toHaveLength(1);
  expect(measuringView(renderer)).toBeDefined();
});

test('the measuring view is out of flow, so a clamped parent cannot size it', async () => {
  // This is the fix. In flow, the parent's animated height feeds back into the
  // measurement and pins it at zero.
  const renderer = await mount(true);
  const style = Object.assign(
    {},
    ...[measuringView(renderer)!.props.style].flat().filter(Boolean),
  );

  expect(style.position).toBe('absolute');
});

test('opens to the height its content reports', async () => {
  const renderer = await mount(true);

  await ReactTestRenderer.act(() => {
    measuringView(renderer)!.props.onLayout(layout(180));
  });

  // Mounted already expanded, so progress is at 1 and the interpolation has
  // resolved to the full content height rather than an animated fraction.
  expect(wrapperStyle(renderer).height).toBe('180px');
});

test('a zero measurement is ignored rather than stored as the open height', async () => {
  const renderer = await mount(true);

  await ReactTestRenderer.act(() => {
    measuringView(renderer)!.props.onLayout(layout(0));
  });

  // Storing the zero is what made the block open to nothing. It must still be
  // waiting to be measured, not sitting at a resolved height of zero.
  expect(wrapperStyle(renderer).height).not.toBe('0px');

  await ReactTestRenderer.act(() => {
    measuringView(renderer)!.props.onLayout(layout(180));
  });

  expect(wrapperStyle(renderer).height).toBe('180px');
});
