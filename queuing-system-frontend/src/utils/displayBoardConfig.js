import { departmentFor, enabledDepartments } from './departments'
const DISPLAY_BOARD_STORAGE_KEY = 'loa-display-board-config'

export const DEFAULT_DISPLAY_PANEL_COLORS = {
  Cashier: { background: '#10264d', text: '#ffffff' },
  Registrar: { background: '#10264d', text: '#ffffff' },
  ITM: { background: '#10264d', text: '#ffffff' },
  Admission: { background: '#10264d', text: '#ffffff' },
}

export const DEFAULT_DISPLAY_BACKGROUND_COLOR = '#071b4d'
export const DEFAULT_ANNOUNCEMENT_BACKGROUND_COLOR = '#f2c64b'
export const DEFAULT_ANNOUNCEMENT_TEXT_COLOR = '#071b4d'
export const DEFAULT_NOW_SERVING_TEXT_COLOR = '#ffffff'
export const DEFAULT_NOW_SERVING_BACKGROUND_COLOR = '#071238'
export const DEFAULT_WINDOW_TICKET_TEXT_COLOR = '#ffffff'
export const DEFAULT_DATE_TIME_TEXT_COLOR = '#ffffff'
export const DEFAULT_WAITING_QUEUE_COLORS = { background: '#071238', text: '#ffffff' }
export const DISPLAY_LAYOUT_OPTIONS = ['classic', 'modern', 'compact', 'wide', 'minimal']
export const DISPLAY_FONT_OPTIONS = {
  poppins: { label: 'Poppins', family: "'Poppins', sans-serif" },
  arial: { label: 'Arial', family: 'Arial, sans-serif' },
  georgia: { label: 'Georgia', family: 'Georgia, serif' },
  inter: { label: 'Inter', family: "'Inter', sans-serif" },
  roboto: { label: 'Roboto', family: "'Roboto', 'Segoe UI', sans-serif" },
  trebuchet: { label: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
  system: { label: 'System Default', family: 'system-ui, -apple-system, sans-serif' },
}
export const DISPLAY_TEXT_SIZE_OPTIONS = {
  small: { label: 'Small', scale: '90%' },
  medium: { label: 'Medium', scale: '100%' },
  large: { label: 'Large', scale: '110%' },
}

export const ELEMENT_FONT_SIZE_OPTIONS = {
  small: { label: 'Small', scale: 0.85 },
  medium: { label: 'Medium', scale: 1.0 },
  large: { label: 'Large', scale: 1.15 },
  xlarge: { label: 'Extra Large', scale: 1.3 },
}

export const ELEMENT_FONT_WEIGHT_OPTIONS = {
  400: { label: 'Regular (400)', value: '400' },
  500: { label: 'Medium (500)', value: '500' },
  600: { label: 'Semi-Bold (600)', value: '600' },
  700: { label: 'Bold (700)', value: '700' },
  800: { label: 'Extra Bold (800)', value: '800' },
  900: { label: 'Black (900)', value: '900' },
}

export const DISPLAY_FONT_ELEMENTS = [
  { key: 'nowServing', label: '“NOW SERVING” Heading' },
  { key: 'waitingQueue', label: '“WAITING QUEUE” Heading' },
  { key: 'serviceNames', label: 'Service Names (Cashier, Registrar, ITM, Admission)' },
  { key: 'windowLabels', label: 'Window Number Labels' },
  { key: 'ticketNumbers', label: 'Ticket Numbers' },
  { key: 'waitingQueueTickets', label: 'Waiting Queue Text & Ticket Numbers' },
]

export const DEFAULT_DISPLAY_FONT_CONTROLS = {
  nowServing: { fontFamily: 'poppins', fontSize: 'large', fontWeight: '900' },
  waitingQueue: { fontFamily: 'poppins', fontSize: 'medium', fontWeight: '900' },
  serviceNames: { fontFamily: 'poppins', fontSize: 'medium', fontWeight: '700' },
  windowLabels: { fontFamily: 'poppins', fontSize: 'large', fontWeight: '800' },
  ticketNumbers: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '900' },
  waitingQueueTickets: { fontFamily: 'poppins', fontSize: 'medium', fontWeight: '700' },
}

export const DEFAULT_DISPLAY_TEXT_LABELS = {
  nowServing: 'NOW SERVING',
  window: 'WINDOW',
  waitingQueue: 'WAITING QUEUE',
  waiting: 'waiting',
  waitingTicket: 'waiting ticket',
  waitingTickets: 'waiting tickets',
  noWaitingTickets: 'No waiting tickets',
  moreTemplate: '+{count} more',
  live: 'LIVE',
  departmentNames: {
    Cashier: 'Cashier',
    Registrar: 'Registrar',
    ITM: 'ITM',
    Admission: 'Assessment',
  },
  windowLabels: {},
}

const createDefaultWindows = () => [
  ...[1, 2, 3].map((number) => ({ id: `window-${number}`, windowNumber: number, displayName: `Cashier Window ${number}`, department: 'Cashier', color: '#2563eb', visible: true, order: number, staffName: '' })),
  ...[9, 10, 11, 12, 13].map((number, index) => ({ id: `window-${number}`, windowNumber: number, displayName: `Registrar Window ${number}`, department: 'Registrar', color: '#10b981', visible: true, order: index + 4, staffName: '' })),
  ...[1, 2, 3].map((number, index) => ({ id: `itm-window-${number}`, windowNumber: number, displayName: `ITM Window ${number}`, department: 'ITM', color: '#0284c7', visible: true, order: index + 9, staffName: '' })),
]

const createDefaultSettings = () => ({
  enabledDepartments: ['Cashier', 'Registrar'],
  theme: 'dark',
  layout: 'modern',
  displayFontFamily: 'poppins',
  displayTextSize: 'medium',
  waitingLimit: 6,
  waitingFontSize: 'medium',
  showWaitingQueue: true,
  showClock: true,
  showDate: true,
  showLiveIndicator: true,
  queuePosition: 'right',
  flashEnabled: true,
  flashSpeed: 'medium',
  animation: 'pulse',
  voiceEnabled: true,
  voiceLanguage: 'english',
  voiceSpeed: 'normal',
  voiceVolume: 0.75,
  announcementEnabled: true,
  announcement: '📢 Welcome to Lyceum of Alabang. Please prepare your Student ID before proceeding to your assigned window.',
  announcementSpeed: 'medium',
  displayLabels: DEFAULT_DISPLAY_TEXT_LABELS,
  schoolName: 'Lyceum of Alabang',
  subtitle: 'Queue Management System',
  accentColor: DEFAULT_ANNOUNCEMENT_BACKGROUND_COLOR,
  announcementTextColor: DEFAULT_ANNOUNCEMENT_TEXT_COLOR,
  nowServingTextColor: DEFAULT_NOW_SERVING_TEXT_COLOR,
  nowServingBackgroundColor: DEFAULT_NOW_SERVING_BACKGROUND_COLOR,
  windowTicketTextColor: DEFAULT_WINDOW_TICKET_TEXT_COLOR,
  dateTimeTextColor: DEFAULT_DATE_TIME_TEXT_COLOR,
  waitingQueueColors: DEFAULT_WAITING_QUEUE_COLORS,
  backgroundType: 'solid',
  backgroundColor: DEFAULT_DISPLAY_BACKGROUND_COLOR,
  panelColors: DEFAULT_DISPLAY_PANEL_COLORS,
  backgroundGradient: 'linear-gradient(135deg, rgba(7,27,77,0.95), rgba(14,52,105,0.82))',
  backgroundImage: '',
  logoImage: '',
  fontControls: { ...DEFAULT_DISPLAY_FONT_CONTROLS },
  completedCount: 184,
  cancelledCount: 9,
})

export const getDefaultDisplayBoardConfig = () => ({
  windows: createDefaultWindows(),
  settings: createDefaultSettings(),
})

export const getDisplayWindowOptions = (config) => {
  const active = enabledDepartments(config?.settings)
  const windows = [
    ...[1, 2, 3].map(windowNumber => ({ department: 'Cashier', windowNumber })),
    ...[9, 10, 11, 12, 13].map(windowNumber => ({ department: 'Registrar', windowNumber })),
  ].filter(window => active.includes(window.department))

  for (const department of ['Admission', 'ITM']) {
    if (!active.includes(department)) continue
    const configuredDepartmentWindows = (config?.windows || [])
      .filter(window => departmentFor(window.department)?.name === department)
    const visibleWindowNumbers = new Set(configuredDepartmentWindows
      .filter(window => window.visible !== false
        && Number.isInteger(Number(window.windowNumber))
        && Number(window.windowNumber) > 0)
      .map(window => Number(window.windowNumber)))
    const windowNumbers = configuredDepartmentWindows.length === 0
      ? (department === 'ITM' ? [1, 2, 3] : [1])
      : [...new Set([
        ...(department === 'ITM' ? [1, 2, 3].filter(number =>
          !configuredDepartmentWindows.some(window => Number(window.windowNumber) === number) || visibleWindowNumbers.has(number)) : []),
        ...visibleWindowNumbers,
      ])]
    windows.push(...windowNumbers.map(windowNumber => ({ department, windowNumber })))
  }

  return windows
}

export const formatDisplayDate = (date, includeWeekday = true) => (
  new Intl.DateTimeFormat('en-PH', {
    ...(includeWeekday ? { weekday: 'long' } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
)

export const formatMoreLabel = (template, count) => (
  template.includes('{count}') ? template.replace('{count}', String(count)) : `+${count} more`
)

export const getDisplayBoardConfig = () => {
  if (typeof window === 'undefined') {
    return getDefaultDisplayBoardConfig()
  }

  try {
    const raw = window.localStorage.getItem(DISPLAY_BOARD_STORAGE_KEY)
    if (!raw) {
      return getDefaultDisplayBoardConfig()
    }

    const parsed = JSON.parse(raw)
    return normalizeDisplayBoardConfig(parsed)
  } catch (error) {
    console.error('Unable to load display board config', error)
    return getDefaultDisplayBoardConfig()
  }
}

export const saveDisplayBoardConfig = (config) => {
  if (typeof window === 'undefined') {
    return getDefaultDisplayBoardConfig()
  }

  const normalized = normalizeDisplayBoardConfig(config)
  window.localStorage.setItem(DISPLAY_BOARD_STORAGE_KEY, JSON.stringify(normalized))
  try {
    window.dispatchEvent(new Event('display-board-config-updated'))
  } catch (err) {
    console.error('Failed to dispatch config update event', err)
  }
  return normalized
}

export const resetDisplayBoardConfig = () => {
  const config = getDefaultDisplayBoardConfig()
  saveDisplayBoardConfig(config)
  return config
}

export const getWindowServiceType = (windowConfig) => {
  if (!windowConfig || !windowConfig.department) {
    return 'C'
  }

  return departmentFor(windowConfig.department)?.storedType || 'C'
}

function normalizeDisplayBoardConfig(config) {
  const defaults = getDefaultDisplayBoardConfig()
  const windows = Array.isArray(config?.windows) && config.windows.length > 0
    ? config.windows.map((window, index) => ({
        id: window?.id || `window-${index + 1}`,
        windowNumber: Number(window?.windowNumber ?? index + 1),
        displayName: typeof window?.displayName === 'string' && window.displayName !== '' ? window.displayName : (defaults.windows[index % defaults.windows.length]?.displayName || `Window ${index + 1}`),
        department: window?.department || (defaults.windows[index % defaults.windows.length]?.department || 'Cashier'),
        color: window?.color || (defaults.windows[index % defaults.windows.length]?.color || '#2563eb'),
        staffName: typeof window?.staffName === 'string' ? window.staffName : '',
        visible: typeof window?.visible === 'boolean' ? window.visible : true,
        order: Number(window?.order ?? index + 1),
      }))
    : defaults.windows.map((window, index) => ({ ...window, id: window.id || `window-${index + 1}` }))

  const settings = {
    ...defaults.settings,
    ...(config?.settings || {}),
    displayLabels: normalizeDisplayTextLabels(config?.settings?.displayLabels),
    theme: config?.settings?.theme === 'light' ? 'light' : defaults.settings.theme,
    layout: DISPLAY_LAYOUT_OPTIONS.includes(config?.settings?.layout)
      ? config.settings.layout
      : defaults.settings.layout,
    displayFontFamily: Object.hasOwn(DISPLAY_FONT_OPTIONS, config?.settings?.displayFontFamily)
      ? config.settings.displayFontFamily
      : defaults.settings.displayFontFamily,
    displayTextSize: Object.hasOwn(DISPLAY_TEXT_SIZE_OPTIONS, config?.settings?.displayTextSize)
      ? config.settings.displayTextSize
      : defaults.settings.displayTextSize,
    waitingFontSize: ['small', 'medium', 'large', 'xlarge'].includes(config?.settings?.fontControls?.waitingQueueTickets?.fontSize || config?.settings?.waitingFontSize)
      ? (config?.settings?.fontControls?.waitingQueueTickets?.fontSize || config?.settings?.waitingFontSize)
      : defaults.settings.waitingFontSize,
    backgroundType: ['solid', 'gradient', 'image'].includes(config?.settings?.backgroundType)
      ? config.settings.backgroundType
      : defaults.settings.backgroundType,
    animation: ['pulse', 'fade', 'zoom'].includes(config?.settings?.animation)
      ? config.settings.animation
      : defaults.settings.animation,
    backgroundColor: normalizeHexColor(config?.settings?.backgroundColor, defaults.settings.backgroundColor),
    accentColor: normalizeHexColor(config?.settings?.accentColor, defaults.settings.accentColor),
    announcementTextColor: normalizeHexColor(config?.settings?.announcementTextColor, defaults.settings.announcementTextColor),
    nowServingTextColor: normalizeHexColor(config?.settings?.nowServingTextColor, defaults.settings.nowServingTextColor),
    nowServingBackgroundColor: normalizeHexColor(config?.settings?.nowServingBackgroundColor, defaults.settings.nowServingBackgroundColor),
    windowTicketTextColor: normalizeHexColor(config?.settings?.windowTicketTextColor, defaults.settings.windowTicketTextColor),
    dateTimeTextColor: normalizeHexColor(config?.settings?.dateTimeTextColor, defaults.settings.dateTimeTextColor),
    waitingQueueColors: {
      background: normalizeHexColor(config?.settings?.waitingQueueColors?.background, defaults.settings.waitingQueueColors.background),
      text: normalizeHexColor(config?.settings?.waitingQueueColors?.text, defaults.settings.waitingQueueColors.text),
    },
    panelColors: Object.fromEntries(Object.entries(DEFAULT_DISPLAY_PANEL_COLORS).map(([department, colors]) => {
      const configuredColors = config?.settings?.panelColors?.[department]
      return [department, {
        background: normalizeHexColor(configuredColors?.background, colors.background),
        text: normalizeHexColor(configuredColors?.text, colors.text),
      }]
    })),
    fontControls: Object.fromEntries(
      DISPLAY_FONT_ELEMENTS.map(({ key }) => {
        const source = (config?.settings?.fontControls || config?.settings?.displayFonts || {})[key] || {}
        return [key, {
          fontFamily: Object.hasOwn(DISPLAY_FONT_OPTIONS, source.fontFamily)
            ? source.fontFamily
            : (DEFAULT_DISPLAY_FONT_CONTROLS[key]?.fontFamily || 'poppins'),
          fontSize: Object.hasOwn(ELEMENT_FONT_SIZE_OPTIONS, source.fontSize)
            ? source.fontSize
            : (DEFAULT_DISPLAY_FONT_CONTROLS[key]?.fontSize || 'medium'),
          fontWeight: Object.hasOwn(ELEMENT_FONT_WEIGHT_OPTIONS, String(source.fontWeight))
            ? String(source.fontWeight)
            : (DEFAULT_DISPLAY_FONT_CONTROLS[key]?.fontWeight || '700'),
        }]
      })
    ),
  }

  function normalizeDisplayTextLabels(labels) {
    const defaults = DEFAULT_DISPLAY_TEXT_LABELS
    const source = labels || {}
    const stringKeys = [
      'nowServing',
      'window',
      'waitingQueue',
      'waiting',
      'waitingTicket',
      'waitingTickets',
      'noWaitingTickets',
      'live',
    ]
    const normalized = Object.fromEntries(stringKeys.map(key => [
      key,
      typeof source[key] === 'string' ? source[key] : defaults[key],
    ]))
    const moreTemplate = typeof source.moreTemplate === 'string' && source.moreTemplate.includes('{count}')
      ? source.moreTemplate
      : defaults.moreTemplate

    return {
      ...normalized,
      moreTemplate,
      departmentNames: Object.fromEntries(Object.entries(defaults.departmentNames).map(([department, name]) => [
        department,
        typeof source.departmentNames?.[department] === 'string' ? source.departmentNames[department] : name,
      ])),
      windowLabels: Object.fromEntries(Object.entries(source.windowLabels || {}).filter(([, label]) => typeof label === 'string')),
    }
  }

  delete settings.itmMode
  delete settings.systemMode
  return {
    windows: windows.sort((a, b) => a.order - b.order),
    settings,
  }
}

export const getColorContrastRatio = (foreground, background) => {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function normalizeHexColor(value, fallback) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback
}

function relativeLuminance(color) {
  const normalized = normalizeHexColor(color, '#000000').slice(1)
  const channels = [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels.map(channel => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4)
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
}
