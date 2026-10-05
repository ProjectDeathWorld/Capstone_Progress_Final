// Voice announcement utility for queue system
let isSpeaking = false

export const announceTicket = (ticketNumber, windowNumber, position, options = {}) => {
  // Check if speech synthesis is supported
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser')
    return false
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel()

  // Set speaking status
  isSpeaking = true

  // Create announcement text
  const positionText = position === 'admission' ? 'Admission' : position === 'itm' ? 'ITM' : position === 'cashier' ? 'Cashier' : 'Registrar'
  const announcementText = `Now serving. ${ticketNumber}. ${positionText} window ${windowNumber}.`

  // Create speech synthesis utterance
  const utterance = new SpeechSynthesisUtterance(announcementText)
  
  // Configure voice settings
  const rates = { slow: 0.75, normal: 0.9, fast: 1.15 }
  utterance.rate = rates[options.speed] || 0.9
  utterance.pitch = 1.0  // Normal pitch
  utterance.volume = Math.max(0, Math.min(1, Number(options.volume ?? 1)))
  utterance.lang = options.language === 'filipino' ? 'fil-PH' : 'en-PH'
  
  // Try to use a female voice if available (common for announcements)
  const voices = window.speechSynthesis.getVoices()
  const femaleVoice = voices.find(voice => 
    voice.name.includes('Female') || 
    voice.name.includes('Samantha') || 
    voice.name.includes('Karen') ||
    voice.name.includes('Google US English Female')
  )
  
  if (femaleVoice) {
    utterance.voice = femaleVoice
  } else if (voices.length > 0) {
    // Fallback to first available voice
    utterance.voice = voices[0]
  }

  // Handle end of speech
  utterance.onend = () => {
    isSpeaking = false
  }

  utterance.onerror = () => {
    isSpeaking = false
    console.error('Speech synthesis error')
  }

  // Speak the announcement
  window.speechSynthesis.speak(utterance)
  return true
}

// Check if currently speaking
export const isCurrentlySpeaking = () => isSpeaking

// Stop any ongoing speech
export const stopSpeaking = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    isSpeaking = false
  }
}

// Test voice function
export const testVoice = () => {
  announceTicket('CS-R-0228-0001', '1', 'cashier')
}

// Initialize voices (some browsers require this)
export const initializeVoices = () => {
  if ('speechSynthesis' in window) {
    // Force voice loading
    window.speechSynthesis.getVoices()
  }
}
