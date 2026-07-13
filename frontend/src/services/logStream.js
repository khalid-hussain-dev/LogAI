import { useEffect, useRef, useState } from 'react'
import { getAccessToken } from './token'

const RECONNECT_DELAY_MS = 3000

function buildWebSocketUrl(serverId) {
  const token = getAccessToken()
  if (!token) return null

  const backendUrl = import.meta.env.VITE_BACKEND_URL
  let url
  if (backendUrl) {
    const wsBase = backendUrl.replace(/^http/, 'ws')
    url = new URL('/ws', wsBase)
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    url = new URL('/ws', window.location.origin)
    url.protocol = protocol
  }
  url.searchParams.set('token', token)
  if (serverId) url.searchParams.set('server_id', serverId)
  return url.toString()
}

export function useLogStream({ serverId, enabled = true, onLog, onAnomaly }) {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const handlersRef = useRef({ onLog, onAnomaly })
  const manualCloseRef = useRef(false)
  const [connectionState, setConnectionState] = useState(enabled ? 'connecting' : 'idle')

  useEffect(() => {
    handlersRef.current = { onLog, onAnomaly }
  }, [onLog, onAnomaly])

  useEffect(() => {
    if (!enabled) {
      setConnectionState('idle')
      return undefined
    }

    let shouldReconnect = true
    manualCloseRef.current = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const cleanupSocket = () => {
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (manualCloseRef.current || !shouldReconnect) return
      clearReconnectTimer()
      setConnectionState('reconnecting')
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, RECONNECT_DELAY_MS)
    }

    const connect = () => {
      const websocketUrl = buildWebSocketUrl(serverId)
      if (!websocketUrl) {
        setConnectionState('unauthenticated')
        return
      }

      clearReconnectTimer()
      cleanupSocket()
      setConnectionState((state) => (state === 'reconnecting' ? state : 'connecting'))

      const socket = new WebSocket(websocketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setConnectionState('connected')
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload?.type === 'log') handlersRef.current.onLog?.(payload.data)
          if (payload?.type === 'anomaly') handlersRef.current.onAnomaly?.(payload.data)
        } catch {
          // Ignore malformed frames and keep the stream alive.
        }
      }

      socket.onerror = () => {
        setConnectionState('error')
      }

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        if (manualCloseRef.current || !shouldReconnect) {
          setConnectionState('closed')
          return
        }
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      manualCloseRef.current = true
      clearReconnectTimer()
      cleanupSocket()
      setConnectionState('closed')
    }
  }, [enabled, serverId])

  return { connectionState }
}
