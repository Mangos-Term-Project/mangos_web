import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import CreateAccountPage from './pages/CreateAccountPage.jsx'
import MemberPage from './pages/MemberPage.jsx'
import DrawPage from './pages/DrawPage.jsx'
import QuizPage from './pages/QuizPage.jsx'
import NavBar from './components/NavBar.jsx'
import './App.css'

const AUTH_STORAGE_KEY = 'mangos-demo-logged-in'

function App() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true',
  )

  function handleDemoSignIn() {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsLoggedIn(true)
    navigate('/home')
  }

  function handleSignOut() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsLoggedIn(false)
    navigate('/')
  }

  function requireLogin(element) {
    return isLoggedIn ? element : <Navigate to="/" replace />
  }

  return (
    <main className="app">
      <NavBar
        onSignOut={handleSignOut}
        onLogin={() => navigate('/login')}
        onCreateAccount={() => navigate('/create-account')}
        isLoggedIn={isLoggedIn}
      />

      <Routes>
        <Route path="/" element={<LandingPage onStartLearning={handleDemoSignIn} />} />
        <Route path="/login" element={<LoginPage onSubmit={handleDemoSignIn} />} />
        <Route path="/create-account" element={<CreateAccountPage onSubmit={handleDemoSignIn} />} />
        <Route path="/home" element={requireLogin(<MemberPage />)} />
        <Route path="/draw" element={requireLogin(<DrawPage />)} />
        <Route path="/quiz" element={requireLogin(<QuizPage />)} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
