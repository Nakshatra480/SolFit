// SolFit "Natural Motion" theme: the app's one source of colors, radii and type weights.
// Screens keep their local `C` (the repo's convention) but point it at NM_COLORS, whose keys are
// the names the screens already used, mapped to Natural Motion roles.

export const NM = {
  bg: '#F4F3EC',          // app background
  card: '#FFFFFF',        // primary card
  surface: '#EAECE4',     // secondary surface
  text: '#26372C',        // primary text
  textSub: '#788477',     // secondary text
  accent: '#52765A',      // forest green: primary actions, active nav, progress
  highlight: '#DDE9C9',   // pale sage: highlights, earned/completed states
  accentSoft: '#9DBA86',  // mid sage, between accent and highlight (loader dots)
  line: '#E0E3DA',        // borders and dividers
  success: '#52765A',
  error: '#C64D48',
  errorBg: '#F6E2E0',     // error tint (derived from error)
  disabled: '#A6ADA2',
  onAccent: '#FFFFFF',    // text and icons on forest green
} as const;

export const RADIUS = { card: 18, button: 14, pill: 100 } as const;

/**
 * Natural Motion under the palette keys the screens already use. `dark` is the deep forest ink
 * (dark surfaces, primary text on light), `amber*` were the accent family and are now forest green
 * and pale sage, and `muted` is readable secondary text (not the disabled tone).
 */
const palette = {
  bg: NM.bg,
  bg2: NM.surface,
  bg3: NM.line,
  card: NM.card,
  dark: NM.text,
  dark2: '#33473A',
  dark3: '#4A5D50',
  amber: NM.accent,
  amber2: NM.accent,
  amber3: NM.highlight,
  amberBg: NM.highlight,
  amberTint: NM.highlight,
  text: NM.text,
  sub: NM.textSub,
  muted: NM.textSub,
  faint: NM.disabled,
  line: NM.line,
  light: NM.surface,
  cell: NM.surface,
  green: NM.success,
  red: NM.error,
  redBg: NM.errorBg,
};

export const NM_COLORS: { readonly [K in keyof typeof palette]: string } = palette;
