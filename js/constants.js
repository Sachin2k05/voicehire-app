const GREETINGS = {
  'en-IN': "Hello! I am VoiceHire, your personal job companion. I am going to help you find the perfect job through our conversation. No typing needed at all. What is your name?",
  'ta-IN': "வணக்கம்! நான் VoiceHire. உங்களுக்கு வேலை தேட உதவ வந்தேன். உங்கள் பெயர் என்ன?",
  'hi-IN': "नमस्ते! मैं VoiceHire हूं। मैं आपको नौकरी ढूंढने में मदद करूंगा। आपका नाम क्या है?",
  'te-IN': "నమస్కారం! నేను VoiceHire. మీకు ఉద్యోగం వెతకడానికి సహాయం చేస్తాను. మీ పేరు ఏమిటి?"
}

const BANNER_TEXT = {
  speaking:  '🔊  AI is speaking — mic activates automatically',
  listening: '🎤  Listening — speak naturally, no rush',
  thinking:  '⚙️  AI is thinking — just a moment',
  searching: '🔍  Searching for jobs matching your profile...',
  recording: '📝  Recording your introduction — speak freely',
  waiting:   '⏸  Waiting for you — take all the time you need',
  sleeping:  '💤  App is sleeping — say anything to wake',
  success:   '✅  Application submitted successfully!'
}

const BANNER_COLORS = {
  speaking:  { bg: 'rgba(255,184,0,0.10)', border: '#FFB800', text: '#FFB800' },
  listening: { bg: 'rgba(255,68,68,0.10)',  border: '#FF4444', text: '#FF4444' },
  thinking:  { bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.2)', text: 'rgba(255,255,255,0.5)' },
  searching: { bg: 'rgba(255,184,0,0.08)', border: '#FFB800', text: '#FFB800' },
  recording: { bg: 'rgba(255,68,68,0.08)',  border: '#FF4444', text: '#FF4444' },
  waiting:   { bg: 'rgba(255,255,255,0.03)',border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.4)' },
  sleeping:  { bg: 'rgba(255,255,255,0.02)',border: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.2)' },
  success:   { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', text: '#4CAF50' }
}

const ORB_ICONS = {
  speaking:  '🔊',
  listening: '🎤',
  thinking:  '···',
  sleeping:  '🌙',
  success:   '✅',
  waiting:   '🎤',
  idle:      '🎤'
}

const PROFILE_FIELDS = [
  'name', 'skills', 'experience', 'location',
  'jobType', 'salary', 'education', 'languages'
]

const SPEECH_RATES = {
  'en-IN': 0.90,
  'ta-IN': 0.85,
  'hi-IN': 0.88,
  'te-IN': 0.87
}
