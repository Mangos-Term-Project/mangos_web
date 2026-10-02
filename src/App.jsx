import { useState } from 'react'
import './App.css'

const AUTH_STORAGE_KEY = 'mangos-demo-logged-in'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true',
  )

  function handleDemoSignIn() {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    setIsLoggedIn(true)
  }

  function handleSignOut() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsLoggedIn(false)
  }

  if (isLoggedIn) {
    return (
      <>
        <button className="session-signout" onClick={handleSignOut} type="button">
          Sign out
        </button>
      </>
    )
  }

  return (
    <main className="landing-page">
      <div aria-hidden="true" className="mango-orbit">
        <span className="floating-mango mango-one" >🥭</span>
        <span className="floating-mango mango-two" >🥭</span>
        <span className="floating-mango mango-three" >🥭</span>
        <span className="floating-mango mango-four" >🥭</span>
        <span className="floating-mango mango-five" >🥭</span>
        <span className="floating-mango mango-six" >🥭</span>
      </div>

      <header className="landing-header">
        <a aria-label="Mangos English Learning home" className="brand-mark" href="#home">
          <span aria-hidden="true" className="brand-fruit">🥭</span>
        </a>
        <nav aria-label="Account" className="account-actions">
          <button className="login-button" onClick={handleDemoSignIn} type="button">
            Log in
          </button>
          <button className="create-account-button" onClick={handleDemoSignIn} type="button">
            Create account
          </button>
        </nav>
      </header>

      <section aria-labelledby="landing-title" className="landing-hero" id="home">
        <p className="landing-kicker">A little practice. A lot of progress.</p>
        <h1 id="landing-title">Mang<span className='landing-title-fruit'>🥭</span>s
          <br />
          <span className='landing-subtitle'>English Learning</span>
        </h1>
        <p className="landing-description">
          Grow your confidence, one picture at a time.
        </p>
        <button className="start-learning-button" onClick={handleDemoSignIn} type="button">
          Start learning <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  )
}

export default App
