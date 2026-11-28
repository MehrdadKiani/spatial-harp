/**
 * Minimalist 1.5px-stroke inline SVG icon library for Spatial Harp UI.
 * Zero external icon dependencies; crisp and identical across all platforms.
 */

const svg = (paths: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const Icons = {
  lock: (size = 15) =>
    svg(
      `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
      size
    ),
  unlock: (size = 15) =>
    svg(
      `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.4-2"/>`,
      size
    ),
  sliders: (size = 15) =>
    svg(
      `<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2"/>`,
      size
    ),
  settings: (size = 15) =>
    svg(
      `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
      size
    ),
  activity: (size = 15) =>
    svg(`<polyline points="22 12 18 12 15 20 9 4 6 12 2 12"/>`, size),
  trash: (size = 15) =>
    svg(
      `<polyline points="3 6 5 6 21 6"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>`,
      size
    ),
  close: (size = 16) =>
    svg(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, size),
  hand: (size = 15) =>
    svg(
      `<path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7-4l-2.3-4.2a2 2 0 0 1 3.4-2L6 14"/>`,
      size
    ),
  hands: (size = 15) =>
    svg(
      `<path d="M7 11V7a1.5 1.5 0 0 1 3 0v4"/><path d="M4 12V9a1.5 1.5 0 0 1 3 0v3"/><path d="M4 12v3a5 5 0 0 0 5 5h1"/><path d="M17 11V7a1.5 1.5 0 0 0-3 0v4"/><path d="M20 12V9a1.5 1.5 0 0 0-3 0v3"/><path d="M20 12v3a5 5 0 0 1-5 5h-1"/>`,
      size
    ),
  pinch: (size = 18) =>
    svg(
      `<circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="12" r="2.5"/><line x1="9.5" y1="12" x2="14.5" y2="12"/><path d="M7 6v1.5M7 16.5V18M17 6v1.5M17 16.5V18"/>`,
      size
    ),
  pluck: (size = 18) =>
    svg(
      `<path d="M4 18L20 6"/><path d="M8 6c2 2 2 6 0 8"/><path d="M16 10c-2 2-2 6 0 8"/>`,
      size
    ),
  crosshair: (size = 18) =>
    svg(
      `<circle cx="12" cy="12" r="6"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>`,
      size
    ),
  shield: (size = 14) =>
    svg(
      `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>`,
      size
    ),
  volumeOn: (size = 14) =>
    svg(
      `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>`,
      size
    ),
  volumeOff: (size = 14) =>
    svg(
      `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`,
      size
    ),
  reset: (size = 13) =>
    svg(
      `<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/>`,
      size
    ),
  arrowLeft: (size = 14) =>
    svg(`<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>`, size),
  arrowRight: (size = 14) =>
    svg(`<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`, size),
  clock: (size = 16) =>
    svg(`<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>`, size),
  bolt: (size = 14) =>
    svg(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`, size),
  sparkle: (size = 14) =>
    svg(
      `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>`,
      size
    ),
  music: (size = 15) =>
    svg(
      `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
      size
    ),
  fret: (size = 15) =>
    svg(
      `<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>`,
      size
    ),
  book: (size = 15) =>
    svg(
      `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
      size
    ),
  help: (size = 16) =>
    svg(
      `<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8.8c0 1.7-2.3 2.2-2.3 3.7"/><line x1="12" y1="17.5" x2="12.01" y2="17.5"/>`,
      size
    ),
  check: (size = 13) =>
    svg(`<polyline points="20 6 9 17 4 12"/>`, size),
  info: (size = 15) =>
    svg(
      `<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
      size
    ),
  copy: (size = 14) =>
    svg(
      `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
      size
    ),
  mail: (size = 15) =>
    svg(
      `<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>`,
      size
    ),
};
