import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

interface CollapsibleProps {
  expanded: boolean;
  children: React.ReactNode;
  /** Long enough to read as movement, short enough not to feel like a wait. */
  duration?: number;
}

/**
 * Animates a block open and shut instead of having it appear and vanish.
 *
 * Drop-in for the `{flag && <block/>}` pattern the toggles all used: it keeps
 * the same mount semantics (nothing is rendered once closed) and adds the
 * movement between the two states.
 *
 * Built on RN's own `Animated` rather than Reanimated on purpose. Reanimated
 * is installed, but babel.config.js deliberately withholds its plugin from the
 * web build ("it breaks on web"), so its worklets would not run there —
 * `Animated` is implemented by react-native-web and behaves the same on both.
 *
 * Height is a layout property, so this runs on the JS thread; the animation is
 * one interpolation on one view, which is cheap enough for that not to matter.
 *
 * ## Why the content is positioned absolutely
 *
 * The measuring view must not be a normal in-flow child. In flow it is laid out
 * inside a parent that is clamped to `height: 0` until the first measurement,
 * and a child measured against a zero-height container can come back as zero
 * itself. That is unrecoverable: `contentHeight` latches to 0, the interpolation
 * runs from 0 to 0, and the block stays invisible however many times it is
 * toggled — the toggle looks dead. This shipped in 1.0.15 and took out every
 * disclosure built on this component (Old Ornament Exchange on both the invoice
 * and advance-order screens, witnesses, bank details, ornament photos).
 *
 * Taking it out of flow makes its height its own content's height, independent
 * of whatever the parent is currently animating through, so the measurement is
 * correct on the first pass and stays correct while the block is open.
 */
const Collapsible = ({ expanded, children, duration = 220 }: CollapsibleProps) => {
  /** Held past `expanded` going false so the closing animation has something
   *  to animate, then dropped. */
  const [mounted, setMounted] = useState(expanded);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    if (expanded) setMounted(true);
  }, [expanded]);

  useEffect(() => {
    // Opening cannot start before the content has been measured — there would
    // be no height to travel to.
    if (!mounted || (expanded && contentHeight == null)) return;

    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      // Height cannot run on the native driver, and react-native-web has no
      // native driver at all.
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !expanded) setMounted(false);
    });
    return () => animation.stop();
  }, [expanded, mounted, contentHeight, duration, progress]);

  if (!mounted) return null;

  /**
   * Re-measured on every layout, not just the first: a block that grows while
   * it is open — another ornament row, a revealed sub-field — would otherwise
   * be clipped at the height it had when it opened.
   *
   * A zero measurement is never stored. Every block this wraps has content, so
   * zero means the layout pass could not size it rather than that it is empty,
   * and storing it would latch the block shut for good.
   */
  const measure = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next <= 0) return;
    setContentHeight(prev =>
      prev != null && Math.abs(prev - next) < 1 ? prev : next,
    );
  };

  return (
    <Animated.View
      style={[
        styles.clip,
        contentHeight == null
          ? // Clamped shut for the single frame before the first measurement,
            // so nothing is seen at full height and then animated away from it.
            styles.unmeasured
          : {
              height: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, contentHeight],
              }),
              opacity: progress,
            },
      ]}
    >
      <View style={styles.content} onLayout={measure}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  unmeasured: { height: 0, opacity: 0 },
  /** Out of flow, so the parent's animated height never constrains it. `right: 0`
   *  rather than a width keeps it as wide as the parent, which is what it would
   *  have been in flow. */
  content: { position: 'absolute', left: 0, right: 0, top: 0 },
});

export default Collapsible;
