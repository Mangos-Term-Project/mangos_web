import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import CreateAccountPage from './pages/CreateAccountPage.jsx'
import MemberPage from './pages/MemberPage.jsx'
import HousePage from './pages/HousePage.jsx'
import DrawPage from './pages/DrawPage.jsx'
import QuizPage from './pages/QuizPage.jsx'
import StorePage from './pages/StorePage.jsx'
import NavBar from './components/NavBar.jsx'
import './App.css'

const AUTH_STORAGE_KEY = 'mangos-demo-logged-in'
const PROFILE_STORAGE_KEY = 'mangos-demo-profile'
const PURCHASES_STORAGE_KEY = 'mangos-demo-purchases'

function readStoredValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function App() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true',
  )
  const [profile, setProfile] = useState(() => readStoredValue(PROFILE_STORAGE_KEY, {}))
  const [purchasedItems, setPurchasedItems] = useState(() => readStoredValue(PURCHASES_STORAGE_KEY, []))

  function handleDemoSignIn() {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsLoggedIn(true)
    navigate('/home')
  }

  function handleCreateAccount(newProfile) {
    const savedProfile = { name: newProfile.name.trim(), username: newProfile.username.trim() }
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(savedProfile))
    setProfile(savedProfile)
    handleDemoSignIn()
  }

  function handlePurchase(item) {
    setPurchasedItems((currentItems) => {
      if (currentItems.some((purchasedItem) => purchasedItem.id === item.id)) return currentItems
      const nextItems = [...currentItems, item]
      window.localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(nextItems))
      return nextItems
    })
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
        <Route path="/create-account" element={<CreateAccountPage onSubmit={handleCreateAccount} />} />
        <Route path="/home" element={requireLogin(<MemberPage />)} />
        <Route path="/house" element={requireLogin(<HousePage accountName={profile.name || 'Learner'} items={purchasedItems} />)} />
        <Route path="/draw" element={requireLogin(<DrawPage />)} />
        <Route path="/quiz" element={requireLogin(<QuizPage />)} />
        <Route path="/store" element={requireLogin(<StorePage onPurchase={handlePurchase} purchasedItems={purchasedItems} />)} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
