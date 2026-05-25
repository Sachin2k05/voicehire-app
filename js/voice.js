function playBeep(callback) {
  try {
    const ctx  = new (window.AudioContext ||
                      window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.value = 880
    osc.type            = 'sine'

    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001, ctx.currentTime + 0.12
    )

    osc.onended = function() {
      ctx.close()
      // Wait 200ms after beep before mic opens
      setTimeout(callback, 200)
    }

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)

  } catch(e) {
    // No audio context — skip beep, just callback
    console.log('[Beep] Skipped:', e.message)
    setTimeout(callback, 100)
  }
}

const VoiceService = {

  _isSpeaking: false,
  _ttsWatchdog: null,

  speak(text, onDone) {
    this.stopListening() // CRITICAL FIX: stop listening before speaking to prevent self-hearing
    window.speechSynthesis.cancel()
    this._isSpeaking = true

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang  = State.selectedLang
    utter.rate  = SPEECH_RATES[State.selectedLang] || 0.9
    utter.pitch = 1.0

    const voices = speechSynthesis.getVoices()
    
    // First try exact or partial match for selected language
    const langCode = State.selectedLang.split('-')[0]
    let match = voices.find(v => v.lang === State.selectedLang) || 
                voices.find(v => v.lang.startsWith(langCode))
    
    // If exact voice unavailable, fallback to English India
    if (!match) {
      match = voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'))
    }
    
    if (match) {
      utter.voice = match
      utter.lang = match.lang // enforce the actual matched lang
    }

    const done = () => {
      if (!this._isSpeaking) return
      this._isSpeaking = false
      clearInterval(this._ttsWatchdog)
      this._ttsWatchdog = null
      // CRITICAL FIX: delay 2500ms before starting mic to avoid catching TTS echo
      // Chrome blocks recognition if started inside onend callback
      setTimeout(() => {
        if (onDone) onDone()
      }, 2500)
    }

    utter.onend   = done
    utter.onerror = done

    speechSynthesis.speak(utter)

    // CRITICAL FIX: Chrome TTS watchdog
    // Chrome sometimes never fires onend — this detects the freeze
    // and calls done() manually after speech should have ended
    const estimatedDuration = Math.max(3000, text.length * 65)
    this._ttsWatchdog = setInterval(() => {
      if (!speechSynthesis.speaking && this._isSpeaking) {
        done()
      }
    }, 500)
    // Hard timeout as absolute fallback
    setTimeout(() => {
      if (this._isSpeaking) done()
    }, estimatedDuration + 4000)
  },

  stopSpeaking() {
    this._isSpeaking = false
    clearInterval(this._ttsWatchdog)
    window.speechSynthesis.cancel()
  },

  listen(onPartial, onFinal) {
    const SR = window.SpeechRecognition ||
               window.webkitSpeechRecognition

    if (!SR) {
      console.warn('[STT] Not supported')
      setTimeout(function() { onFinal('') }, 100)
      return null
    }

    // Play beep FIRST using separate function
    // Then start mic only after beep completes
    const self = this
    playBeep(function() {
      // Beep done — now start mic
      const rec = new SR()
      rec.lang            = State.selectedLang || 'en-IN'
      rec.continuous      = true
      rec.interimResults  = true
      rec.maxAlternatives = 1

      let finalTranscript = ''
      let callbackFired = false
      let started = false
      let silenceTimer = null

      rec.onstart = function() {
        started = true
        console.log('[STT] Mic started ✓')
      }

      rec.onresult = function(e) {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            finalTranscript += t
          } else {
            interim += t
          }
        }
        if (onPartial) onPartial(interim || finalTranscript)

        // Auto-stop after 1.5s silence when we have text
        if (finalTranscript.length > 0) {
          clearTimeout(silenceTimer)
          silenceTimer = setTimeout(function() {
            try { rec.stop() } catch(e) {}
          }, 1500)
        }
      }

      rec.onend = function() {
        clearTimeout(silenceTimer)
        if (callbackFired) return
        callbackFired = true
        console.log('[STT] Final:', finalTranscript)
        State.recognition = null
        onFinal(finalTranscript)
      }

      rec.onerror = function(e) {
        console.log('[STT] Error:', e.error)
        State.recognition = null
        if (e.error === 'not-allowed') {
          callbackFired = true
          showMicDeniedMessage()
          onFinal('')
        }
        // network errors: let onend handle
      }

      // Hard timeout 25 seconds
      setTimeout(function() {
        if (State.recognition === rec) {
          try { rec.stop() } catch(e) {}
        }
      }, 25000)

      try {
        rec.start()
        State.recognition = rec
      } catch(e) {
        console.error('[STT] Start failed:', e)
        setTimeout(function() { onFinal('') }, 100)
      }
    })

    return null
  },

  stopListening() {
    if (State.recognition) {
      try { State.recognition.stop() } catch(e) {}
      State.recognition = null
    }
  }
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = function() {
    speechSynthesis.getVoices()
  }
}
