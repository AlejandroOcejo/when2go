// Design tokens — single source of truth for values that appear in multiple files.
// Tailwind class-based colors (bg-orange-500 etc.) are handled by Tailwind itself;
// these are for raw hex/rgb values used in inline styles and non-Tailwind contexts.

// ── Brand colors ──────────────────────────────────────────────────────────────
export const ORANGE_HEX      = '#f97316' // orange-500
export const ORANGE_DARK_HEX = '#ea580c' // orange-600  (calendar selection outline)
export const ORANGE_RGB      = '249, 115, 22' // orange-500 as RGB components (rgba() use)

// ── Page background (index.html, capacitor.config.json) ──────────────────────
export const BG_LIGHT_HEX = '#f8fafc' // slate-50
export const BG_DARK_HEX  = '#020617' // slate-950

// ── Form field class strings ──────────────────────────────────────────────────
// Standard full-height input (h-12). Use for main form fields.
export const inputCls = [
  'h-12 w-full rounded-xl px-4',
  'bg-slate-100 dark:bg-slate-800/80',
  'border-2 border-transparent',
  'text-slate-900 dark:text-slate-100',
  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
  'outline-none transition-all duration-150',
  'focus:bg-white dark:focus:bg-slate-800',
  'focus:border-orange-400 dark:focus:border-orange-500',
  'focus:shadow-sm',
].join(' ')

// Compact input (h-10). Use for secondary fields (date pickers, selects inside cards).
export const inputSmCls = [
  'h-10 w-full rounded-lg px-3',
  'bg-slate-100 dark:bg-slate-800/80',
  'border-2 border-transparent',
  'text-sm font-medium text-slate-900 dark:text-slate-100',
  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
  'outline-none transition-all duration-150',
  'focus:bg-white dark:focus:bg-slate-800',
  'focus:border-orange-400 dark:focus:border-orange-500',
].join(' ')

// Field label above inputs.
export const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-2'
