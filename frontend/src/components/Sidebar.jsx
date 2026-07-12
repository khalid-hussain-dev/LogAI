import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { brandAssets } from '../assets/brand'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedSections, setExpandedSections] = useState({})

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const menuItems = [
    {
      id: 'dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      label: 'Dashboard',
      path: '/dashboard'
    },
    {
      id: 'servers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
      label: 'Servers',
      path: '/servers'
    },
    {
      id: 'logs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: 'Logs',
      path: '/logs'
    },
    {
      id: 'analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      label: 'Analytics',
      path: '/analytics',
      hasSubmenu: true,
      submenu: [
        { label: 'Overview', path: '/analytics/overview' },
        { label: 'Reports', path: '/analytics/reports' }
      ]
    },
    {
      id: 'alerts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      label: 'Alerts',
      path: '/alerts',
      badge: '23'
    },
    {
      id: 'settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: 'Settings',
      path: '/settings'
    }
  ]

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={brandAssets.dashboardLogo} alt="LogAI" className="w-full h-full object-contain" />
          </div>
          <span className="text-xl font-bold text-gray-900">LogAI</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              {/* Main Menu Item */}
              <button
                onClick={() => {
                  if (item.hasSubmenu) {
                    toggleSection(item.id)
                  } else {
                    navigate(item.path)
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all group ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive(item.path) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}>
                    {item.icon}
                  </span>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.hasSubmenu && (
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        expandedSections[item.id] ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Submenu */}
              {item.hasSubmenu && expandedSections[item.id] && (
                <ul className="mt-1 ml-8 space-y-1">
                  {item.submenu.map((subItem, index) => (
                    <li key={index}>
                      <button
                        onClick={() => navigate(subItem.path)}
                        className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                          isActive(subItem.path)
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {subItem.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer - Upgrade Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="text-sm font-semibold mb-1">Upgrade to Pro</div>
          <p className="text-xs text-blue-100 mb-3">Get access to all features</p>
          <button className="w-full bg-white text-blue-600 text-sm font-semibold py-2 rounded-lg hover:bg-blue-50 transition-colors">
            Upgrade Now
          </button>
        </div>
      </div>
    </aside>
  )
}
