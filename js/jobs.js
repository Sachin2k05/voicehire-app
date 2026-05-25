/* ─────────────────────────────────────────────
   jobs.js  —  JobService
   Phase 5: Adzuna live API + match scoring +
   speech formatting. Falls back to static data
   when API keys are not configured.
   ───────────────────────────────────────────── */

const JobService = {

  formatSalary(min, max) {
    if (!min && !max) return 'Salary not specified'
    const toL = n => (n / 100000).toFixed(1) + 'L'
    if (min && max) return `₹${toL(min)}–${toL(max)} PA`
    if (min) return `₹${toL(min)}+ PA`
    return `Up to ₹${toL(max)} PA`
  },

  calcMatch(job) {
    let score = 50
    const jobText = `${job.title} ${job.company} ${job.location} ${job.description || ''}`.toLowerCase()

    // Skill matching
    const skills = (State.profile.skills || '').toLowerCase().split(',')
    skills.forEach(s => {
      const skill = s.trim()
      if (skill && jobText.includes(skill)) score += 15
    })

    // Location matching
    const loc = (State.profile.location || '').toLowerCase()
    if (loc && (jobText.includes(loc) || jobText.includes('remote'))) score += 20

    // Job type matching
    const type = (State.profile.jobType || '').toLowerCase()
    if (type && jobText.includes(type)) score += 10

    return Math.min(Math.max(score, 50), 99)
  },

  async search() {
    /* ── Try Adzuna live API first ── */
    if (typeof ADZUNA_APP_ID !== 'undefined' &&
      ADZUNA_APP_ID !== 'PASTE_YOUR_ADZUNA_APP_ID') {
      try {
        const results = await this._searchAdzuna()
        if (results && results.length > 0) {
          return results
        }
      } catch (e) {
        console.warn('Adzuna API failed or returned CORS error, falling back to local demo jobs:', e)
      }
    }

    /* ── Fallback: local job database ── */
    return this._searchLocal()
  },

  async _searchAdzuna() {
    const skills = (State.profile.skills || 'developer')
      .split(',')[0].trim()
    const loc = State.profile.location === 'Remote'
      ? 'india' : (State.profile.location || 'india')

    // Use our own backend to avoid CORS
    const response = await fetch(
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : 'https://voicehire-backend.onrender.com') +
      '/api/jobs/search' +
      '?skills=' + encodeURIComponent(skills) +
      '&location=' + encodeURIComponent(loc)
    )

    if (!response.ok) throw new Error('Backend proxy failed: ' + response.status)

    const data = await response.json()
    if (!data.success) throw new Error(data.error)

    const results = data.results || []

    if (!results || results.length === 0) return []

    return results
      .map(function (j) {
        return {
          id: j.id,
          title: j.title,
          company: j.company?.display_name || 'Company',
          location: j.location?.display_name || loc,
          salary: JobService.formatSalary(j.salary_min, j.salary_max),
          description: (j.description || '').slice(0, 200),
          type: 'Full-time',
          match: JobService.calcMatch(j)
        }
      })
      .sort(function (a, b) { return b.match - a.match })
      .slice(0, 6)
  },

  _searchLocal() {
    /* Local database for demo / offline use with required fallback companies */
    const DB = [
      {
        id: 1, title: 'Software Engineer',
        company: 'Infosys', location: 'Bangalore',
        type: 'Full-time', salary: '₹4.0L–₹8.0L PA',
        description: 'Design and develop scalable enterprise software solutions using Java, Python, and JavaScript.'
      },
      {
        id: 2, title: 'Frontend Developer',
        company: 'Zoho', location: 'Chennai',
        type: 'Full-time', salary: '₹5.0L–₹10.0L PA',
        description: 'Build fast and responsive user interfaces for modern web applications using React, HTML, CSS, and JavaScript.'
      },
      {
        id: 3, title: 'Data Analyst',
        company: 'Cognizant', location: 'Hyderabad',
        type: 'Full-time', salary: '₹3.5L–₹6.5L PA',
        description: 'Analyze data to discover trends and provide actionable business insights using SQL, Excel, and Power BI.'
      },
      {
        id: 4, title: 'Customer Support Executive',
        company: 'Zoho', location: 'Remote',
        type: 'Full-time', salary: '₹2.0L–₹4.0L PA',
        description: 'Handle customer queries via voice and chat with excellent communication in English and local languages.'
      },
      {
        id: 5, title: 'System Administrator',
        company: 'Infosys', location: 'Pune',
        type: 'Full-time', salary: '₹4.5L–₹7.5L PA',
        description: 'Manage and maintain IT infrastructure, networking, and cloud services (AWS, Azure).'
      },
      {
        id: 6, title: 'Quality Assurance Tester',
        company: 'Cognizant', location: 'Remote',
        type: 'Full-time', salary: '₹3.0L–₹6.0L PA',
        description: 'Perform manual and automated testing for web and mobile applications.'
      },
      {
        id: 7, title: 'Sales Executive',
        company: 'Zoho', location: 'Delhi',
        type: 'Full-time', salary: '₹3.0L–₹5.0L PA',
        description: 'Drive B2B software sales through calls, meetings, and product demonstrations.'
      },
      {
        id: 8, title: 'Marketing Specialist',
        company: 'Infosys', location: 'Mumbai',
        type: 'Full-time', salary: '₹4.0L–₹6.0L PA',
        description: 'Develop and execute digital marketing campaigns, SEO, and social media strategies.'
      }
    ]

    /* Score and sort using unified calcMatch */
    return DB
      .map(job => ({
        ...job,
        match: this.calcMatch(job)
      }))
      .sort((a, b) => b.match - a.match)
      .slice(0, 6)
  },

  toSpeech(job, index, total) {
    return `Job ${index + 1} of ${total}. ` +
      `${job.title} at ${job.company}. ` +
      `Located in ${job.location}. ` +
      `${job.salary}. ` +
      `This is a ${job.match} percent match for your profile. ` +
      `Shall I apply or tell you more?`
  }
}
