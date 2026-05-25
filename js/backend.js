const BACKEND_URL = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://voicehire-backend.onrender.com'
const BackendService = {

  token: null,
  userId: null,

  init() {
    this.token = localStorage.getItem('vh_token')
    this.userId = localStorage.getItem('vh_userId')
    console.log('[Backend] Token exists:', !!this.token)
  },

  async registerOrLogin(name, displayName) {
    try {
      // Create a clean unique identifier from name
      const cleanName = (name || 'guest')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 12)

      // Add timestamp to avoid duplicates
      const identifier = cleanName +
        Date.now().toString().slice(-4)

      console.log('[Backend] Auth attempt:', identifier)

      const res = await fetch(
        BACKEND_URL + '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: displayName || name || 'Guest',
            phone: identifier
          })
        }
      )

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error('[Backend] Parse error:', text)
        return { success: false, isReturning: false }
      }

      if (!res.ok) {
        console.error('[Backend] Register failed:', data)
        return { success: false, isReturning: false }
      }

      if (data.success) {
        this.token = data.token
        this.userId = data.user.id
        localStorage.setItem('vh_token', data.token)
        localStorage.setItem('vh_userId', data.user.id)
        console.log('[Backend] Auth OK ✓')

        if (!data.isNew && data.profile &&
          data.profile.name) {
          return {
            success: true,
            isReturning: true,
            profile: data.profile
          }
        }
      }

      return { success: data.success, isReturning: false }

    } catch (err) {
      console.error('[Backend] Auth error:', err.message)
      return { success: false, isReturning: false }
    }
  },

  async saveProfile(profile) {
    if (!this.token) {
      console.warn('[Backend] No token — skip save')
      return false
    }
    try {
      const res = await fetch(
        BACKEND_URL + '/api/profile',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.token
          },
          body: JSON.stringify(profile)
        }
      )
      const data = await res.json()
      console.log('[Backend] Profile saved:', data.success)
      return data.success
    } catch (err) {
      console.error('[Backend] Save profile error:', err)
      return false
    }
  },

  async saveMessage(role, content) {
    if (!this.token) return false
    try {
      await fetch(
        BACKEND_URL + '/api/conversation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.token
          },
          body: JSON.stringify({ role, content })
        }
      )
      return true
    } catch (err) {
      return false
    }
  },

  async saveApplication(job, reference) {
    if (!this.token) {
      console.warn('[Backend] No token — skip application save')
      return false
    }
    try {
      const res = await fetch(
        BACKEND_URL + '/api/applications',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.token
          },
          body: JSON.stringify({
            company: job.company || 'Unknown',
            role: job.title || 'Unknown',
            location: job.location || 'Unknown',
            salary: job.salary || 'Not specified',
            jobUrl: job.url || null,
            reference: reference
          })
        }
      )
      const data = await res.json()
      console.log('[Backend] Application saved:', data.success)
      return data.success
    } catch (err) {
      console.error('[Backend] Save app error:', err)
      return false
    }
  },

  async getApplications() {
    if (!this.token) return []
    try {
      const res = await fetch(
        BACKEND_URL + '/api/applications',
        {
          headers: {
            'Authorization': 'Bearer ' + this.token
          }
        }
      )
      const data = await res.json()
      return data.applications || []
    } catch (err) {
      return []
    }
  },

  isLoggedIn() { return !!this.token },

  logout() {
    this.token = null
    this.userId = null
    localStorage.removeItem('vh_token')
    localStorage.removeItem('vh_userId')
  }
}

BackendService.init()
