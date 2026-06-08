export function urgency(mins) {
  if (mins >= 20) return 'urgent'
  if (mins >= 10) return 'warning'
  return 'normal'
}

export function timerCls(mins) {
  if (mins >= 20) return 't-over'
  if (mins >= 10) return 't-warning'
  return 't-ok'
}

export function fmtTimer(mins) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// Demo base time: 5:55 PM so all sample scheduled times look realistic
const DEMO_NOW_MINS = 17 * 60 + 55

export function getDueIn(schedStr) {
  if (!schedStr) return null
  const m = schedStr.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  const schedMins = h * 60 + min
  const diff = schedMins - DEMO_NOW_MINS
  return diff >= 0 ? diff : diff + 24 * 60
}

export const CATEGORY_ORDER = [
  'entree', 'mains', 'salads', 'pasta', 'pizza', 'burgers',
  'breads', 'biryani', 'desserts', 'drinks', 'cocktails',
  'mocktails', 'coffee', 'sides', 'alcohol',
]

export const CATEGORY_LABELS = {
  entree:    'Entrée',
  mains:     'Mains',
  salads:    'Salads',
  pasta:     'Pasta',
  pizza:     'Pizza',
  burgers:   'Burgers',
  breads:    'Breads',
  biryani:   'Biryani',
  desserts:  'Desserts',
  drinks:    'Drinks',
  cocktails: 'Cocktails',
  mocktails: 'Mocktails',
  coffee:    'Coffee',
  sides:     'Sides',
  alcohol:   'Alcohol',
}

export const SRC_META = {
  'dine-in':      { icon: '🍽', label: 'Dine In' },
  'pos-takeaway': { icon: '🛍', label: 'POS Takeaway' },
  'pos-delivery': { icon: '🛵', label: 'POS Delivery' },
  'web-takeaway': { icon: '🌐', label: 'Web Takeaway' },
  'web-delivery': { icon: '🌐', label: 'Web Delivery' },
  'uber':         { icon: '🟢', label: 'Uber Eats' },
  'ai-order':     { icon: '🤖', label: 'AI Order' },
}
