import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import passport from 'passport'
import GoogleStrategyPkg from 'passport-google-oauth20'
import GitHubStrategyPkg from 'passport-github2'

const { Strategy: GoogleStrategy } = GoogleStrategyPkg
const { Strategy: GitHubStrategy } = GitHubStrategyPkg

const app = express()
const PORT = process.env.PORT || 4001

// Middleware
app.use(express.json())
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.set('trust proxy', 1)
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Always false for localhost
    sameSite: 'lax', // Changed to 'lax' for OAuth redirects
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/' // Ensure cookie is available at root path
    // domain removed - let Express handle it automatically
  }
}))
app.use(passport.initialize())
app.use(passport.session())

// Passport serialize/deserialize
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

// Google OAuth strategy
const googleClientID = process.env.GOOGLE_CLIENT_ID || ''
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
const googleCallbackURL = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/api/auth/google/callback'
const isGoogleConfigured = Boolean(googleClientID && googleClientSecret)

if (isGoogleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: googleClientID,
    clientSecret: googleClientSecret,
    callbackURL: googleCallbackURL
  }, (accessToken, refreshToken, profile, done) => {
    // Log the full profile structure to debug
    console.log('Google profile received - Full structure:')
    console.log('  profile.photos:', profile.photos)
    console.log('  profile._json:', profile._json)
    console.log('  profile._json?.picture:', profile._json?.picture)
    console.log('  profile._json?.photos:', profile._json?.photos)
    
    // Extract picture from profile - check all possible locations
    let picture = undefined
    
    // Try profile.photos array first (standard passport-google-oauth20 structure)
    if (profile.photos && profile.photos.length > 0 && profile.photos[0].value) {
      picture = profile.photos[0].value
      console.log('  Found picture in profile.photos[0].value:', picture)
    }
    // Try profile._json.picture (alternative structure)
    else if (profile._json?.picture) {
      picture = profile._json.picture
      console.log('  Found picture in profile._json.picture:', picture)
    }
    // Try profile._json.photos array
    else if (profile._json?.photos && profile._json.photos.length > 0 && profile._json.photos[0].value) {
      picture = profile._json.photos[0].value
      console.log('  Found picture in profile._json.photos[0].value:', picture)
    }
    // Try accessing Google People API format
    else if (profile._json?.image?.url) {
      picture = profile._json.image.url
      console.log('  Found picture in profile._json.image.url:', picture)
    }
    
    // If we found a picture, ensure it's a full-size image (modify size parameter if present)
    if (picture) {
      try {
        const url = new URL(picture)
        // Google profile pictures: remove or modify 'sz' parameter to get larger image
        // Default sz=50 is small, let's get sz=400 for better quality
        url.searchParams.set('sz', '400')
        picture = url.toString()
        console.log('  Optimized picture URL (set size to 400):', picture)
      } catch (e) {
        // If URL parsing fails, keep original picture URL
        console.log('  Using original picture URL (could not parse):', picture)
      }
    }
    
    // If no picture found, log warning
    if (!picture) {
      console.warn('  WARNING: No profile picture found in Google profile!')
      console.warn('  Full profile object:', JSON.stringify(profile, null, 2))
    }
    
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : undefined,
      picture: picture,
      provider: 'google'
    }
    
    console.log('Google user object created:', JSON.stringify(user, null, 2))
    return done(null, user)
  }))
}

// GitHub OAuth strategy
const githubClientID = process.env.GITHUB_CLIENT_ID || ''
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || ''
const githubCallbackURL = process.env.GITHUB_REDIRECT_URI || 'http://localhost:4001/api/auth/github/callback'
const isGithubConfigured = Boolean(githubClientID && githubClientSecret)

if (isGithubConfigured) {
  console.log('GitHub OAuth configured:')
  console.log('  Client ID:', githubClientID.substring(0, 10) + '...')
  console.log('  Client Secret:', githubClientSecret ? githubClientSecret.substring(0, 10) + '...' : 'MISSING')
  console.log('  Callback URL:', githubCallbackURL)
  
  passport.use('github', new GitHubStrategy({
    clientID: githubClientID,
    clientSecret: githubClientSecret,
    callbackURL: githubCallbackURL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('GitHub profile received:', JSON.stringify(profile, null, 2))
      
      // GitHub profile structure
      const user = {
        id: profile.id || profile._json?.id,
        name: profile.displayName || profile.username || profile._json?.name || profile._json?.login,
        email: profile.emails?.[0]?.value || profile._json?.email,
        picture: profile.photos?.[0]?.value || profile._json?.avatar_url,
        provider: 'github'
      }
      
      console.log('GitHub user object created:', user)
      return done(null, user)
    } catch (error) {
      console.error('Error processing GitHub profile:', error)
      return done(error, null)
    }
  }))
}

// Email/password mock storage (replace with real DB)
const users = new Map()

// Routes
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).send('Missing credentials')
  const existing = users.get(email)
  if (!existing || existing.password !== password) return res.status(401).send('Invalid email or password')
  req.session.user = { id: existing.id, name: existing.name, email }
  return res.json({ success: true, user: req.session.user })
})

app.post('/api/signup', (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password || !name) return res.status(400).send('Missing fields')
  if (users.has(email)) return res.status(409).send('Email already exists')
  const id = `u_${Date.now()}`
  users.set(email, { id, name, password })
  req.session.user = { id, name, email }
  return res.json({ success: true, user: req.session.user })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid')
    res.json({ success: true })
  })
})

app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Unauthorized')
  }
  console.log('GET /api/me - User data:', JSON.stringify(req.session.user, null, 2))
  return res.json(req.session.user)
})

// Google OAuth routes
app.get('/api/auth/google', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(500).send('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env and restart.')
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
})

app.get('/api/auth/google/callback', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(500).send('Google OAuth not configured.')
  }
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/auth?error=google' }, (err, user, info) => {
    if (err || !user) {
      console.error('Google auth error:', err || 'No user returned')
      return res.redirect('http://localhost:5173/auth?error=google')
    }
    // Log in the user
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Login error:', loginErr)
        return res.redirect('http://localhost:5173/auth?error=session')
      }
      // Set user in session
      req.session.user = user
      console.log('Google auth success - Session user set:', JSON.stringify(req.session.user, null, 2))
      // Explicitly save session before redirect
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr)
          return res.redirect('http://localhost:5173/auth?error=session')
        }
        console.log('Session saved successfully with user picture:', req.session.user?.picture)
        res.redirect('http://localhost:5173/dashboard')
      })
    })
  })(req, res, next)
})

// GitHub OAuth routes
app.get('/api/auth/github', (req, res, next) => {
  if (!isGithubConfigured) {
    return res.status(500).send('GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env and restart.')
  }
  return passport.authenticate('github', { scope: ['user:email'] })(req, res, next)
})

app.get('/api/auth/github/callback', (req, res, next) => {
  if (!isGithubConfigured) {
    return res.status(500).send('GitHub OAuth not configured.')
  }
  
  console.log('GitHub callback received')
  console.log('  Query params:', req.query)
  console.log('  Expected callback URL:', githubCallbackURL)
  
  passport.authenticate('github', { 
    failureRedirect: 'http://localhost:5173/auth?error=github',
    session: false // We'll handle session manually
  }, (err, user, info) => {
    if (err) {
      console.error('GitHub auth error:', err)
      console.error('  Error details:', {
        message: err.message,
        statusCode: err.statusCode,
        data: err.data
      })
      
      let errorMsg = 'GitHub authentication failed'
      if (err.message.includes('access token')) {
        errorMsg = 'Failed to obtain access token. Please check your GitHub OAuth app credentials and callback URL.'
      } else if (err.message) {
        errorMsg = err.message
      }
      
      return res.redirect('http://localhost:5173/auth?error=github&msg=' + encodeURIComponent(errorMsg))
    }
    if (!user) {
      console.error('GitHub auth: No user returned. Info:', info)
      return res.redirect('http://localhost:5173/auth?error=github&msg=' + encodeURIComponent('No user returned from GitHub'))
    }
    console.log('GitHub auth success. User:', user)
    // Log in the user
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Login error:', loginErr)
        return res.redirect('http://localhost:5173/auth?error=session')
      }
      // Set user in session
      req.session.user = user
      console.log('Session user set:', req.session.user)
      // Explicitly save session before redirect
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr)
          return res.redirect('http://localhost:5173/auth?error=session')
        }
        console.log('Session saved successfully. Redirecting to dashboard...')
        res.redirect('http://localhost:5173/dashboard')
      })
    })
  })(req, res, next)
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

