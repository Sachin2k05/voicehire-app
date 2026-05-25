/* ─────────────────────────────────────────────
   groq.js  —  GroqService  (Phase 7 — dual-return)
   Every call() now returns:
     { response: "...", extracted: { field: value } }
   so app.js can speak the reply AND fill profile
   fields from a single LLM round-trip.
   ───────────────────────────────────────────── */

const LANG_MAP = {
  'en-IN': 'English',
  'ta-IN': 'Tamil',
  'hi-IN': 'Hindi',
  'te-IN': 'Telugu',
  'kn-IN': 'Kannada'
}

const GroqService = {

  buildPrompt() {
    const missing  = getMissingFields()
    const filled   = PROFILE_FIELDS.filter(f => State.profile[f])
    const langName = LANG_MAP[State.selectedLang] || 'English'

    if (missing.length === 0) {
      return `You are VoiceHire AI. Language: ${langName}.
RESPOND ONLY IN ${langName}.
Profile is 100% complete: ${JSON.stringify(State.profile)}
Tell user warmly that profile is complete and
you are now searching for jobs. Max 2 sentences.
RETURN JSON: {"response": "...", "extracted": {}}`
    }

    const nextField      = getNextMissingField()
    State.lastAskedField = nextField

    const fieldLabels = {
      name:       'full name',
      skills:     'main skills or expertise',
      experience: 'years of work experience',
      location:   'preferred city or work location',
      jobType:    'job type — full-time, part-time, or remote',
      salary:     'expected salary in lakhs per year',
      education:  'educational qualification',
      languages:  'languages they speak'
    }

    const collected = filled.length > 0
      ? 'ALREADY COLLECTED — DO NOT ASK AGAIN: ' +
        filled.map(f => f + '=' + State.profile[f]).join(', ')
      : 'Nothing collected yet.'

    const filledCount = filled.length

    return 'You are VoiceHire, a warm friendly human-like ' +
      'AI career companion for visually impaired job seekers in India.\n' +
      'RESPOND ONLY IN ' + langName.toUpperCase() + '.\n\n' +
      collected + '\n' +
      'STILL NEED TO COLLECT: ' + missing.join(', ') + '.\n\n' +
      'CONVERSATION RULES:\n' +
      '1. If the user asks ANY question or makes ANY comment ' +
      '   unrelated to profile collection, answer it warmly ' +
      '   and naturally FIRST like a human friend would.\n' +
      '2. If the user complains or is frustrated, acknowledge ' +
      '   it kindly and explain what you are doing.\n' +
      '3. After answering, gently ask about: ' +
      (fieldLabels[nextField] || nextField) + '.\n' +
      '4. If the user already told you their name or any detail ' +
      '   in this conversation, DO NOT ask for it again.\n' +
      '5. Max 2-3 sentences total. Sound human and warm.\n' +
      '6. NEVER say you cannot answer other questions.\n' +
      '7. If user says their name like "I am Sachin" — ' +
      '   acknowledge it and move to the NEXT missing field.\n\n' +
      'Next field to collect: ' + (fieldLabels[nextField] || nextField) + '\n\n' +
      'YOU MUST RETURN VALID JSON ONLY:\n' +
      '{\n' +
      '  "response": "your warm reply here",\n' +
      '  "extracted": {\n' +
      '    "fieldName": "value"\n' +
      '  }\n' +
      '}\n' +
      'No text outside the JSON. No markdown.'
  },

  async call(userMessage) {
    if (!GROQ_API_KEY ||
        GROQ_API_KEY === 'PASTE_YOUR_GROQ_KEY_HERE') {
      return this.fallback(userMessage)
    }

    const messages = [
      { role: 'system', content: this.buildPrompt() },
      ...State.history.slice(-6),
      { role: 'user', content: userMessage }
    ]

    const controller = new AbortController()
    const timeoutId  = setTimeout(function() {
      controller.abort()
      console.warn('[Groq] Request timed out after 6s')
    }, 6000)

    try {
      const response = await fetch(
        BACKEND_URL + '/api/jobs/ai',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages:     messages.filter(function(m) {
              return m.role !== 'system'
            }),
            systemPrompt: this.buildPrompt()
          })
        }
      )
      clearTimeout(timeoutId)

      const data = await response.json()
      if (!response.ok) {
        console.error('[Groq] API error:', data)
        return this.fallback(messages[messages.length-1].content)
      }

      const raw = data?.choices?.[0]?.message?.content
      if (!raw) return this.fallback('')

      try {
        const parsed = JSON.parse(raw)
        return {
          response:  parsed.response  || raw,
          extracted: parsed.extracted || {}
        }
      } catch(e) {
        return { response: raw.trim(), extracted: {} }
      }

    } catch(err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        console.warn('[Groq] Aborted — using fallback')
      } else {
        console.error('[Groq] Fetch error:', err)
      }
      return this.fallback('')
    }
  },

  async callWithOverride(userMessage, systemOverride) {
    if (!GROQ_API_KEY ||
        GROQ_API_KEY === 'PASTE_YOUR_GROQ_KEY_HERE') {
      return this.fallback(userMessage)
    }

    const systemPrompt = systemOverride || this.buildPrompt()

    const messages = [
      { role: 'system', content: systemPrompt },
      ...State.history.slice(-6),
      { role: 'user', content: userMessage }
    ]

    const controller2 = new AbortController()
    const timeoutId2  = setTimeout(function() {
      controller2.abort()
      console.warn('[Groq] Override request timed out after 6s')
    }, 6000)

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          signal: controller2.signal,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + GROQ_API_KEY
          },
          body: JSON.stringify({
            model:       'llama-3.1-8b-instant',
            messages:    messages,
            max_tokens:  200,
            temperature: 0.7
          })
        }
      )
      clearTimeout(timeoutId2)

      const data = await response.json()
      if (!response.ok) return this.fallback(userMessage)

      const content = data?.choices?.[0]?.message?.content
      if (content && content.trim().length > 0) {
        // Try JSON parse first
        try {
          const parsed = JSON.parse(content)
          return {
            response:  parsed.response || content,
            extracted: parsed.extracted || {}
          }
        } catch (e) {
          return { response: content.trim(), extracted: {} }
        }
      }

      return this.fallback(userMessage)

    } catch(err) {
      clearTimeout(timeoutId2)
      if (err.name === 'AbortError') {
        console.warn('[Groq] Override aborted — using fallback')
      } else {
        console.error('[Groq] Override error:', err)
      }
      return this.fallback(userMessage)
    }
  },

  async detectIntent(userText, context) {
    const key = typeof GROQ_API_KEY !== 'undefined'
      ? GROQ_API_KEY : ''
    if (!key) {
      return { intent: 'QUESTION', confidence: 0 }
    }

    const controller = new AbortController()
    const timeout = setTimeout(
      function() { controller.abort() }, 5000
    )

    try {
      const res = await fetch(
        BACKEND_URL + '/api/jobs/intent',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userText: userText,
            context:  context
          })
        }
      )
      clearTimeout(timeout)

      const data = await res.json()
      return data.intent || { intent: 'OTHER' }

    } catch(err) {
      clearTimeout(timeout)
      console.warn('[Intent] Error:', err.message)
      return { intent: 'QUESTION', reason: 'error' }
    }
  },

  fallback(userMessage) {
    const missing = getMissingFields()

    if (missing.length === 0) {
      return {
        response: 'Perfect! I have everything I need. ' +
                  'Let me search for your best matching jobs!',
        extracted: {}
      }
    }

    const field = getNextMissingField()
    State.lastAskedField = field

    const questions = {
      name:       'What is your full name please?',
      skills:     'What are your main skills or expertise?',
      experience: 'How many years of work experience do you have?',
      location:   'Which city are you looking to work in?',
      jobType:    'Are you looking for full-time, part-time or remote?',
      salary:     'What salary range do you expect in lakhs per year?',
      education:  'What is your highest educational qualification?',
      languages:  'Which languages do you speak?'
    }

    const warm = ['Got it! ', 'Great! ', 'Perfect! ', 'Noted! ']
    const p    = warm[Math.floor(Math.random() * warm.length)]

    return {
      response:  p + (questions[field] || 'Tell me more about yourself.'),
      extracted: {}
    }
  }
}
