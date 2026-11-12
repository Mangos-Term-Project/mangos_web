import { useEffect, useState } from 'react'
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
import { getCurrentUser, login, logout, register } from './api/auth.js'
import { getFlashCards } from './api/flashcards.js'
import './App.css'

const PURCHASES_STORAGE_KEY = 'mangos-demo-purchases'
const FLASHCARDS_STORAGE_KEY = 'mangos-demo-flashcards'

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
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [purchasedItems, setPurchasedItems] = useState(() => readStoredValue(PURCHASES_STORAGE_KEY, []))
  const [flashCards, setFlashCards] = useState(() => {
    const savedFlashCards = readStoredValue(FLASHCARDS_STORAGE_KEY, [])
    return Array.isArray(savedFlashCards) ? savedFlashCards : []
  })
  const [flashCardError, setFlashCardError] = useState('')
  const isLoggedIn = user !== null

  useEffect(() => {
    let cancelled = false

    getCurrentUser()
      .then(async (currentUser) => {
        if (cancelled) return
        setUser(currentUser)
        try {
          const savedFlashCards = await getFlashCards()
          if (cancelled) return
          setFlashCards((currentCards) => {
            const savedNames = new Set(savedFlashCards.map((card) => card.name.toLowerCase()))
            return [
              ...currentCards.filter((card) => !savedNames.has(card.name.toLowerCase())),
              ...savedFlashCards,
            ]
          })
        } catch (error) {
          if (!cancelled) setFlashCardError(error.message)
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogin(credentials) {
    setUser(await login(credentials))
    navigate('/home')
  }

  async function handleCreateAccount(details) {
    setUser(await register(details))
    navigate('/home')
  }

  function handlePurchase(item) {
    setPurchasedItems((currentItems) => {
      if (currentItems.some((purchasedItem) => purchasedItem.id === item.id)) return currentItems
      const nextItems = [...currentItems, item]
      window.localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(nextItems))
      return nextItems
    })
  }

  function handleSaveFlashCard(flashCard) {
    const nextFlashCards = [...flashCards, flashCard]
    setFlashCards(nextFlashCards)
    setFlashCardError('')
    try {
      window.localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(nextFlashCards))
    } catch (error) {
      console.error('Could not cache saved flash cards:', error)
    }
  }

  async function handleSignOut() {
    try {
      await logout()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    setUser(null)
    navigate('/')
  }

  function requireLogin(element) {
    return isLoggedIn ? element : <Navigate to="/" replace />
  }

  function guestOnly(element) {
    return isLoggedIn ? <Navigate to="/home" replace /> : element
  }

  if (!authChecked) {
    return (
      <main className="app">
        <p className="app-loading" role="status">Loading...</p>
      </main>
    )
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
        <Route path="/" element={<LandingPage onStartLearning={() => navigate('/login')} />} />
        <Route path="/login" element={guestOnly(<LoginPage onSubmit={handleLogin} />)} />
        <Route path="/create-account" element={guestOnly(<CreateAccountPage onSubmit={handleCreateAccount} />)} />
        <Route path="/home" element={requireLogin(
          <MemberPage flashCards={flashCards} flashCardError={flashCardError} />,
        )} />
        <Route path="/house" element={requireLogin(<HousePage accountName={user?.name} items={purchasedItems} />)} />
        <Route path="/draw" element={requireLogin(
          <DrawPage flashCards={flashCards} onSaveFlashCard={handleSaveFlashCard} />,
        )} />
        <Route path="/quiz" element={requireLogin(<QuizPage />)} />
        <Route path="/store" element={requireLogin(<StorePage onPurchase={handlePurchase} purchasedItems={purchasedItems} />)} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
