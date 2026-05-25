/* ─────────────────────────────────────────────
   app.js — VoiceHire — Complete Clean Version
───────────────────────────────────────────── */

/* ══ GUARD FLAGS ══ */
let _isSpeakingGuard    = false
let _wakeListenerActive = false
let _applicationInProgress = false
let _submittedJobs = new Set()
let _thinkingWatchdog   = null

/* ══════════════════════════════════════════════
   THINKING WATCHDOG
══════════════════════════════════════════════ */
function startThinkingWatchdog() {
  clearThinkingWatchdog()
  _thinkingWatchdog = setTimeout(function() {
    if (State.appState === 'thinking') {
      console.warn('[Watchdog] Stuck — recovering')
      removeTypingIndicator()
      _isSpeakingGuard = false
      voiceLoop('Sorry, I had a small issue. Could you say that again?')
    }
  }, 8000)
}

function clearThinkingWatchdog() {
  if (_thinkingWatchdog) {
    clearTimeout(_thinkingWatchdog)
    _thinkingWatchdog = null
  }
}

/* ══════════════════════════════════════════════
   TAP TO START
══════════════════════════════════════════════ */
function dismissStartOverlay() {
  console.log('[Start] Tap detected')
  const overlay = document.getElementById('start-overlay')
  if (!overlay) return

  overlay.style.transition    = 'opacity 0.5s ease'
  overlay.style.opacity       = '0'
  overlay.style.pointerEvents = 'none'

  setTimeout(function() {
    overlay.style.display = 'none'
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.getVoices()
    }
    showLanguageScreen()
    setTimeout(function() {
      startVoiceLanguageSelection()
    }, 800)
  }, 500)
}

/* ══════════════════════════════════════════════
   VOICE LANGUAGE SELECTION
══════════════════════════════════════════════ */
function startVoiceLanguageSelection() {
  if (State._voiceLangStarted) return
  if (typeof speechSynthesis === 'undefined') return

  speechSynthesis.getVoices()

  const prompt =
    'Welcome to VoiceHire! ' +
    'Please say your language. ' +
    'Say English, Hindi, Tamil, or Telugu.'

  const hint = document.getElementById('lang-hint-live')
  if (hint) hint.textContent = '🔊 Listening for your language...'

  VoiceService.speak(prompt, function() {
    listenForLanguage(0)
  })
}

function listenForLanguage(attempt) {
  if (attempt >= 3) {
    selectLanguage('en-IN')
    return
  }
  const saved = State.selectedLang
  State.selectedLang = 'en-IN'

  VoiceService.listen(
    function(partial) {
      const hint = document.getElementById('lang-hint-live')
      if (hint) hint.textContent = '🎤 Heard: ' + partial
    },
    function(final) {
      State.selectedLang = saved
      const t = (final || '').toLowerCase()

      if (t.includes('english') || t.includes('eng')) {
        selectLanguage('en-IN')
      } else if (t.includes('hindi')) {
        selectLanguage('hi-IN')
      } else if (t.includes('tamil')) {
        selectLanguage('ta-IN')
      } else if (t.includes('telugu')) {
        selectLanguage('te-IN')
      } else {
        const retry = attempt === 0
          ? 'Please say English, Hindi, Tamil, or Telugu.'
          : 'Say your language name clearly.'
        VoiceService.speak(retry, function() {
          listenForLanguage(attempt + 1)
        })
      }
    }
  )
}

/* ══════════════════════════════════════════════
   SELECT LANGUAGE
══════════════════════════════════════════════ */
function selectLanguage(langCode) {
  State.selectedLang      = langCode
  State._voiceLangStarted = true

  VoiceService.stopSpeaking()
  VoiceService.stopListening()

  applyTranslations()

  const langScreen = document.getElementById('language-screen')
  if (langScreen) langScreen.classList.add('fade-out')

  setTimeout(function() {
    showMainApp()
    // Register user with backend and load saved profile
    const _userName = State.profile.name || null
    BackendService.registerOrLogin(
      'user-' + Date.now(),
      _userName
    ).then(function(result) {
      console.log('[Backend] Auth result:', result)
      if (result.isReturning && result.profile) {
        if (result.profile.name)
          updateProfileField('name', result.profile.name)
        if (result.profile.skills)
          updateProfileField('skills', result.profile.skills)
        if (result.profile.experience)
          updateProfileField('experience', result.profile.experience)
        if (result.profile.location)
          updateProfileField('location', result.profile.location)
        if (result.profile.job_type)
          updateProfileField('jobType', result.profile.job_type)
        if (result.profile.salary)
          updateProfileField('salary', result.profile.salary)
        if (result.profile.education)
          updateProfileField('education', result.profile.education)
        if (result.profile.languages)
          updateProfileField('languages', result.profile.languages)
      }
    })

    State.loopRunning   = true
    State.silenceCount  = 0
    State.history       = []
    State._afterApply   = false
    State.jobIndex      = 0
    State.jobs          = []
    State.jobSearchDone = false
    _submittedJobs = new Set()
    _applicationInProgress = false

    const name = State.profile.name
      ? State.profile.name.split(' ')[0]
      : ''
    const greeting = name
      ? 'Hello ' + name + '! Welcome back to VoiceHire. ' +
        'Let us continue where we left off.'
      : GREETINGS[langCode] || GREETINGS['en-IN']

    voiceLoop(greeting)
  }, 500)
}

/* ══════════════════════════════════════════════
   VOICE LOOP — Core speak → listen cycle
══════════════════════════════════════════════ */
function voiceLoop(aiText) {
  if (!State.loopRunning) return

  if (_isSpeakingGuard) {
    console.log('[VoiceLoop] Guard active — skipping')
    return
  }

  _isSpeakingGuard = true
  State.lastAIText  = aiText

  setAppState('speaking')
  updateCaptionStrip('ai', aiText)
  addBubble('ai', aiText)
  BackendService.saveMessage('assistant', aiText)

  VoiceService.speak(aiText, function() {
    _isSpeakingGuard = false
    if (!State.loopRunning) return
    setTimeout(startListening, 500)
  })
}

/* ══════════════════════════════════════════════
   START LISTENING — Single clean listen cycle
══════════════════════════════════════════════ */
function startListening() {
  if (!State.loopRunning) return
  if (State.appState === 'listening') return

  setAppState('listening')
  updateCaptionStrip('user', '')

  VoiceService.listen(
    function(partial) {
      updateCaptionStrip('user', partial)
    },
    function(userText) {
      if (!State.loopRunning) return

      if (!userText || userText.trim().length < 2) {
        State.silenceCount++
        console.log('[Silence]', State.silenceCount)

        if (State.silenceCount >= 5) {
          enterSleepMode()
          return
        }

        const msgs = [
          'Take your time. I am still listening.',
          'No rush. Speak whenever you are ready.',
          'I am still here waiting for you.',
          'Just speak when you are ready.'
        ]
        const msg = msgs[Math.min(State.silenceCount - 1, 3)]

        _isSpeakingGuard = true
        setAppState('speaking')
        addBubble('ai', msg)
        updateCaptionStrip('ai', msg)

        VoiceService.speak(msg, function() {
          _isSpeakingGuard = false
          if (!State.loopRunning) return
          setTimeout(startListening, 2000)
        })
        return
      }

      State.silenceCount = 0
      processUserInput(userText)
    }
  )
}

/* ══════════════════════════════════════════════
   PROCESS USER INPUT — Smart router
══════════════════════════════════════════════ */
async function processUserInput(userText) {
  if (!userText || userText.trim().length < 2) return

  addBubble('user', userText)
  BackendService.saveMessage('user', userText)
  State.history.push({ role: 'user', content: userText })
  await Extractor.run(userText)

  if (State.jobSearchDone && State.jobs.length > 0) {
    handleJobPhaseInput(userText)
  } else if (getMissingFields().length === 0) {
    if (!State.jobSearchDone) {
      State.jobSearchDone = true
      setTimeout(startJobSearch, 500)
    } else {
      handleFreeQuestion(userText)
    }
  } else {
    handleProfilePhaseInput(userText)
  }
}

/* ══════════════════════════════════════════════
   PROFILE PHASE — Collecting 8 fields
══════════════════════════════════════════════ */
function handleProfilePhaseInput(userText) {
  setAppState('thinking')
  startThinkingWatchdog()
  showTypingIndicator()

  GroqService.call(userText)
    .then(function(result) {
      clearThinkingWatchdog()
      removeTypingIndicator()

      const reply = typeof result === 'string'
        ? result : (result.response || result)

      if (result && result.extracted &&
          typeof result.extracted === 'object') {
        Object.entries(result.extracted)
          .forEach(function([key, value]) {
            if (value && PROFILE_FIELDS.includes(key)) {
              updateProfileField(key, String(value))
            }
          })
        BackendService.saveProfile(State.profile)
      }

      State.history.push({ role: 'assistant', content: reply })

      if (State.history.length > 20) {
        State.history = State.history.slice(-20)
      }

      const missing = getMissingFields()
      console.log('[Profile] Missing:', missing)

      if (missing.length === 0 && !State.jobSearchDone) {
        State.jobSearchDone = true

        const name = State.profile.name
          ? State.profile.name.split(' ')[0]
          : 'there'

        const searchMsg =
          'Wonderful ' + name + '! ' +
          'I now have all your details. ' +
          'Let me search for your perfect job ' +
          'right now. This will take just a moment. ' +
          'I am looking for the best matches ' +
          'for your skills and preferences!'

        addBubble('ai', searchMsg)
        updateCaptionStrip('ai', searchMsg)
        _isSpeakingGuard = true

        VoiceService.speak(searchMsg, function() {
          _isSpeakingGuard = false
          setAppState('searching')
          setTimeout(startJobSearch, 500)
        })
        return
      } else {
        voiceLoop(reply)
      }
    })
    .catch(function() {
      clearThinkingWatchdog()
      removeTypingIndicator()
      voiceLoop('Could you say that again please?')
    })
}

/* ══════════════════════════════════════════════
   JOB PHASE — AI intent detection
══════════════════════════════════════════════ */
async function handleJobPhaseInput(userText) {
  // Safety: reset stuck application flag
  // so new apply attempts always work
  if (_applicationInProgress) {
    console.log('[JobPhase] Resetting stuck flag')
    _applicationInProgress = false
  }

  console.log('[JobPhase] Input:', userText)

  const job = State.jobs[State.jobIndex || 0]
  const jobContext = job
    ? 'User is deciding about: ' + job.title +
      ' at ' + job.company +
      ', salary ' + job.salary +
      ', ' + job.match + '% match.'
    : 'User is in job search phase.'

  setAppState('thinking')

  const intentResult = await GroqService.detectIntent(
    userText, jobContext
  )
  const intent = (intentResult.intent || 'OTHER').toUpperCase()
  console.log('[Intent]', intent, '—', intentResult.reason)

  switch(intent) {
    case 'APPLY':
      if (State._afterApply) {
        // After apply — APPLY intent also means
        // "go to next" since job was already applied
        State._afterApply = false
        const nextIdxA = (State.jobIndex || 0) + 1
        if (nextIdxA < State.jobs.length) {
          State.jobIndex = nextIdxA
          readJobAtIndex(nextIdxA)
        } else {
          voiceLoop(
            'You have seen all ' +
            State.jobs.length +
            ' matching jobs. Great work today!'
          )
        }
      } else {
        if (job) {
          startApplication(job)
        } else {
          readJobAtIndex(State.jobIndex || 0)
        }
      }
      break

    case 'SKIP':
      if (State._afterApply) {
        State._afterApply = false
        const nextIdx = (State.jobIndex || 0) + 1
        if (nextIdx < State.jobs.length) {
          State.jobIndex = nextIdx
          readJobAtIndex(nextIdx)
        } else {
          voiceLoop(
            'You have seen all ' +
            State.jobs.length +
            ' matching jobs. Great work today!'
          )
        }
      } else {
        const nextIdx2 = (State.jobIndex || 0) + 1
        if (nextIdx2 < State.jobs.length) {
          State.jobIndex = nextIdx2
          readJobAtIndex(nextIdx2)
        } else {
          voiceLoop(
            'That was the last matching job!'
          )
        }
      }
      break

    case 'MORE_INFO':
      if (job) {
        const detail =
          'More about ' + job.title +
          ' at ' + job.company + '. ' +
          (job.description
            ? job.description.slice(0, 200) + '. '
            : '') +
          'Salary is ' + job.salary + '. ' +
          'This is a ' + job.match +
          ' percent match. Shall I apply?'
        voiceLoopWithJobResponse(detail, job)
      }
      break

    case 'QUESTION':
    case 'GREETING':
    case 'CORRECTION':
      handleFreeQuestion(userText)
      break

    case 'OTHER':
    default:
      if (State._afterApply) {
        // Check if user wants to stop
        const t2 = userText.toLowerCase()
        if (t2.includes('no') ||
            t2.includes('done') ||
            t2.includes('stop') ||
            t2.includes('enough') ||
            t2.includes('finish') ||
            t2.includes('later') ||
            t2.includes('that') ||
            t2.length < 4) {
          State._afterApply = false
          voiceLoop(
            'Great work today! I will alert you ' +
            'when companies respond. Take care!'
          )
        } else {
          // Anything else — go to next job
          State._afterApply = false
          const nextIdx3 = (State.jobIndex || 0) + 1
          if (nextIdx3 < State.jobs.length) {
            State.jobIndex = nextIdx3
            readJobAtIndex(nextIdx3)
          } else {
            voiceLoop('Those are all the jobs!')
          }
        }
      } else {
        handleFreeQuestion(userText)
      }
      break
  }
}

/* ══════════════════════════════════════════════
   FREE QUESTION — Answer anything naturally
══════════════════════════════════════════════ */
function handleFreeQuestion(userText) {
  setAppState('thinking')
  showTypingIndicator()
  startThinkingWatchdog()

  const job    = State.jobs && State.jobs[State.jobIndex || 0]
  const prompt =
    'You are VoiceHire, a warm helpful AI career companion. ' +
    'User profile: ' + JSON.stringify(State.profile) + '. ' +
    (job
      ? 'Current job: ' + job.title + ' at ' + job.company +
        ' salary ' + job.salary + ' match ' + job.match + '%. '
      : '') +
    'Answer naturally like a caring friend. ' +
    'If asked if job suits them, compare skills honestly. ' +
    'If asked about salary the company offers, mention job salary. ' +
    'Max 3 sentences. Warm and helpful.'

  GroqService.callWithOverride(userText, prompt)
    .then(function(result) {
      clearThinkingWatchdog()
      removeTypingIndicator()
      const reply = typeof result === 'string'
        ? result : (result.response || result)
      State.history.push({ role: 'assistant', content: reply })

      if (job && State.jobSearchDone) {
        voiceLoopWithJobResponse(reply, job)
      } else {
        voiceLoop(reply)
      }
    })
    .catch(function() {
      clearThinkingWatchdog()
      removeTypingIndicator()
      voiceLoop('Sorry, could you say that again?')
    })
}

/* ══════════════════════════════════════════════
   JOB SEARCH
══════════════════════════════════════════════ */
async function startJobSearch() {
  State.loopRunning = false
  setAppState('searching')
  showJobsPanel([])

  try {
    const jobs = await JobService.search()
    State.jobs     = jobs
    State.jobIndex = 0

    if (!jobs || jobs.length === 0) {
      State.loopRunning = true
      voiceLoop(
        'I could not find matching jobs right now. ' +
        'Let me try again in a moment.'
      )
      return
    }

    showJobsPanel(jobs)
    State.loopRunning = true
    readJobAtIndex(0)

  } catch(e) {
    console.error('[Jobs]', e)
    State.loopRunning = true
    voiceLoop('I had trouble searching. Please try again.')
  }
}

/* ══════════════════════════════════════════════
   READ JOB AT INDEX
══════════════════════════════════════════════ */
function readJobAtIndex(index) {
  _applicationInProgress = false

  if (!State.jobs || index >= State.jobs.length) {
    voiceLoop('Those are all the matching jobs!')
    return
  }

  State.jobIndex = index
  const job  = State.jobs[index]
  highlightJobCard(index)

  const text = JobService.toSpeech
    ? JobService.toSpeech(job, index, State.jobs.length)
    : 'Job ' + (index + 1) + ' of ' + State.jobs.length +
      '. ' + job.title + ' at ' + job.company +
      ' in ' + job.location +
      '. Salary ' + job.salary +
      '. This is a ' + job.match +
      ' percent match. Shall I apply?'

  voiceLoopWithJobResponse(text, job)
}

/* ══════════════════════════════════════════════
   VOICE LOOP WITH JOB RESPONSE
══════════════════════════════════════════════ */
function voiceLoopWithJobResponse(aiText, currentJob) {
  if (!State.loopRunning) return

  if (_isSpeakingGuard) return

  _isSpeakingGuard = true
  State.lastAIText  = aiText

  setAppState('speaking')
  updateCaptionStrip('ai', aiText)
  addBubble('ai', aiText)

  VoiceService.speak(aiText, function() {
    _isSpeakingGuard = false
    if (!State.loopRunning) return
    setTimeout(startListening, 500)
  })
}

/* ══════════════════════════════════════════════
   APPLICATION — Confirm then submit
══════════════════════════════════════════════ */
function startApplication(job) {
  // Guard 1 — already in progress
  if (_applicationInProgress) {
    console.log('[App] Already in progress')
    return
  }

  // Guard 2 — already submitted this job
  if (_submittedJobs.has(job.id || job.title)) {
    console.log('[App] Already submitted:', job.title)
    return
  }

  _applicationInProgress = true
  console.log('[App] Starting:', job.title)

  setAppState('speaking')

  const name = State.profile.name || 'there'
  const summary =
    'Before I apply, let me confirm ' + name + '. ' +
    'Name: ' + (State.profile.name || 'not set') + '. ' +
    'Skills: ' + (State.profile.skills || 'not set') + '. ' +
    'Experience: ' + (State.profile.experience || 'not set') + '. ' +
    'Location: ' + (State.profile.location || 'not set') + '. ' +
    'Applying to ' + job.title + ' at ' + job.company + '. ' +
    'Say yes to apply or tell me what to change.'

  addBubble('ai', summary)
  updateCaptionStrip('ai', summary)

  VoiceService.speak(summary, function() {
    // Guard 3 — double-fire protection after speak
    if (_submittedJobs.has(job.id || job.title)) {
      _applicationInProgress = false
      return
    }

    if (!State.loopRunning) State.loopRunning = true
    setAppState('listening')
    updateCaptionStrip('user', '')

    VoiceService.listen(
      function(partial) {
        updateCaptionStrip('user', partial)
      },
      function(userReply) {
        // Guard — don't process if already submitted
        if (_submittedJobs.has(job.id || job.title)) {
          _applicationInProgress = false
          return
        }

        const r = (userReply || '').toLowerCase()

        const hasCorrection =
          r.includes('change') || r.includes('update') ||
          r.includes('wrong') || r.includes('mistake') ||
          r.includes('not right') || r.includes('actually')

        const isYes =
          !hasCorrection && (
            r.includes('yes') || r.includes('apply') ||
            r.includes('okay') || r.includes('ok') ||
            r.includes('sure') || r.includes('go') ||
            r.includes('haan') || r.includes('seri') ||
            r.includes('correct') || r.includes('right') ||
            r.includes('perfect') || r.includes('confirm') ||
            r.includes('proceed')
          )

        if (hasCorrection) {
          _applicationInProgress = false
          Extractor.run(userReply).then(function() {
            setTimeout(function() {
              startApplication(job)
            }, 300)
          })
        } else if (isYes) {
          submitApplication(job, 'VH-' + Date.now())
        } else if (!userReply || r.trim().length < 2) {
          // Reset flag before retrying
          _applicationInProgress = false

          // Don't re-read full summary — just ask again
          const askAgain =
            'Say yes to confirm or no to cancel.'
          addBubble('ai', askAgain)
          updateCaptionStrip('ai', askAgain)

          VoiceService.speak(askAgain, function() {
            if (!State.loopRunning) return
            setAppState('listening')
            updateCaptionStrip('user', '')

            VoiceService.listen(
              function(p) { updateCaptionStrip('user', p) },
              function(reply2) {
                if (!reply2 || reply2.trim().length < 2) {
                  // Still silent — cancel gracefully
                  _applicationInProgress = false
                  voiceLoop(
                    'No problem. Let me know if you ' +
                    'want to apply to any other job.'
                  )
                  return
                }
                const r2 = reply2.toLowerCase()
                if (r2.includes('yes') ||
                    r2.includes('apply') ||
                    r2.includes('okay') ||
                    r2.includes('sure') ||
                    r2.includes('go') ||
                    r2.includes('confirm')) {
                  submitApplication(job, 'VH-' + Date.now())
                } else {
                  _applicationInProgress = false
                  Extractor.run(reply2).then(function() {
                    setTimeout(function() {
                      startApplication(job)
                    }, 300)
                  })
                }
              }
            )
          })
        } else {
          // Unknown — run through intent detection
          _applicationInProgress = false
          GroqService.detectIntent(
            userReply,
            'User is confirming application to ' +
            job.title
          ).then(function(result) {
            if (result.intent === 'APPLY') {
              submitApplication(job, 'VH-' + Date.now())
            } else if (result.intent === 'SKIP') {
              _applicationInProgress = false
              const nextIdx = (State.jobIndex || 0) + 1
              if (nextIdx < State.jobs.length) {
                State.jobIndex = nextIdx
                readJobAtIndex(nextIdx)
              } else {
                voiceLoop('Those are all the jobs!')
              }
            } else {
              Extractor.run(userReply).then(function() {
                setTimeout(function() {
                  startApplication(job)
                }, 300)
              })
            }
          })
        }
      }
    )
  })
}

/* ══════════════════════════════════════════════
   SUBMIT APPLICATION
══════════════════════════════════════════════ */
function submitApplication(job, reference) {
  // Mark this job as submitted
  _submittedJobs.add(job.id || job.title)
  _applicationInProgress = false

  setAppState('speaking')

  const msg =
    'Done! Your application to ' + job.company +
    ' has been submitted. Reference ' + reference +
    '. I will alert you the moment they reply.'

  addBubble('ai', msg)
  updateCaptionStrip('ai', msg)
  showSuccessPanel(job, reference)
  BackendService.saveApplication(job, reference)

  VoiceService.speak(msg, function() {
    State.loopRunning  = true
    State.silenceCount = 0
    State._afterApply  = true

    setTimeout(function() {
      const nextMsg =
        'Would you like to see more jobs ' +
        'or are you done for today?'
      addBubble('ai', nextMsg)
      updateCaptionStrip('ai', nextMsg)

      VoiceService.speak(nextMsg, function() {
        State.loopRunning = true
        setTimeout(startListening, 500)
      })
    }, 800)
  })
}

/* ══════════════════════════════════════════════
   SLEEP MODE
══════════════════════════════════════════════ */
function enterSleepMode() {
  console.log('[Sleep] Entering...')
  VoiceService.stopSpeaking()
  VoiceService.stopListening()

  State.loopRunning   = false
  State.silenceCount  = 0
  _isSpeakingGuard    = false

  setAppState('sleeping')
  updateCaptionStrip('silent', '')
  showSleepMode()

  document.removeEventListener('click',   _wakeHandler)
  document.removeEventListener('keydown', _wakeKeyHandler)

  setTimeout(function() {
    if (!_wakeListenerActive) {
      _wakeListenerActive = true
      document.addEventListener('click',   _wakeHandler)
      document.addEventListener('keydown', _wakeKeyHandler)
    }
  }, 1000)
}

function _wakeHandler() {
  if (!_wakeListenerActive) return
  _wakeListenerActive = false
  document.removeEventListener('click',   _wakeHandler)
  document.removeEventListener('keydown', _wakeKeyHandler)
  wakeFromSleep()
}

function _wakeKeyHandler(e) {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (!_wakeListenerActive) return
    e.preventDefault()
    _wakeListenerActive = false
    document.removeEventListener('click',   _wakeHandler)
    document.removeEventListener('keydown', _wakeKeyHandler)
    wakeFromSleep()
  }
}

function wakeFromSleep() {
  if (State.loopRunning) return
  console.log('[Wake] Waking...')

  hideSleepMode()
  _wakeListenerActive = false
  _isSpeakingGuard    = false
  State.loopRunning   = true
  State.silenceCount  = 0

  try { window.speechSynthesis.cancel() } catch(e) {}
  if (State.recognition) {
    try { State.recognition.stop() } catch(e) {}
    State.recognition = null
  }

  const filled  = PROFILE_FIELDS.filter(
    function(f) { return State.profile[f] }
  )
  const missing = getMissingFields()
  const name    = State.profile.name
    ? State.profile.name.split(' ')[0] + '! '
    : ''

  let wakeMsg = ''
  if (State.jobSearchDone && State.jobs && State.jobs.length > 0) {
    wakeMsg = 'Welcome back ' + name +
      'Shall I continue reading jobs?'
  } else if (filled.length > 0 && missing.length > 0) {
    wakeMsg = 'Welcome back ' + name +
      'I still need your ' + missing[0] + '.'
  } else {
    wakeMsg = 'Welcome back ' + name +
      'What would you like to do?'
  }

  setTimeout(function() {
    setAppState('speaking')
    addBubble('ai', wakeMsg)
    updateCaptionStrip('ai', wakeMsg)

    VoiceService.speak(wakeMsg, function() {
      if (!State.loopRunning) return
      setTimeout(startListening, 500)
    })
  }, 400)
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function forceStartListening() {
  if (!State.loopRunning) {
    wakeFromSleep()
    return
  }
  if (State.appState === 'speaking') {
    VoiceService.stopSpeaking()
  }
  if (State.appState !== 'listening') {
    setTimeout(startListening, 300)
  }
}

function repeatLastMessage() {
  if (State.lastAIText) {
    _isSpeakingGuard = false
    voiceLoop(State.lastAIText)
  }
}

function showMicDeniedMessage() {
  const msg = document.createElement('div')
  msg.className   = 'mic-permission-msg'
  msg.textContent =
    '🎤 Microphone access denied. ' +
    'Click 🔒 in address bar → Allow microphone → Refresh'
  document.body.appendChild(msg)
  setTimeout(function() { msg.remove() }, 8000)
}

/* ══════════════════════════════════════════════
   DOM READY
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {

  /* Browser check */
  const isChrome = /Chrome/.test(navigator.userAgent) &&
                   !/Edg/.test(navigator.userAgent)
  const isEdge   = /Edg/.test(navigator.userAgent)
  if (!isChrome && !isEdge) {
    const banner = document.getElementById('browser-banner')
    if (banner) banner.classList.remove('hidden')
  }

  /* Tap to Start button */
  const startBtn = document.getElementById('start-btn')
  if (startBtn) {
    startBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      dismissStartOverlay()
    })
  }

  /* Click anywhere on overlay */
  const startOverlay = document.getElementById('start-overlay')
  if (startOverlay) {
    startOverlay.addEventListener('click', function() {
      dismissStartOverlay()
    })
  }

  /* Language cards */
  document.querySelectorAll('.lang-card')
    .forEach(function(card) {
      card.addEventListener('click', function() {
        card.style.borderColor = '#FFB800'
        card.style.background  = 'rgba(255,184,0,0.1)'
        VoiceService.stopSpeaking()
        VoiceService.stopListening()
        State._voiceLangStarted = true
        setTimeout(function() {
          selectLanguage(card.getAttribute('data-lang'))
        }, 300)
      })
    })

  State._voiceLangStarted = false

  /* Mic button */
  const micBtn = document.getElementById('mic-btn')
  if (micBtn) {
    micBtn.addEventListener('click', function() {
      if (State.appState === 'sleeping' || !State.loopRunning) {
        wakeFromSleep()
      } else if (State.appState === 'listening') {
        VoiceService.stopListening()
      } else if (State.appState === 'speaking') {
        VoiceService.stopSpeaking()
        setTimeout(forceStartListening, 200)
      } else {
        forceStartListening()
      }
    })
  }

  /* Repeat button */
  const repeatBtn = document.getElementById('repeat-btn')
  if (repeatBtn) {
    repeatBtn.addEventListener('click', repeatLastMessage)
  }

  /* Sleep overlay */
  const sleepOverlay = document.getElementById('sleep-overlay')
  if (sleepOverlay) {
    sleepOverlay.addEventListener('click', wakeFromSleep)
  }

  /* Pre-load voices */
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.getVoices()
    speechSynthesis.onvoiceschanged = function() {
      speechSynthesis.getVoices()
    }
  }

  /* Mic permission check */
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' })
      .then(function(result) {
        if (result.state === 'denied') showMicDeniedMessage()
        result.onchange = function() {
          if (result.state === 'denied') showMicDeniedMessage()
        }
      })
      .catch(function() {})
  }

  /* Keyboard shortcuts */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return

    const overlay = document.getElementById('start-overlay')
    if (overlay && overlay.style.display !== 'none' &&
        overlay.style.opacity !== '0') {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        dismissStartOverlay()
      }
      return
    }

    if (e.code === 'Space') {
      e.preventDefault()
      if (State.appState === 'sleeping' || !State.loopRunning) {
        wakeFromSleep()
      } else if (State.appState === 'listening') {
        VoiceService.stopListening()
      } else if (State.appState === 'speaking') {
        VoiceService.stopSpeaking()
        setTimeout(forceStartListening, 300)
      } else {
        forceStartListening()
      }
    }
    if (e.code === 'KeyR') repeatLastMessage()
    if (e.code === 'Escape') {
      VoiceService.stopSpeaking()
      setAppState('waiting')
    }
  })

  /* Session timer */
  let sessionSeconds = 0
  setInterval(function() {
    sessionSeconds++
    const m  = Math.floor(sessionSeconds / 60)
    const s  = sessionSeconds % 60
    const el = document.getElementById('session-timer')
    if (el) {
      el.textContent =
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0')
    }
  }, 1000)

  console.log('[App] VoiceHire ready ✓')
})
