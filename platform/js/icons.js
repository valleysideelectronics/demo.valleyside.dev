// Inline SVG icon set (hand-drawn paths, 24x24 grid, stroke-based).
const P = {
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
  orders: '<path d="M6 3h12l1 4H5z"/><path d="M5 7h14v12.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5z"/><path d="M9 11h6"/>',
  inventory: '<path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7z"/><path d="M3.5 7 12 11.2 20.5 7"/><path d="M12 11.2v10"/><path d="m7.8 4.9 8.5 4.3"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  quotes: '<path d="M7 2.8h7.5L19 7.3v12.2a1.7 1.7 0 0 1-1.7 1.7H7a1.7 1.7 0 0 1-1.7-1.7V4.5A1.7 1.7 0 0 1 7 2.8z"/><path d="M14 3v4.6h4.6"/><path d="M8.7 12.5h6.6M8.7 16h4.3"/>',
  shop: '<path d="M14.6 6.3a4 4 0 0 0-5.3 5.3L3.8 17a1.9 1.9 0 0 0 2.7 2.7L12 14.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.3-.4-.4-2.3z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  alert: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17h.01"/>',
  dollar: '<path d="M12 3v18"/><path d="M16.5 7.5c-.7-1.4-2.4-2.2-4.5-2.2-2.6 0-4.3 1.3-4.3 3.2 0 4.3 9 2.3 9 6.8 0 2-1.9 3.4-4.7 3.4-2.3 0-4-.9-4.8-2.5"/>',
  wrench: '<path d="M14.6 6.3a4 4 0 0 0-5.3 5.3L3.8 17a1.9 1.9 0 0 0 2.7 2.7L12 14.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.3-.4-.4-2.3z"/>',
  truck: '<path d="M2.5 6h11v10h-11z"/><path d="M13.5 9.5h4l3 3.2V16h-7z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  store: '<path d="M3.5 9.5 5 4h14l1.5 5.5"/><path d="M3.5 9.5a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0"/><path d="M5 12v8.5h14V12"/><path d="M10 20.5v-5h4v5"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  printer: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14h10v6.5H7z"/>',
  receipt: '<path d="M6 2.8h12v18.4l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14 7.5 3 3"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
  phone: '<path d="M5 3.5h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8V19a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 3.4 5.2 1.6 1.6 0 0 1 5 3.5z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.8"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  filter: '<path d="M3.5 5h17l-6.5 7.5V19l-4 2v-8.5z"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10.5h8"/><path d="M4 13.5c.5 4.3 3.7 7.5 8 7.5s7.5-3.2 8-7.5"/>',
  fish: '<path d="M3 12c3-4.5 7-6 10.5-6 3 0 5.5 2.4 7 6-1.5 3.6-4 6-7 6C10 18 6 16.5 3 12z"/><path d="M3 12 1.5 8.5M3 12l-1.5 3.5"/><circle cx="16" cy="10.8" r=".9"/>',
  lifevest: '<path d="M8 3.5h8l3 4v11.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7.5z"/><path d="M10 3.5 12 8l2-4.5M12 8v12.5M5.5 12.5h13M5.5 16.5h13"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  invoice: '<path d="M6 2.8h12v18.4l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  convert: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || P.box;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const brandMark = `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M5 22 12 11l4 6 3-4 8 9z" fill="#f3e6cf"/><path d="M5 25c3-1.6 5-1.6 7.3 0s4.7 1.6 7.4 0 4.7-1.6 7.3 0" fill="none" stroke="#e08a3c" stroke-width="2" stroke-linecap="round"/></svg>`;
