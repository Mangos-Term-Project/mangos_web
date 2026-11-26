import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import CreateAccountPage from './pages/CreateAccountPage.jsx'
import MemberPage from './pages/MemberPage.jsx'
import HousePage from './pages/HousePage.jsx'
import DrawPage from './pages/DrawPage.jsx'
import QuizPage from './pages/QuizPage.jsx'
import StorePage from './pages/StorePage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import NavBar from './components/NavBar.jsx'
import { getCurrentUser, login, logout, register } from './api/auth.js'
import { getFlashCards } from './api/flashcards.js'
import { getAccount, purchasePet } from './api/account.js'
import { useLanguage } from './i18n/language.js'
import './App.css'

// Older builds kept demo purchases and every account's drawings in browser
// storage shared by all accounts. Coins, pets and cards now live on the
// server for the signed-in account only, so these keys are deleted.
const LEGACY_STORAGE_KEYS = ['mangos-demo-flashcards', 'mangos-demo-purchases']

function removeLegacyFlashCardCache() {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable (private mode, blocked site data).
    }
  }
}

function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Each page opens at the top. Without this, going from a scrolled-down
  // Home page to Draw (for example "Edit drawing") left the canvas off-screen.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const { t } = useLanguage()
  const [account, setAccount] = useState(null)
  const [accountError, setAccountError] = useState('')
  const [flashCards, setFlashCards] = useState([])
  const [flashCardError, setFlashCardError] = useState('')
  const [pendingEmail, setPendingEmail] = useState(null)
  const isLoggedIn = user !== null
  const userId = user?.user_id ?? null
  // The server blocks app features until the email is verified; the page follows its answer.
  const needsVerification = Boolean(user?.email_required && !user?.email_verified)

  useEffect(() => {
    let cancelled = false
    removeLegacyFlashCardCache()

    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser)
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

  // Load the signed-in account's cards whenever the account changes, so a
  // new login in the same tab never shows the previous account's drawings.
  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false

    async function loadFlashCards() {
      try {
        const response = await getFlashCards()
        const savedFlashCards = Array.isArray(response) ? response : []
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
    }

    // Cards need a verified email; the account (with its email status) does not,
    // so the verify screen can tell whether a code is already waiting.
    if (!needsVerification) loadFlashCards()
    getAccount()
      .then((details) => {
        if (!cancelled) setAccount(details)
      })
      .catch((error) => {
        if (!cancelled) setAccountError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [userId, needsVerification])

  function updateCoins(coins) {
    if (typeof coins === 'number') setAccount((current) => (current ? { ...current, coins } : current))
  }

  function handleFlashCardChange(id, changes) {
    setFlashCards((currentCards) => currentCards.map((card) => (card.id === id ? { ...card, ...changes } : card)))
  }

  function handleReviewed(id, result) {
    handleFlashCardChange(id, { box: result.box, due_at: result.due_at })
    updateCoins(result.coins)
  }

  async function handleLogin(credentials) {
    setUser(await login(credentials))
    navigate('/home')
  }

  async function handleCreateAccount(details) {
    const created = await register(details)
    setPendingEmail(created.email_code ? { ...created.email_code, email: details.email } : null)
    setUser(created)
    navigate('/home')
  }

  function handleEmailVerified(status) {
    setUser((current) => (current ? { ...current, email_verified: true } : current))
    setAccount((current) => (current ? { ...current, email: status } : current))
    setPendingEmail(null)
  }

  // The server checks the balance and ownership and deducts the price in one
  // transaction; the page only shows the result.
  async function handlePurchase(petId) {
    const result = await purchasePet(petId)
    setAccount((current) => ({
      ...(current ?? {}),
      coins: result.coins,
      pets: [...(current?.pets ?? []), { ...result.pet, purchased_at: new Date().toISOString() }],
    }))
    return result
  }

  function handleSaveFlashCard(flashCard) {
    setFlashCards((currentCards) => [...currentCards, flashCard])
    setFlashCardError('')
    updateCoins(flashCard.coins)
  }

  function handleEmailChange(email) {
    setAccount((current) => (current ? { ...current, email } : current))
  }

  async function handleSignOut() {
    try {
      await logout()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
    setUser(null)
    setAccount(null)
    setPendingEmail(null)
    setAccountError('')
    setFlashCards([])
    setFlashCardError('')
    removeLegacyFlashCardCache()
    navigate('/')
  }

  function requireLogin(element) {
    if (!isLoggedIn) return <Navigate to="/" replace />
    if (needsVerification) {
      return (
        <VerifyEmailPage
          onSignOut={handleSignOut}
          onVerified={handleEmailVerified}
          pendingEmail={pendingEmail}
          emailStatus={account?.email}
          user={user}
        />
      )
    }
    return element
  }

  function guestOnly(element) {
    return isLoggedIn ? <Navigate to="/home" replace /> : element
  }

  if (!authChecked) {
    return (
      <main className="app">
        <p className="app-loading" role="status">{t('app.loading')}</p>
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
        showAppNav={!needsVerification}
        coins={account?.coins}
      />

      <Routes>
        <Route path="/" element={<LandingPage onStartLearning={() => navigate('/login')} />} />
        <Route path="/login" element={guestOnly(<LoginPage onSubmit={handleLogin} />)} />
        <Route path="/create-account" element={guestOnly(<CreateAccountPage onSubmit={handleCreateAccount} />)} />
        <Route path="/home" element={requireLogin(
          <MemberPage
            flashCards={flashCards}
            flashCardError={flashCardError}
            onReviewed={handleReviewed}
          />,
        )} />
        <Route path="/house" element={requireLogin(
          <HousePage accountName={user?.name} pets={account?.pets ?? []} loadError={accountError} />,
        )} />
        <Route path="/draw" element={requireLogin(
          <DrawPage
            flashCards={flashCards}
            onDrawingUpdated={(id, drawing) => handleFlashCardChange(id, { drawing })}
            onSaveFlashCard={handleSaveFlashCard}
          />,
        )} />
        <Route path="/quiz" element={requireLogin(<QuizPage flashCards={flashCards} onReviewed={handleReviewed} />)} />
        <Route path="/store" element={requireLogin(
          <StorePage coins={account?.coins} onPurchase={handlePurchase} />,
        )} />
        <Route path="/account" element={requireLogin(
          <AccountPage user={user} email={account?.email} onEmailChange={handleEmailChange} onSignOut={handleSignOut} />,
        )} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/'} replace />} />
      </Routes>
    </main>
  )
}

export default App
