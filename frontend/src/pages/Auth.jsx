import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Github, ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { brandAssets } from '../assets/brand'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'

function LoginForm({ onSwitch }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const navigate = useNavigate()
  const { login, loginWithGoogle, loginWithGithub } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!email) newErrors.email = 'Email is required'
    if (!password) newErrors.password = 'Password is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setIsLoading(true)
    setApiError('')
    const result = await login(email, password)
    setIsLoading(false)
    if (result?.success) {
      navigate('/architecture', { replace: true })
    } else {
      setApiError(result?.error || 'Login failed. Please check your credentials.')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">
      <div className="space-y-2">
        <motion.div className="flex items-center gap-3 mb-6" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <img src={brandAssets.mainLogo} alt="LogAI" className="h-14 w-auto rounded-2xl object-contain shadow-2xl shadow-cyan-500/10" />
        </motion.div>
        <h1 className="text-4xl font-bold text-white">Welcome back</h1>
        <p className="text-slate-400 text-lg">Sign in to your LogAI account to continue</p>
      </div>

      {apiError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {apiError}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-200 text-base">Email address</Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input id="email" type="email" placeholder="you@company.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }) }}
              className={`pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${errors.email ? 'border-red-500/50' : ''}`} />
          </div>
          {errors.email && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">{errors.email}</motion.p>}
              </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-200 text-base">Password</Label>
            <a href="#" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</a>
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input id="password" type="password" placeholder="Enter your password" value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: undefined }) }}
              className={`pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${errors.password ? 'border-red-500/50' : ''}`} />
                </div>
          {errors.password && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">{errors.password}</motion.p>}
              </div>

        <Button type="submit" disabled={isLoading}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 group relative overflow-hidden">
          <span className="relative z-10 flex items-center justify-center">
            {isLoading ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2" />Signing in...</>
            ) : (
              <>Sign in<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></>
            )}
          </span>
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
        <div className="relative flex justify-center text-sm"><span className="px-4 bg-slate-950 text-slate-500">Or continue with</span></div>
      </div>

      {/* SSO Buttons */}
      <div className="space-y-3">
        <Button type="button" variant="outline"
          className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all duration-300 group"
          onClick={() => loginWithGithub()}>
          <Github className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
          Continue with GitHub
        </Button>
        <Button type="button" variant="outline"
          className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all duration-300 group"
          onClick={() => loginWithGoogle()}>
          <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>
      </div>

      <div className="text-center">
        <p className="text-slate-400 text-base">Don't have an account?{' '}
          <button onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign up for free</button>
        </p>
      </div>

      <div className="pt-6 border-t border-white/10">
        <p className="text-xs text-center text-slate-500 mb-3">Trusted by engineering teams worldwide</p>
                </div>
    </motion.div>
  )
}

function SignupForm({ onSwitch }) {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', agreeToTerms: false })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const navigate = useNavigate()
  const { signup, loginWithGoogle, loginWithGithub } = useAuth()

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value })
    setErrors({ ...errors, [field]: undefined })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!formData.name) newErrors.name = 'Full name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.password) newErrors.password = 'Password is required'
    if (formData.password && formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (!formData.agreeToTerms) newErrors.terms = 'You must agree to the terms'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setIsLoading(true)
    setApiError('')
    const result = await signup(formData.email, formData.password, formData.name)
    setIsLoading(false)
    if (result?.success) {
      navigate('/architecture', { replace: true })
    } else {
      setApiError(result?.error || 'Signup failed. Please try again.')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">
      <div className="space-y-2">
        <motion.div className="flex items-center gap-3 mb-6" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <img src={brandAssets.mainLogo} alt="LogAI" className="h-14 w-auto rounded-2xl object-contain shadow-2xl shadow-cyan-500/10" />
        </motion.div>
        <h1 className="text-4xl font-bold text-white">Create your account</h1>
        <p className="text-slate-400 text-lg">Start analyzing your logs with AI in minutes</p>
      </div>

      {apiError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {apiError}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-200 text-base">Full name</Label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input id="name" type="text" placeholder="John Doe" value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${errors.name ? 'border-red-500/50' : ''}`} />
          </div>
          {errors.name && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">{errors.name}</motion.p>}
          </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-slate-200 text-base">Work email</Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input id="signup-email" type="email" placeholder="you@company.com" value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={`pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${errors.email ? 'border-red-500/50' : ''}`} />
          </div>
          {errors.email && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">{errors.email}</motion.p>}
            </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-slate-200 text-base">Password</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input id="signup-password" type="password" placeholder="Create a strong password" value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={`pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 ${errors.password ? 'border-red-500/50' : ''}`} />
              </div>
          {errors.password && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">{errors.password}</motion.p>}
          {!errors.password && formData.password && <p className="text-xs text-slate-500">Must be at least 8 characters</p>}
              </div>

        <div className="flex items-start gap-3">
          <Checkbox id="terms" checked={formData.agreeToTerms}
            onCheckedChange={(checked) => updateField('agreeToTerms', checked)}
            className={`mt-1 border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 ${errors.terms ? 'border-red-500' : ''}`} />
          <div className="flex-1">
            <label htmlFor="terms" className="text-sm text-slate-300 cursor-pointer">
              I agree to the <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</a> and <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</a>
            </label>
            {errors.terms && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 mt-1">{errors.terms}</motion.p>}
                </div>
              </div>

        <Button type="submit" disabled={isLoading}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 group relative overflow-hidden">
          <span className="relative z-10 flex items-center justify-center">
            {isLoading ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full mr-2" />Creating account...</>
            ) : (
              <>Create account<ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" /></>
            )}
                </span>
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
        <div className="relative flex justify-center text-sm"><span className="px-4 bg-slate-950 text-slate-500">Or sign up with</span></div>
      </div>

      {/* SSO Buttons */}
      <div className="space-y-3">
        <Button type="button" variant="outline"
          className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all duration-300 group"
          onClick={() => loginWithGithub()}>
          <Github className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
          Sign up with GitHub
        </Button>
        <Button type="button" variant="outline"
          className="w-full h-12 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white transition-all duration-300 group"
          onClick={() => loginWithGoogle()}>
          <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </Button>
      </div>

      <div className="text-center">
        <p className="text-slate-400 text-base">Already have an account?{' '}
          <button onClick={onSwitch} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign in</button>
        </p>
      </div>

      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>Your data is encrypted and secure</span>
                </div>
              </div>
    </motion.div>
  )
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated && !isLoading) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const errorParam = searchParams.get('error')

  return (
    <AuthLayout>
      {errorParam && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          OAuth error: {searchParams.get('msg') || `${errorParam} authentication failed.`}
        </motion.div>
      )}
      {isLogin
        ? <LoginForm onSwitch={() => setIsLogin(false)} />
        : <SignupForm onSwitch={() => setIsLogin(true)} />
      }
    </AuthLayout>
  )
}
