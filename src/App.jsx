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
import LanguageSelector from './components/LanguageSelector.jsx'
import { LanguageProvider } from './i18n.jsx'
import { getCurrentUser, login, logout, register } from './api/auth.js'
import { getStorePurchases, purchaseStoreItem, recordCorrectQuizAnswer } from './api/economy.js'
import { getFlashCards, getFlashCardSets } from './api/flashcards.js'
import './App.css'

function AppContent() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [purchasedItems, setPurchasedItems] = useState([])
  const [flashCards, setFlashCards] = useState([])
  const [flashCardSets, setFlashCardSets] = useState([])
  const [flashCardError, setFlashCardError] = useState('')
  const isLoggedIn = user !== null

  useEffect(() => {
    let cancelled = false

    getCurrentUser()
      .then(async (currentUser) => {
        if (cancelled) return
        setUser(currentUser)
        try {
          const [savedFlashCards, savedFlashCardSets] = await Promise.all([
            getFlashCards(),
            getFlashCardSets(),
          ])
          if (cancelled) return
          setFlashCardSets(Array.isArray(savedFlashCardSets) ? savedFlashCardSets : [])
          // The API is scoped to the authenticated user. Never merge browser-wide
          // cached cards here: they make another account look already completed.
          setFlashCards(Array.isArray(savedFlashCards) ? savedFlashCards : [])
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

  useEffect(() => {
    if (!user?.user_id) return undefined
    let cancelled = false
    getStorePurchases()
      .then((items) => {
        if (!cancelled) setPurchasedItems(items)
      })
      .catch((error) => {
        if (!cancelled) console.error('Could not load store purchases:', error)
      })
    return () => {
      cancelled = true
    }
  }, [user?.user_id])

  async function handleLogin(credentials) {
    const loggedInUser = await login(credentials)
    setUser(loggedInUser)
    await loadAccountFlashcards()
    navigate('/home')
  }

  async function handleCreateAccount(details) {
    const createdUser = await register(details)
    setUser(createdUser)
    await loadAccountFlashcards()
    navigate('/home')
  }

  async function loadAccountFlashcards() {
    setFlashCardError('')
    try {
      const [savedFlashCards, savedFlashCardSets] = await Promise.all([
        getFlashCards(),
        getFlashCardSets(),
      ])
      setFlashCards(Array.isArray(savedFlashCards) ? savedFlashCards : [])
      setFlashCardSets(Array.isArray(savedFlashCardSets) ? savedFlashCardSets : [])
    } catch (error) {
      setFlashCards([])
      setFlashCardSets([])
      setFlashCardError(error.message)
    }
  }

  async function handlePurchase(item) {
    const result = await purchaseStoreItem(item.id)
    setUser((currentUser) => currentUser ? { ...currentUser, coins: result.coins } : currentUser)
    setPurchasedItems((currentItems) => currentItems.some((purchasedItem) => purchasedItem.id === result.item.id)
      ? currentItems
      : [...currentItems, result.item])
    return result.item
  }

  async function handleCorrectQuizAnswer(answer) {
    const result = await recordCorrectQuizAnswer(answer)
    setUser((currentUser) => currentUser ? { ...currentUser, coins: result.coins } : currentUser)
    return result
  }

  function handleSaveFlashCard(flashCard) {
    const nextFlashCards = [...flashCards, flashCard]
    setFlashCards(nextFlashCards)
    if (flashCard.setId) {
      setFlashCardSets((currentSets) => {
        const existingSet = currentSets.find((set) => set.id === flashCard.setId)
        if (!existingSet) {
          return [...currentSets, {
            id: flashCard.setId,
            name: flashCard.setName || 'My Flash Cards',
            status: flashCard.setStatus || 'in_progress',
            flashCards: [flashCard],
          }]
        }
        return currentSets.map((set) => set.id === flashCard.setId
          ? {
              ...set,
              status: flashCard.setStatus || set.status,
              flashCards: [...set.flashCards, flashCard],
            }
          : set)
      })
    }
    setFlashCardError('')
  }

  async function handleSignOut() {
    try {
      await logout()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    setUser(null)
    setPurchasedItems([])
    setFlashCards([])
    setFlashCardSets([])
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
        <LanguageSelector />
      </main>
    )
  }

  return (
    <main className="app">
      <LanguageSelector />
      <NavBar
        onSignOut={handleSignOut}
        onLogin={() => navigate('/login')}
        onCreateAccount={() => navigate('/create-account')}
        isLoggedIn={isLoggedIn}
        coinBalance={user?.coins ?? 0}
      />

      <Routes>
        <Route path="/" element={<LandingPage onStartLearning={() => navigate('/login')} />} />
        <Route path="/login" element={guestOnly(<LoginPage onSubmit={handleLogin} />)} />
        <Route path="/create-account" element={guestOnly(<CreateAccountPage onSubmit={handleCreateAccount} />)} />
        <Route path="/home" element={requireLogin(
          <MemberPage flashCardSets={flashCardSets} flashCardError={flashCardError} />,
        )} />
        <Route path="/house" element={requireLogin(<HousePage accountName={user?.name} items={purchasedItems} />)} />
        <Route path="/draw" element={requireLogin(
          <DrawPage onSaveFlashCard={handleSaveFlashCard} />,
        )} />
        <Route path="/quiz/:setId?" element={requireLogin(
          (flashCardSets ?? []).some((set) => set.status === 'in_review')
            ? <QuizPage flashCardSets={flashCardSets} onCorrectAnswer={handleCorrectQuizAnswer} />
            : <Navigate to="/home" replace />,
        )} />
        <Route path="/store" element={requireLogin(
          <StorePage coins={user?.coins ?? 0} onPurchase={handlePurchase} purchasedItems={purchasedItems} />,
        )} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App
