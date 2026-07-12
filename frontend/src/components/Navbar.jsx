import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ currentServer, setCurrentServer, onChatToggle, chatActive }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const lastPictureRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setDropdownOpen(false)
      setProfileDropdownOpen(false)
    }
    if (dropdownOpen || profileDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [dropdownOpen, profileDropdownOpen])

  const handleServerSelect = (serverName) => {
    setCurrentServer(serverName)
    setDropdownOpen(false)
  }

  const handleAddServer = () => {
    setDropdownOpen(false)
    navigate('/servers')
  }

  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return 'U'
  }

  const handleImageError = () => {
    // If image fails to load, show initials instead
    setImageError(true)
    setImageLoading(false)
  }

  const handleImageLoad = () => {
    // Image loaded successfully
    setImageLoading(false)
    setImageError(false)
  }

  // Reset image error/loading state only when picture URL actually changes
  useEffect(() => {
    const currentPicture = user?.picture
    
    // Only reset if the picture URL has actually changed
    if (currentPicture !== lastPictureRef.current) {
      lastPictureRef.current = currentPicture
      
      // Reset states based on whether we have a picture
      if (currentPicture) {
        setImageError(false)
        setImageLoading(true)
      } else {
        setImageError(false)
        setImageLoading(false)
      }
      
    }
  }, [user?.picture])

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        {/* Left Section - Server Selector & Search */}
        <div className="flex items-center gap-4">
          {/* Server Dropdown */}
          {currentServer && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDropdownOpen(!dropdownOpen)
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span>{currentServer}</span>
                <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[180px] z-50 py-1"
                >
                  <div
                    onClick={() => handleServerSelect('Server 1')}
                    className={`px-4 py-2.5 cursor-pointer transition-colors ${
                      currentServer === 'Server 1' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Server 1</span>
                      {currentServer === 'Server 1' && <span className="text-blue-600">✓</span>}
                    </div>
                  </div>
                  <div
                    onClick={() => handleServerSelect('Server 2')}
                    className={`px-4 py-2.5 cursor-pointer transition-colors ${
                      currentServer === 'Server 2' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Server 2</span>
                      {currentServer === 'Server 2' && <span className="text-blue-600">✓</span>}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <div
                      onClick={handleAddServer}
                      className="px-4 py-2.5 font-medium cursor-pointer hover:bg-gray-50 flex items-center gap-2 text-blue-600 transition-colors"
                    >
                      <span>+</span>
                      <span>Add new server</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              className="w-64 pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Right Section - Icons & Profile */}
        <div className="flex items-center gap-3">
          {/* Chat Icon */}
          <button
            onClick={onChatToggle}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
              chatActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="AI Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {chatActive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {/* Notification Icon */}
          <button className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center relative" title="Notifications">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setProfileDropdownOpen(!profileDropdownOpen)
              }}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold flex items-center justify-center hover:shadow-lg transition-all"
              title="Profile"
            >
              {user?.picture && !imageError ? (
                <img
                  src={user.picture}
                  alt={user.name || 'Profile'}
                  className="w-full h-full rounded-lg object-cover"
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  loading="lazy"
                />
              ) : (
                <span className="text-sm">{getInitials()}</span>
              )}
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[260px] z-50 overflow-hidden"
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {user?.picture && !imageError ? (
                      <img
                        src={user.picture}
                        alt={user.name || 'Profile'}
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold flex items-center justify-center text-sm">
                        {getInitials()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {user?.name || 'User'}
                      </div>
                      {user?.email && (
                        <div className="text-xs text-gray-500 truncate">
                          {user.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false)
                      navigate('/settings')
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false)
                      navigate('/settings')
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false)
                      logout()
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
