import { Platform, ViewStyle, useWindowDimensions } from 'react-native';

/**
 * Global layout constants for the application.
 * These are primarily used to ensure a consistent experience across Web and Mobile.
 */
export const LAYOUT = {
  // The maximum width for the main content on web (desktop).
  // Equivalent to max-w-2xl in Tailwind (42rem / 672px).
  webMaxWidth: 672,

  // Helper to check if we are on web
  isWeb: Platform.OS === 'web',

  // Style helper for centered content on web
  centeredStyle: Platform.OS === 'web' ? {
    maxWidth: 672,
    width: '100%',
    marginHorizontal: 'auto',
    flex: 1,
  } as ViewStyle : {
    flex: 1,
  } as ViewStyle,

  // ScrollView content container style
  contentContainerStyle: Platform.OS === 'web' ? {
    maxWidth: 672,
    width: '100%',
    marginHorizontal: 'auto',
  } as ViewStyle : {} as ViewStyle,

  /**
   * Surface style for a bottom sheet.
   *
   * A sheet is authored for a phone, where full-bleed is correct. On a desktop
   * browser the same markup spans the entire viewport width and reads as a
   * band stuck to the bottom of the page. On web it is capped and centred, and
   * its lower corners are rounded with a margin beneath so it presents as a
   * deliberate floating panel rather than a stretched mobile sheet.
   *
   * Empty off web, so phones and tablets are untouched.
   */
  sheetSurfaceStyle: Platform.OS === 'web' ? {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  } as ViewStyle : {} as ViewStyle,

  /**
   * Cap for a centred dialog sized as a percentage of the viewport.
   *
   * `w="85%"` is sensible on a phone and absurd on a desktop, where it yields a
   * 1600px-wide dropdown. Pairs with the existing percentage width rather than
   * replacing it, so the phone layout is untouched.
   *
   * Empty off web.
   */
  dialogSurfaceStyle: Platform.OS === 'web' ? {
    maxWidth: 420,
  } as ViewStyle : {} as ViewStyle,

  // 424 = 384px card (max-w-sm) + 2×20px px="$5" padding
  loginWebStyle: Platform.OS === 'web' ? {
    maxWidth: 424,
    width: '100%',
    marginHorizontal: 'auto',
    flex: 1,
  } as ViewStyle : {
    flex: 1,
  } as ViewStyle,
};

/**
 * Width at which a screen is treated as a tablet/desktop rather than a phone.
 *
 * Matches the one breakpoint already in the codebase (AdminDashboardScreen),
 * so there is a single definition of "wide" rather than two that can drift.
 */
export const WIDE_BREAKPOINT = 768;

/** Max content width on wide screens. Matches AdminDashboardScreen's CONTENT_MAX_WIDTH. */
export const CONTENT_MAX_WIDTH = 896;

/**
 * Share of the screen main content may occupy once it is wide enough to need
 * margins. The remaining 10% becomes breathing room, so the layout keeps
 * scaling with the device instead of snapping at a fixed breakpoint.
 */
const CONTENT_WIDTH_RATIO = 0.9;

/**
 * Floor for the computed cap. Every phone is narrower than this, so on a phone
 * the cap can never bind and the layout stays exactly as it was.
 */
const PHONE_SAFE_WIDTH = 430;

/**
 * Content container style that adapts to the current screen width.
 *
 * The cap is computed from the live viewport rather than gated on
 * WIDE_BREAKPOINT. The old gate snapped: below 768pt content was full-bleed and
 * above it jumped straight to 896. That left real tablets stretched edge to edge
 * in portrait — iPad mini is 744pt and 8" Android tablets are ~600dp, both just
 * under the gate — while treating a 1366pt iPad Pro the same as an 820pt iPad.
 *
 *   maxWidth = clamp(width * 0.9, PHONE_SAFE_WIDTH, CONTENT_MAX_WIDTH)
 *
 *   phone   390pt → 430 cap, never binds → full width (unchanged)
 *   tablet  600dp → 540 (was full-bleed)
 *   iPad mini 744 → 670 (was full-bleed)
 *   iPad Air  820 → 738 (was full-bleed)
 *   landscape 1180+ → plateaus at CONTENT_MAX_WIDTH
 *
 * It plateaus rather than growing without bound because past ~900pt extra width
 * costs readability instead of adding it; raise CONTENT_MAX_WIDTH to trade that
 * off differently. Web keeps its own established 672 cap.
 *
 * This is a hook rather than a constant because it reads the live window size:
 * iPad supports all four orientations as of 1.0.10, so the value must change on
 * rotation. A module-level Dimensions.get() would be stale after the first turn.
 */
export const useContentContainerStyle = (): ViewStyle => {
  const { width } = useWindowDimensions();

  if (LAYOUT.isWeb) return LAYOUT.contentContainerStyle;

  return {
    maxWidth: Math.min(
      Math.max(width * CONTENT_WIDTH_RATIO, PHONE_SAFE_WIDTH),
      CONTENT_MAX_WIDTH,
    ),
    width: '100%',
    alignSelf: 'center',
  };
};

/**
 * Login/OTP container style. Same idea as useContentContainerStyle, but capped
 * at the narrower login-card width — 896 would leave a phone-number field
 * stretched absurdly wide.
 *
 * The cap is applied unconditionally rather than above WIDE_BREAKPOINT, because
 * a login card has no reason to grow on any device. Gating it on width >= 768
 * silently missed real tablets that sit just under the breakpoint in portrait —
 * iPad mini is 744pt and 8" Android tablets are ~600dp — so those still rendered
 * an edge-to-edge card. Phones are unaffected either way: they are narrower than
 * 424, so the cap never binds and width:'100%' resolves to the full screen.
 */
export const useLoginContainerStyle = (): ViewStyle => {
  if (LAYOUT.isWeb) return LAYOUT.loginWebStyle;
  return { maxWidth: 424, width: '100%', alignSelf: 'center', flex: 1 };
};

/** True when the current window is tablet-width or wider. */
export const useIsWideScreen = (): boolean =>
  useWindowDimensions().width >= WIDE_BREAKPOINT;
