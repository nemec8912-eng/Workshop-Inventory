import type { SVGProps } from 'react';

const shapes = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/></>,
  drill: <><path d="M4 6h11l4 4-3 3h-4v7H8v-7H4z"/><path d="M8 6V3m4 3V3m7 7h3M9 13h5"/></>,
  box: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 5 9-5M12 12v9"/></>,
  boxes: <><path d="M3 6 8 3l5 3v6l-5 3-5-3zM8 9v6M3 6l5 3 5-3"/><path d="m12 12 4-2 5 2v6l-5 3-5-3v-6M16 15v6m-4-9 4 3 5-3"/></>,
  shelves: <><path d="M3 4h18v17H3zM3 10h18M3 16h18M8 4v6m6 0v6m4 0v5"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M6 6h1m10 0h1M6 17h1m7-3h3m-3 4h3m4-4v3m-3 4h3v-3"/></>,
  chart: <><path d="M4 20h16M6 16v-6m6 6V4m6 12v-9"/></>,
  settings: <><path d="M10 3h4l1 2.5 2 1 2.5-1 2 3.5-2 2v2l2 2-2 3.5-2.5-1-2 1L14 21h-4l-1-2.5-2-1-2.5 1L2 15l2-2v-2L2 9l2.5-3.5 2.5 1 2-1z"/><circle cx="12" cy="12" r="3"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  right: <path d="m9 18 6-6-6-6"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  scan: <path d="M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4m6 0h4a1 1 0 0 0 1-1v-4M4 12h16"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  wrench: <path d="M21 7a6 6 0 0 1-8 6L6 20a2 2 0 0 1-3-3l7-7a6 6 0 0 1 7-8l-4 4 4 4z"/>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></>,
  battery: <><rect x="3" y="7" width="17" height="11" rx="2"/><path d="M20 11h2v3h-2M8 10v5m-2-2.5h4"/></>,
  ruler: <><rect x="4" y="8" width="16" height="8" rx="1" transform="rotate(-25 12 12)"/><path d="m9 10 1 2m3-4 1 2m3-4 1 2"/></>,
  bolt: <path d="m10 3-7 10h7l-1 8 12-13h-8l1-5z"/>,
  printer: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v7H6z"/></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>,
  upload: <path d="M12 21V9m-5 5 5-5 5 5M4 7V3h16v4"/>,
  folder: <path d="M3 6h7l2 2h9v12H3z"/>,
  spark: <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>,
  list: <path d="M9 6h12M9 12h12M9 18h12M3 6h2M3 12h2M3 18h2"/>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  trash: <path d="M4 6h16m-14 0 1 15h10l1-15M9 6V3h6v3M10 10v7m4-7v7"/>,
  edit: <><path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  shield: <><path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/></>,
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof shapes;
export default function Icon({ name, size = 22, ...props }: {name: IconName; size?: number} & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>;
}
