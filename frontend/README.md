# LogAI - Frontend

A modern, intelligent log management and analytics platform built with React and Vite. LogAI helps you monitor, analyze, and understand your server logs with AI-powered insights.

## ✨ Features

### 🔐 Authentication
- **Email/Password Authentication** - Traditional login and signup
- **OAuth Integration** - Login with Google and GitHub
- **Protected Routes** - Secure client-side route protection
- **Session Management** - Persistent authentication state

### 📊 Dashboard & Analytics
- **Modern Dashboard** - Beautiful overview with key metrics
- **Real-time Charts** - Interactive donut charts, bar graphs, and gauges
- **Log Severity Tracking** - Visual breakdown of Critical, Error, Warning, and Info logs
- **Error Trends** - Weekly error analysis with hover tooltips
- **Server Health Monitoring** - Uptime tracking and health metrics
- **Response Time Analytics** - Performance monitoring with gauge visualization

### 🎨 UI/UX
- **Sidebar Navigation** - Clean left sidebar with expandable menus
- **Top Navigation Bar** - Server selector, search, notifications, and profile
- **Responsive Design** - Works seamlessly on desktop and mobile
- **Modern Components** - Beautiful UI with Tailwind CSS and Framer Motion
- **Dark/Light Theme Ready** - Prepared for theme switching

### 🤖 AI Features
- **AI Chat Engine** - Integrated chat for log analysis
- **Intelligent Insights** - AI-powered log understanding
- **Quick Actions** - Chat toggle in navigation

### 📁 Log Management
- **Multiple Servers** - Support for multiple server configurations
- **Server Switching** - Easy dropdown server selector
- **Log Search** - Quick search functionality
- **Alert System** - Real-time alerts with badge notifications

## 🛠 Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Lightning-fast build tool
- **React Router DOM** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations
- **SVG Charts** - Custom-built chart visualizations

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- LogAI Backend running (optional for development)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/NavrozSalim/LogAI---Frontend.git
cd LogAI---Frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 📂 Project Structure

```
LogAI---Frontend/
├── src/
│   ├── assets/          # Images and static files
│   ├── components/      # Reusable components
│   │   ├── Navbar.jsx   # Top navigation bar
│   │   ├── Sidebar.jsx  # Left sidebar navigation
│   │   └── ChatEngine.jsx  # AI chat component
│   ├── context/         # React context providers
│   │   └── AuthContext.jsx  # Authentication context
│   ├── pages/           # Page components
│   │   ├── Auth.jsx     # Login/Signup page
│   │   ├── Dashboard.jsx  # Main dashboard
│   │   ├── Servers.jsx  # Server management
│   │   ├── Logs.jsx     # Log viewer
│   │   └── Settings.jsx  # Settings page
│   ├── services/        # API services
│   │   ├── api.js       # API endpoints
│   │   └── auth.js      # Auth services
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── index.html
├── vite.config.js
└── tailwind.config.js
```

## 🔌 Backend Integration

This frontend is designed to work with the LogAI Backend service.

### Environment Variables (Optional)

Create a `.env.local` file for custom configuration:

```env
VITE_API_URL=http://localhost:4001/api
VITE_API_BASE_URL=http://localhost:4001
```

### API Endpoints

The frontend connects to:
- Authentication: `/api/login`, `/api/signup`, `/api/logout`
- User: `/api/me`
- OAuth: `/api/auth/google`, `/api/auth/github`

## 🎨 Key Components

### Dashboard
- Welcome card with user personalization
- Alerts counter
- Log severity distribution (donut chart)
- Error trends (bar chart)
- Server health monitoring
- Response time gauge

### Sidebar Navigation
- Dashboard
- Servers
- Logs
- Analytics (with submenu)
- Alerts (with badge)
- Settings
- Upgrade prompt

### Top Navigation
- Server selector dropdown
- Search bar for logs
- AI Chat toggle
- Notifications bell
- Profile dropdown

## 🔒 Authentication Flow

1. User visits `/auth` page
2. Login with email/password or OAuth (Google/GitHub)
3. Backend validates and creates session
4. Frontend stores authentication state
5. Protected routes redirect to dashboard
6. Refresh token handling on page reload

## 📊 Dashboard Metrics

- **Log Severity**: Real-time breakdown of log types
- **Error Trends**: 7-day error analysis
- **Server Health**: 98% uptime tracking
- **Response Time**: Average 45ms response monitoring
- **Alerts**: 23 pending issues

## 🚧 Upcoming Features

- [ ] Real-time log streaming
- [ ] Advanced filtering and search
- [ ] Custom dashboards
- [ ] Team collaboration
- [ ] Export and reporting
- [ ] Mobile app

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is part of the LogAI ecosystem.

## 👤 Author

**Navroz Salim**
- GitHub: [@NavrozSalim](https://github.com/NavrozSalim)

## 🙏 Acknowledgments

- Built with React and Vite
- UI inspired by modern SaaS dashboards
- Icons from Heroicons

---

**Note**: Make sure the LogAI Backend is running for full functionality. See the [Backend Repository](https://github.com/NavrozSalim/LogAI---Backend) for setup instructions.
