/* ─────────────────────────────────────────────
   extract.js  —  Extractor
   Rule-based profile field extraction from
   raw user speech transcripts.
   ───────────────────────────────────────────── */

async function correctSpeechErrors(text) {
  // Only correct if text seems garbled
  // Quick check — if text makes sense, skip correction
  const key = typeof GROQ_API_KEY !== 'undefined'
    ? GROQ_API_KEY : ''

  if (!key || text.length < 4) return text

  const prompt =
    'You are a speech recognition error corrector. ' +
    'Fix any mishearing errors in this text from ' +
    'an Indian job seeker. Common mishearings: ' +
    'tech skills, city names, job terms, numbers. ' +
    'Examples: "mission learning" should be ' +
    '"machine learning", "walk in Chennai" should ' +
    'be "work in Chennai", "pie thon" should be ' +
    '"python". ' +
    'If text is already correct return it unchanged. ' +
    'Return ONLY the corrected text. Nothing else. ' +
    'Input: "' + text + '"'

  const controller = new AbortController()
  const timeout = setTimeout(
    function() { controller.abort() }, 3000
  )

  try {
    const res = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + GROQ_API_KEY
        },
        body: JSON.stringify({
          model:       'llama-3.1-8b-instant',
          max_tokens:  100,
          temperature: 0.1,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      }
    )
    clearTimeout(timeout)
    const data = await res.json()
    const corrected = data?.choices?.[0]
                          ?.message?.content?.trim()

    if (corrected && corrected.length > 0) {
      console.log('[Correct]', text, '→', corrected)
      return corrected
    }
    return text

  } catch(e) {
    clearTimeout(timeout)
    return text // Return original if correction fails
  }
}

const Extractor = {

  async run(text) {
    text = await correctSpeechErrors(text)
    console.log('[Extract] After correction:', text)
    
    // Check for corrections first — short-circuit if handled
    if (this.handleCorrection(text)) return

    const t = text.toLowerCase()
    this.extractName(text, t)
    this.extractExperience(t)
    this.extractLocation(t)
    this.extractJobType(t)
    this.extractSalary(text, t)
    this.extractEducation(t)
    this.extractSkills(t)
    this.extractLanguages(t)
  },

  extractName(text, t) {
    const skipWords = [
      'yes','no','okay','sure','fine','good',
      'great','hello','hi','hey','want','work',
      'full','part','time','speak','speaking',
      'update','change','please','could','would',
      'should','the','and','python','java','sql',
      'excel','data','machine','learning','analyst',
      'developer','engineer','fresher','experienced',
      'years','lakhs','salary','location','chennai',
      'delhi','mumbai','bangalore','sufficient',
      'proficient','skilled','expert','remote',
      'hybrid','office','noting','information',
      'gave','giving','why','what','how','when',
      'where','not','taking',
      'next','one','two','three','four','five',
      'six','seven','eight','nine','ten',
      'job','jobs','first','second','third',
      'last','new','old','current','previous',
      'apply','applied','application','submit',
      'confirm','correct','wrong','change',
      'before','after','during','while','then',
      'also','still','already','just','only',
      'take','give','note','hear','listen',
      'speak','tell','show','find','search',
      'match','percent','salary','company',
      'role','position','located','location',
      // Navigation / intent words — must not be captured as names
      'looking','for','looking for','what',
      'which','type','kind','field','area',
      'domain','sector','industry','role',
      'position','job','work','career',
      'move','next','previous','back',
      'forward','again','repeat','continue',
      // Education / qualification terms — comprehensive list
      'btech','b tech','b.tech','mtech','m tech',
      'm.tech','mba','mca','bca','bsc','msc',
      'graduate','graduation','graduated',
      'degree','diploma','bachelor','master',
      'engineer','engineering','science',
      'arts','commerce','post','post graduate',
      'postgraduate','phd','doctorate',
      'college','university','school','institute',
      'tenth','twelfth','plus two','intermediate',
      'sslc','hsc','cbse','stateboard',
      // Career / job-search intent terms
      'professional',
      'years','year','month','months',
      'currently','working','worked','worked at',
      'seeking','looking','searching',
      'expect','expected','expecting',
      'want','wanted','prefer','preferred',
      'salary','lpa','lakhs','package',
      'remote','hybrid','office','onsite',
      'full time','part time','freelance',
      'contract','permanent','temporary'
    ]

    // Never overwrite a valid existing name with education/freeform answers.
    // Only explicit correction phrases are allowed to update it.
    if (State.profile.name &&
        State.profile.name.length > 1 &&
        !skipWords.includes(State.profile.name.toLowerCase())) {
      // Name already correctly set — only allow explicit correction patterns
      const correctionOnly = [
        /(?:update|change|correct|set)\s+my\s+name\s+(?:as|to|is)\s+([A-Za-z][a-zA-Z.'\s]{1,30})/i,
        /(?:my name is actually|actually my name is)\s+([A-Za-z][a-zA-Z.'\s]{1,30})/i
      ]
      for (const p of correctionOnly) {
        const m = text.trim().match(p)
        if (m && m[1]) {
          const name = m[1].trim()
          State.profile['name'] = name
          updateProfileField('name', name)
          console.log('[Extract] Name corrected to:', name)
        }
      }
      return // Don't run full extraction
    }

    const patterns = [
      // Correction patterns — highest priority
      /(?:update|change|correct|set)\s+my\s+name\s+(?:as|to|is)\s+([A-Za-z][a-zA-Z.'\s]{1,30})/i,
      /(?:my name is actually|actually my name is)\s+([A-Za-z][a-zA-Z.'\s]{1,30})/i,
      // Standard name patterns
      /(?:my name is|name is|i am called|call me)\s+([A-Za-z][a-zA-Z.'\s]{1,30})/i,
      // "I am Sachin" — only if short whole sentence
      /^i\s+am\s+([A-Za-z][a-zA-Z.']{1,15}(?:\s[A-Za-z.]{1,15})?)[\.\s]*$/i,
      // "This is Sachin"
      /this is\s+([A-Za-z][a-zA-Z.']{1,15}(?:\s[A-Za-z.]{1,15})?)/i,
      // Just a name alone — "Sachin" or "Sachin E"
      /^([A-Za-z][a-z]{1,14}(?:\s[A-Za-z.]{1,15})?)[\.\s]*$/i
    ]

    for (const p of patterns) {
      const m = text.trim().match(p)
      if (m && m[1]) {
        // Clean up the captured name
        let name = m[1].trim()
          .replace(/\.$/, '')   // remove trailing dot
          .replace(/\s+/g, ' ') // normalize spaces

        if (name.length < 2 || name.length > 40) continue

        // Must not start with a skip word
        const isSkip = skipWords.some(
          function (sw) {
            return name.toLowerCase() === sw ||
                   name.toLowerCase().startsWith(sw + ' ')
          }
        )

        // Must not exceed 3 words
        const wordCount = name.split(' ').length
        if (!isSkip && wordCount <= 3) {
          State.profile['name'] = name
          updateProfileField('name', name)
          console.log('[Extract] Name captured:', name)
          return
        }
      }
    }
  },

  handleCorrection(text) {
    // Detect correction intent
    const correctionPhrases = [
      'update my', 'change my', 'correct my',
      'not correct', 'i said', 'i meant',
      'actually my', 'please change', 'it should be'
    ]

    const isCorrection = correctionPhrases.some(
      p => text.toLowerCase().includes(p)
    )

    if (!isCorrection) return false

    // Try to extract which field and what value
    const fieldPatterns = [
      { field: 'name',       regex: /(?:name|called)\s+(?:as|to|is)\s+([A-Za-z\s]+)/i },
      { field: 'location',   regex: /(?:location|city|place)\s+(?:as|to|is)\s+([A-Za-z\s]+)/i },
      { field: 'skills',     regex: /(?:skills?|expertise)\s+(?:as|to|is|are)\s+([A-Za-z,\s]+)/i },
      { field: 'experience', regex: /(?:experience|years?)\s+(?:as|to|is)\s+([A-Za-z0-9\s]+)/i },
      { field: 'salary',     regex: /(?:salary|pay|package)\s+(?:as|to|is)\s+([A-Za-z0-9\s]+)/i },
      { field: 'jobType',    regex: /(?:job type|work type)\s+(?:as|to|is)\s+([A-Za-z\s]+)/i },
      { field: 'education',  regex: /(?:education|degree|qualification)\s+(?:as|to|is)\s+([A-Za-z\s]+)/i },
      { field: 'languages',  regex: /(?:languages?|speak)\s+(?:as|to|is|are)\s+([A-Za-z,\s]+)/i }
    ]

    let corrected = false
    fieldPatterns.forEach(({ field, regex }) => {
      const m = text.match(regex)
      if (m && m[1] && m[1].trim().length > 1) {
        const val = m[1].trim()
        State.profile[field] = val
        updateProfileField(field, val)
        console.log('[Correction] ' + field + ':', val)
        corrected = true
      }
    })

    return corrected
  },

  extractExperience(t) {
    if (State.profile.experience) return
    const m = t.match(/(\d+)\s*(?:\+\s*)?years?\s*(?:of\s+)?(?:experience|exp|work)?/i)
    if (m) { updateProfileField('experience', m[1] + ' years'); return }
    if (t.includes('fresher') ||
        t.includes('no experience') ||
        t.includes('fresh graduate') ||
        t.includes('just graduated')) {
      updateProfileField('experience', 'Fresher')
    }
  },

  extractLocation(t) {
    if (State.profile.location) return
    const cities = [
      ['Chennai',    ['chennai']],
      ['Bangalore',  ['bangalore', 'bengaluru']],
      ['Mumbai',     ['mumbai', 'bombay']],
      ['Delhi',      ['delhi', 'new delhi']],
      ['Hyderabad',  ['hyderabad']],
      ['Pune',       ['pune']],
      ['Coimbatore', ['coimbatore']],
      ['Kolkata',    ['kolkata', 'calcutta']],
      ['Kochi',      ['kochi', 'cochin']],
      ['Ahmedabad',  ['ahmedabad']],
      ['Jaipur',     ['jaipur']],
      ['Remote',     ['remote', 'work from home', 'wfh', 'anywhere']]
    ]
    for (const [name, keys] of cities) {
      if (keys.some(k => t.includes(k))) {
        updateProfileField('location', name)
        return
      }
    }
  },

  extractJobType(t) {
    if (State.profile.jobType) return
    if (t.match(/full.?time/))
      updateProfileField('jobType', 'Full-time')
    else if (t.match(/part.?time/))
      updateProfileField('jobType', 'Part-time')
    else if (t.includes('freelance') || t.includes('contract'))
      updateProfileField('jobType', 'Freelance')
    else if (t.includes('government') || t.includes('govt'))
      updateProfileField('jobType', 'Government')
    else if (t.includes('remote') && !State.profile.location)
      updateProfileField('jobType', 'Remote')
  },

  extractSalary(text, t) {
    if (State.profile.salary) return

    // Pattern 1: "7 LPA" or "7 lakhs" or "7-9 LPA"
    const p1 = /(\d+)\s*(?:to|-)\s*(\d+)\s*(?:lpa|lakhs?|lac)/i
    const p2 = /(\d+)\s*(?:lpa|lakhs?|lac)/i

    // Pattern 2: "7,00,000" or "700000" (Indian format)
    const p3 = /(\d{1,2}),(\d{2}),(\d{3})/  // 7,00,000
    const p4 = /(\d{5,7})/                   // 700000

    // Pattern 3: "7 thousand" "7k per year"
    const p5 = /(\d+)\s*(?:thousand|k)\s*(?:per year|pa|annually)?/i

    const src = text || t
    let salary = null

    if (p1.test(src)) {
      const m = src.match(p1)
      salary = m[1] + '-' + m[2] + ' LPA'
    } else if (p2.test(src)) {
      const m = src.match(p2)
      salary = m[1] + ' LPA'
    } else if (p3.test(src)) {
      // Convert 7,00,000 → 7 LPA
      const m = src.match(p3)
      const num = parseInt(m[0].replace(/,/g, ''))
      const lakhs = Math.round(num / 100000)
      salary = lakhs + ' LPA'
    } else if (p4.test(src)) {
      // Convert 700000 → 7 LPA
      const m = src.match(p4)
      const num = parseInt(m[1])
      if (num >= 100000) {
        const lakhs = Math.round(num / 100000)
        salary = lakhs + ' LPA'
      }
    } else if (p5.test(src)) {
      const m = src.match(p5)
      salary = m[1] + 'K PA'
    }

    if (salary) {
      updateProfileField('salary', salary)
      console.log('[Extract] Salary:', salary)
    }
  },

  extractEducation(t) {
    if (State.profile.education) return
    const eduMap = [
      ['B.Tech',    ['b.tech', 'btech', 'b tech']],
      ['M.Tech',    ['m.tech', 'mtech']],
      ['MBA',       ['mba']],
      ['BCA',       ['bca']],
      ['MCA',       ['mca']],
      ['B.Sc',      ['b.sc', 'bsc']],
      ['B.Com',     ['b.com', 'bcom']],
      ['B.E',       ['b.e ', 'be ']],
      ['Diploma',   ['diploma']],
      ['PhD',       ['phd', 'ph.d']],
      ['12th Pass', ['12th', 'hsc']],
      ['10th Pass', ['10th', 'sslc']],
      ['Graduate',  ['graduate', 'degree']]
    ]
    for (const [val, keys] of eduMap) {
      if (keys.some(k => t.includes(k))) {
        updateProfileField('education', val)
        return
      }
    }
  },

  extractSkills(t) {
    if (State.profile.skills) return
    const skillList = [
      'python', 'java', 'javascript', 'typescript',
      'sql', 'mysql', 'excel', 'tableau', 'power bi',
      'react', 'node', 'aws', 'azure', 'docker',
      'machine learning', 'data analysis', 'data entry',
      'accounting', 'tally', 'teaching', 'marketing',
      'sales', 'content writing', 'graphic design',
      'video editing', 'flutter', 'android', 'figma',
      'autocad', 'matlab', 'c++', 'php', 'wordpress'
    ]
    const found = skillList.filter(s => t.includes(s))
    if (found.length > 0) {
      const formatted = found.slice(0, 4).map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
      ).join(', ')
      updateProfileField('skills', formatted)
    }
  },

  extractLanguages(t) {
    if (State.profile.languages) return
    const langs = [
      'english', 'tamil', 'hindi', 'telugu',
      'kannada', 'malayalam', 'marathi', 'bengali',
      'gujarati', 'punjabi', 'urdu'
    ]
    const found = langs.filter(l => t.includes(l))
    if (found.length > 0) {
      const formatted = found.map(l =>
        l.charAt(0).toUpperCase() + l.slice(1)
      ).join(', ')
      updateProfileField('languages', formatted)
    }
  }
}
