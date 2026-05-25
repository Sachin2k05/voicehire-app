/* ─────────────────────────────────────────────
   ui.js  —  All UI functions for VoiceHire
   ───────────────────────────────────────────── */

/* ══════════════════════════════════════════════
   setAppState(newState)
   Updates orb, waveform, rings, banner, pill, mic btn
══════════════════════════════════════════════ */
function setAppState(newState) {
  State.appState = newState

  /* ── Orb ── */
  document.getElementById('orb')
    .setAttribute('data-state', newState)
  document.getElementById('orb-icon')
    .textContent = ORB_ICONS[newState] || '🎤'

  /* ── Waveform ── */
  const wf = document.getElementById('waveform')
  if (newState === 'speaking') {
    wf.className = 'waveform active'
  } else if (newState === 'listening') {
    wf.className = 'waveform active user'
  } else {
    wf.className = 'waveform'
  }

  /* ── Rings ── */
  const rings = document.querySelectorAll('.ring')
  rings.forEach(ring => {
    if (newState === 'speaking') {
      ring.style.opacity    = ''     // let CSS animation handle it
      ring.style.borderColor = 'rgba(255,184,0,0.4)'  // amber
    } else if (newState === 'listening') {
      ring.style.opacity    = ''
      ring.style.borderColor = 'rgba(255,68,68,0.4)'  // red
    } else if (newState === 'waiting') {
      ring.style.opacity    = ''
      ring.style.borderColor = 'rgba(100,100,100,0.4)' // subtle grey for waiting smoothly
    } else {
      ring.style.opacity    = '0'
    }
  })

  /* ── Thinking ring ── */
  const thinkRing = document.querySelector('.thinking-ring')
  if (thinkRing) {
    thinkRing.style.opacity   = newState === 'thinking' ? '1' : '0'
    thinkRing.style.animation = newState === 'thinking'
      ? 'rotate 3s linear infinite' : 'none'
  }

  /* ── Status banner ── */
  const banner = document.getElementById('status-banner')
  const bc = BANNER_COLORS[newState] || BANNER_COLORS.waiting
  banner.style.background      = bc.bg
  banner.style.borderLeftColor = bc.border
  banner.style.color           = bc.text
  
  const t = TRANSLATIONS[State.selectedLang] || TRANSLATIONS['en-IN']
  banner.textContent           = t['banner_' + newState] || ''

  /* ── Status pill ── */
  const pill = document.getElementById('status-pill')
  pill.className = 'status-pill ' + newState

  const pillLabels = {
    speaking:  '🔊 Speaking',
    listening: '🎤 Listening',
    thinking:  '⚙️ Thinking',
    sleeping:  '💤 Sleeping',
    success:   '✅ Done',
    waiting:   '⏸ Waiting',
    searching: '🔍 Searching',
    recording: '🔴 Recording'
  }
  document.getElementById('pill-text')
    .textContent = t['pill_' + newState] || newState

  /* ── Mic button ── */
  const micBtn = document.getElementById('mic-btn')
  if (newState === 'listening') {
    micBtn.className   = 'mic-btn listening'
    micBtn.textContent = t['btn_mic_listening'] || '🔴  Listening... Tap to stop'
  } else if (newState === 'sleeping') {
    micBtn.className   = 'mic-btn'
    micBtn.textContent = t['btn_mic_sleeping'] || '🌙  Tap or speak to wake'
  } else {
    micBtn.className   = 'mic-btn'
    micBtn.textContent = t['btn_mic_idle'] || '🎤  Tap to Speak  ·  or just talk'
  }
}

/* ══════════════════════════════════════════════
   updateCaptionStrip(source, text)
   source: 'ai' | 'user' | 'silent'
══════════════════════════════════════════════ */
function updateCaptionStrip(source, text) {
  const labelEl = document.getElementById('caption-label-center')
  const textEl  = document.getElementById('caption-text-center')
  const strip   = document.getElementById('caption-center')

  if (!strip) return

  const t = TRANSLATIONS[State.selectedLang] || TRANSLATIONS['en-IN']

  if (source === 'ai') {
    strip.className = 'caption-strip ai-speaking'
    labelEl.textContent = t['label_ai_saying'] || 'AI IS SAYING'
    textEl.textContent = text || 'Speaking...'
  } else if (source === 'user') {
    strip.className = 'caption-strip user-speaking'
    labelEl.textContent = t['label_you_saying'] || 'YOU ARE SAYING'
    textEl.textContent = text || 'Listening...'
  } else {
    strip.className = 'caption-strip silent'
    labelEl.textContent = ''
    textEl.textContent = t['caption_silent_bottom'] || 'Tap mic or speak naturally...'
  }
}

/* ══════════════════════════════════════════════
   addBubble(role, text)
   role: 'ai' | 'user'
   Returns the created div element
══════════════════════════════════════════════ */
function addBubble(role, text) {
  const chat = document.getElementById('chat-area')
  const div  = document.createElement('div')

  if (role === 'ai') {
    div.className = 'bubble bubble-ai'
    div.innerHTML = text + '<span class="bubble-icon">🔊</span>'
  } else if (role === 'user') {
    div.className = 'bubble bubble-user'
    div.innerHTML = text + '<span class="bubble-icon">🎤</span>'
  }

  /* Deactivate all previous AI bubbles */
  document.querySelectorAll('.bubble-ai.active')
    .forEach(b => b.classList.remove('active'))

  if (role === 'ai') div.classList.add('active')

  chat.appendChild(div)
  chat.scrollTop = chat.scrollHeight
  return div
}

/* ══════════════════════════════════════════════
   addProfileUpdateBubble(extracted)
   Shows a small amber card in chat listing each
   newly-filled profile field and its value.
   extracted: { fieldName: "value", ... }
══════════════════════════════════════════════ */
function addProfileUpdateBubble(extracted) {
  const entries = Object.entries(extracted)
  if (entries.length === 0) return

  const chat = document.getElementById('chat-area')
  const div  = document.createElement('div')

  div.className = 'profile-update-bubble'
  div.style.cssText = [
    'align-self: center',
    'background: rgba(255,184,0,0.06)',
    'border: 1px solid rgba(255,184,0,0.25)',
    'border-left: 4px solid #FFB800',
    'border-radius: 12px',
    'padding: 10px 16px',
    'margin: 4px 0',
    'animation: bubbleIn 0.3s ease-out',
    'max-width: 70%'
  ].join(';')

  const labels = {
    name:       'Name',
    skills:     'Skills',
    experience: 'Experience',
    location:   'Location',
    jobType:    'Job Type',
    salary:     'Salary',
    education:  'Education',
    languages:  'Languages'
  }

  let html =
    '<div style="font-size:10px;color:#FFB800;font-weight:700;' +
    'letter-spacing:0.1em;margin-bottom:6px;">✨ PROFILE UPDATED</div>'

  entries.forEach(function ([field, value]) {
    html +=
      '<div style="display:flex;justify-content:space-between;' +
      'gap:16px;margin-top:4px;">' +
        '<span style="font-size:11px;color:rgba(255,255,255,0.45);' +
        'text-transform:uppercase;font-weight:600;">' +
        escHtml(labels[field] || field) + '</span>' +
        '<span style="font-size:13px;color:#FFE08A;font-weight:600;">' +
        escHtml(String(value)) + '</span>' +
      '</div>'
  })

  div.innerHTML = html
  chat.appendChild(div)
  chat.scrollTop = chat.scrollHeight
}

/* ══════════════════════════════════════════════
   showTypingIndicator()
══════════════════════════════════════════════ */
function showTypingIndicator() {
  removeTypingIndicator()
  const chat = document.getElementById('chat-area')
  const div  = document.createElement('div')
  div.id        = 'typing-indicator'
  div.className = 'bubble-typing'
  div.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `
  chat.appendChild(div)
  chat.scrollTop = chat.scrollHeight
}

/* ══════════════════════════════════════════════
   removeTypingIndicator()
══════════════════════════════════════════════ */
function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator')
  if (el) el.remove()
}

/* ══════════════════════════════════════════════
   updateProfileField(key, value)
   Updates profile object, left panel, right checklist,
   and progress bar
══════════════════════════════════════════════ */
function updateProfileField(key, value) {
  if (!value || String(value).trim() === '') return;

  State.profile[key] = value

  /* Left panel field */
  const valueEl = document.getElementById('value-' + key)
  const fieldEl = document.getElementById('field-' + key)

  if (valueEl) {
    valueEl.textContent = value
    valueEl.className   = 'field-value just-filled'
    setTimeout(() => {
      valueEl.className = 'field-value'
    }, 2000)
  }

  if (fieldEl) {
    fieldEl.classList.add('just-filled')
    setTimeout(() => {
      fieldEl.classList.remove('just-filled')
    }, 2000)
  }

  /* Right panel checklist */
  const checkItem = document.getElementById('check-' + key)
  if (checkItem) {
    checkItem.classList.add('filled')
    const iconEl = checkItem.querySelector('.check-icon')
    if (iconEl) iconEl.textContent = '✅'
    const valEl = document.getElementById('check-value-' + key)
    if (valEl) valEl.textContent = value
  }

  /* Progress bar */
  const filled = PROFILE_FIELDS.filter(f => State.profile[f]).length
  const pct    = Math.round((filled / 8) * 100)

  const progressBar = document.getElementById('profile-progress')
  const countEl     = document.getElementById('profile-count')
  if (progressBar) progressBar.style.width = pct + '%'
  if (countEl)     countEl.textContent     = filled + ' of 8'
}

/* ══════════════════════════════════════════════
   getMissingFields(profile)
   Returns array of profile field names not yet filled
══════════════════════════════════════════════ */
function getMissingFields(profile = State.profile) {
  return PROFILE_FIELDS.filter(f => !profile[f] || String(profile[f]).trim() === '')
}

/* ══════════════════════════════════════════════
   getNextMissingField(profile)
   Returns the first missing field based on a strict flow
══════════════════════════════════════════════ */
function getNextMissingField(profile = State.profile) {
  const flow = [
    'name', 'skills', 'experience', 'location', 
    'jobType', 'salary', 'education', 'languages'
  ];
  for (const f of flow) {
    if (!profile[f] || String(profile[f]).trim() === '') {
      return f;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════
   applyTranslations()
   Translates all data-i18n attributes
══════════════════════════════════════════════ */
function applyTranslations() {
  const t = TRANSLATIONS[State.selectedLang] || TRANSLATIONS['en-IN'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });
}

/* ══════════════════════════════════════════════
   isProfileComplete(profile)
   Returns true if all fields are filled
══════════════════════════════════════════════ */
function isProfileComplete(profile = State.profile) {
  return getMissingFields(profile).length === 0
}

/* ══════════════════════════════════════════════
   showSleepMode() / hideSleepMode()
══════════════════════════════════════════════ */
function showSleepMode() {
  document.getElementById('sleep-overlay')
    .classList.remove('hidden')
}

function hideSleepMode() {
  document.getElementById('sleep-overlay')
    .classList.add('hidden')
}

/* ══════════════════════════════════════════════
   showLanguageScreen() / showMainApp()
══════════════════════════════════════════════ */
function showLanguageScreen() {
  document.getElementById('language-screen')
    .classList.remove('hidden')
  document.getElementById('main-app')
    .classList.add('hidden')
}

function showMainApp() {
  document.getElementById('language-screen')
    .classList.add('hidden')
  document.getElementById('main-app')
    .classList.remove('hidden')
}

/* ══════════════════════════════════════════════
   showJobsPanel(jobs)
   Hides checklist, renders job cards
══════════════════════════════════════════════ */
function showJobsPanel(jobs) {
  document.getElementById('checklist-panel')
    .classList.add('hidden')

  const panel = document.getElementById('jobs-panel')
  panel.classList.remove('hidden')
  panel.innerHTML = ''

  jobs.forEach((job, index) => {
    const card = document.createElement('div')
    card.className = 'job-card'
    card.id        = 'job-card-' + index
    card.innerHTML = `
      <div class="job-reading-badge" style="display:none">🔊 READING NOW</div>
      <div class="job-company">${escHtml(job.company)}</div>
      <div class="job-title">${escHtml(job.title)}</div>
      <div class="job-chips">
        ${job.type ? `<span class="job-chip">${escHtml(job.type)}</span>` : ''}
        <span class="job-chip">${escHtml(job.salary)}</span>
        <span class="job-chip">${escHtml(job.location)}</span>
      </div>
      <div class="match-row">
        <div class="match-bar-bg">
          <div class="match-bar-fill" style="width:${job.match}%"></div>
        </div>
        <span class="match-text">${job.match}% match</span>
      </div>
    `
    panel.appendChild(card)
  })
}

/* ══════════════════════════════════════════════
   highlightJobCard(index)
   Makes one card active and shows reading badge
══════════════════════════════════════════════ */
function highlightJobCard(index) {
  document.querySelectorAll('.job-card').forEach(c => {
    c.classList.remove('active')
    const badge = c.querySelector('.job-reading-badge')
    if (badge) badge.style.display = 'none'
  })

  const card = document.getElementById('job-card-' + index)
  if (card) {
    card.classList.add('active')
    const badge = card.querySelector('.job-reading-badge')
    if (badge) badge.style.display = 'inline-block'
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

/* ══════════════════════════════════════════════
   showSuccessPanel(job, reference)
   Hides jobs panel, renders confirmation receipt
══════════════════════════════════════════════ */
function showSuccessPanel(job, reference) {
  document.getElementById('jobs-panel')
    .classList.add('hidden')

  const panel = document.getElementById('success-panel')
  panel.classList.remove('hidden')

  panel.innerHTML = `
    <div class="success-card">
      <div class="success-header">✅ APPLICATION SENT</div>
      <div class="success-row">
        <span class="success-label">Company</span>
        <span class="success-value">${escHtml(job.company)}</span>
      </div>
      <div class="success-row">
        <span class="success-label">Role</span>
        <span class="success-value">${escHtml(job.title)}</span>
      </div>
      <div class="success-row">
        <span class="success-label">Location</span>
        <span class="success-value">${escHtml(job.location)}</span>
      </div>
      <div class="success-row">
        <span class="success-label">Submitted</span>
        <span class="success-value">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="success-row">
        <span class="success-label">Reference</span>
        <span class="success-value">${escHtml(reference)}</span>
      </div>
      <div class="success-footer">
        🔊 "I'll tell you when they reply"
      </div>
    </div>
  `
}

/* ══════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}


