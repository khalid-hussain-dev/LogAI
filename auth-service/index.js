/**
 * LogAI Auth Service — Node.js OAuth handler.
 *
 * Handles Google + GitHub OAuth dance, then issues JWT tokens
 * using the SAME JWT_SECRET_KEY as FastAPI. Redirects to
 * /auth/callback on the frontend with tokens in query params.
 *
 * This is evolved from the original LogAI---Backend/index.js,
 * adapted from session-based to JWT-based auth.
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import GoogleStrategyPkg from 'passport-google-oauth20'
import GitHubStrategyPkg from 'passport-github2'
import pg from 'pg'

const { Strategy: GoogleStrategy } = GoogleStrategyPkg
const { Strategy: GitHubStrategy } = GitHubStrategyPkg
const { Pool } = pg

const app = express()
const PORT = process.env.AUTH_SERVICE_PORT || 4001

// ── Configuration ───────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'CHANGE_ME'
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256'
const JWT_ACCESS_EXPIRE = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || '60')
const JWT_REFRESH_EXPIRE = parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRE_DAYS || '30')
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')

// ── PostgreSQL pool ─────────────────────────────────────────
const connectionString = process.env.DATABASE_URL
const pool = connectionString 
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'logai',
      user: process.env.POSTGRES_USER || 'logai',
      password: process.env.POSTGRES_PASSWORD || 'logai_secret_2025',
    })

// ── JWT helpers ─────────────────────────────────────────────
function createAccessToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'access' },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: `${JWT_ACCESS_EXPIRE}m` }
  )
}

function createRefreshToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: `${JWT_REFRESH_EXPIRE}d` }
  )
}

// ── Middleware ───────────────────────────────────────────────
app.use(express.json())
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(passport.initialize())

// Passport serialize/deserialize (stateless — we don't use sessions)
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

// ── Database: upsert OAuth user ─────────────────────────────
async function upsertOAuthUser(provider, oauthId, name, email, picture) {
  // Try to find by oauth_id + provider
  let result = await pool.query(
    'SELECT id, name, email, picture FROM users WHERE oauth_id = $1 AND auth_provider = $2',
    [oauthId, provider]
  )

  if (result.rows.length > 0) {
    const user = result.rows[0]
    // Update picture if changed
    if (picture && user.picture !== picture) {
      await pool.query('UPDATE users SET picture = $1 WHERE id = $2', [picture, user.id])
    }
    return user
  }

  // Try by email
  result = await pool.query('SELECT id, name, email, picture FROM users WHERE email = $1', [email])

  if (result.rows.length > 0) {
    const user = result.rows[0]
    // Link to OAuth
    await pool.query(
      'UPDATE users SET oauth_id = $1, auth_provider = $2, picture = COALESCE($3, picture) WHERE id = $4',
      [oauthId, provider, picture, user.id]
    )
    return user
  }

  // Create new user
  result = await pool.query(
    `INSERT INTO users (id, name, email, auth_provider, oauth_id, picture, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
     RETURNING id, name, email, picture`,
    [name, email || `${provider}_${oauthId}@logai.local`, provider, oauthId, picture]
  )

  return result.rows[0]
}

// ── Google OAuth strategy ───────────────────────────────────
const googleClientID = process.env.GOOGLE_CLIENT_ID || ''
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
const googleCallbackURL = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`
const isGoogleConfigured = Boolean(googleClientID && googleClientSecret)

if (isGoogleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: googleClientID,
    clientSecret: googleClientSecret,
    callbackURL: googleCallbackURL,
  }, (accessToken, refreshToken, profile, done) => {
    let picture = undefined
    if (profile.photos?.length > 0 && profile.photos[0].value) {
      picture = profile.photos[0].value
    } else if (profile._json?.picture) {
      picture = profile._json.picture
    }

    // Optimize Google picture size
    if (picture) {
      try {
        const url = new URL(picture)
        url.searchParams.set('sz', '400')
        picture = url.toString()
      } catch (e) { /* keep original */ }
    }

    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails?.[0]?.value,
      picture,
      provider: 'google',
    }
    return done(null, user)
  }))
}

// ── GitHub OAuth strategy ───────────────────────────────────
const githubClientID = process.env.GITHUB_CLIENT_ID || ''
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || ''
const githubCallbackURL = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/api/auth/github/callback`
const isGithubConfigured = Boolean(githubClientID && githubClientSecret)

if (isGithubConfigured) {
  passport.use('github', new GitHubStrategy({
    clientID: githubClientID,
    clientSecret: githubClientSecret,
    callbackURL: githubCallbackURL,
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: String(profile.id || profile._json?.id),
      name: profile.displayName || profile.username || profile._json?.name || profile._json?.login,
      email: profile.emails?.[0]?.value || profile._json?.email,
      picture: profile.photos?.[0]?.value || profile._json?.avatar_url,
      provider: 'github',
    }
    return done(null, user)
  }))
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Google OAuth ────────────────────────────────────────────
app.get('/api/auth/google', (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.status(500).send('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

app.get('/api/auth/google/callback', (req, res, next) => {
  if (!isGoogleConfigured) return res.status(500).send('Google OAuth not configured.')

  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/auth?error=google` }, async (err, oauthUser) => {
    if (err || !oauthUser) {
      console.error('Google auth error:', err || 'No user')
      return res.redirect(`${FRONTEND_URL}/auth?error=google`)
    }

    try {
      const user = await upsertOAuthUser(
        'google', oauthUser.id, oauthUser.name, oauthUser.email, oauthUser.picture
      )

      const accessToken = createAccessToken(String(user.id))
      const refreshToken = createRefreshToken(String(user.id))

      const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        name: user.name || '',
        email: user.email || '',
        picture: user.picture || '',
      })

      res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`)
    } catch (dbErr) {
      console.error('DB error during Google auth:', dbErr)
      res.redirect(`${FRONTEND_URL}/auth?error=server`)
    }
  })(req, res, next)
})

// ── GitHub OAuth ────────────────────────────────────────────
app.get('/api/auth/github', (req, res, next) => {
  if (!isGithubConfigured) {
    return res.status(500).send('GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.')
  }
  passport.authenticate('github', { scope: ['user:email'], session: false })(req, res, next)
})

app.get('/api/auth/github/callback', (req, res, next) => {
  if (!isGithubConfigured) return res.status(500).send('GitHub OAuth not configured.')

  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/auth?error=github` }, async (err, oauthUser) => {
    if (err || !oauthUser) {
      console.error('GitHub auth error:', err || 'No user')
      const errorMsg = err?.message || 'GitHub authentication failed'
      return res.redirect(`${FRONTEND_URL}/auth?error=github&msg=${encodeURIComponent(errorMsg)}`)
    }

    try {
      const user = await upsertOAuthUser(
        'github', oauthUser.id, oauthUser.name, oauthUser.email, oauthUser.picture
      )

      const accessToken = createAccessToken(String(user.id))
      const refreshToken = createRefreshToken(String(user.id))

      const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        name: user.name || '',
        email: user.email || '',
        picture: user.picture || '',
      })

      res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`)
    } catch (dbErr) {
      console.error('DB error during GitHub auth:', dbErr)
      res.redirect(`${FRONTEND_URL}/auth?error=server`)
    }
  })(req, res, next)
})

// ── Health check ────────────────────────────────────────────
app.get('/api/auth/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})

// ── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Auth service listening on http://localhost:${PORT}`)
  console.log(`  Google OAuth: ${isGoogleConfigured ? 'configured' : 'not configured'}`)
  console.log(`  GitHub OAuth: ${isGithubConfigured ? 'configured' : 'not configured'}`)
  console.log(`  Frontend URL: ${FRONTEND_URL}`)
})

