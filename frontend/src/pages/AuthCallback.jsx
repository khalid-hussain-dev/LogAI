import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { setTokens } from '../services/token'
import LoadingScreen from '../components/LoadingScreen'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const processCallback = async () => {
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        navigate(`/auth?error=${errorParam}&msg=${searchParams.get('msg') || ''}`, { replace: true })
        return
      }
      if (!accessToken || !refreshToken) {
        navigate('/auth?error=missing_tokens', { replace: true })
        return
      }

      setTokens(accessToken, refreshToken)
      const result = await refreshUser()
      if (result?.success) {
        navigate('/architecture', { replace: true })
      } else {
        setError('Failed to load user profile. Redirecting...')
        setTimeout(() => navigate('/auth', { replace: true }), 2500)
      }
    }
    processCallback()
  }, [searchParams, navigate, refreshUser])

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center dark" style={{ backgroundColor: '#0B1220' }}>
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-gray-500 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <LoadingScreen message="Signing you in..." />
}
