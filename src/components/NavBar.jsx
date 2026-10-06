import { FaHome, FaStore } from "react-icons/fa";
import { Link } from 'react-router-dom'
import '../styles/NavBar.css'

function NavBar({ onSignOut, onSignIn, isLoggedIn }) {

  return (
    <header className="header">
      <Link aria-label="Mangos home" className="brand-mark" to={isLoggedIn ? '/home' : '/'}>
        <span aria-hidden="true" className="brand-fruit">🥭</span>
      </Link>

      {isLoggedIn ?
        <nav aria-label="Main navigation" className="main-nav">
          <Link aria-label="Home" className="nav-icon-button">
            <FaHome className="nav-icon" />
            <span>House</span>
          </Link>
          <Link aria-label="Home" className="nav-icon-button">
            <FaStore className="nav-icon" />
            <span>Store</span>
          </Link>
        </nav>
      :
        <nav></nav>
      }
       <nav aria-label="Account" className="account-actions">
        {isLoggedIn ?
          <button className="signout-button" onClick={onSignOut} type="button">
            Sign out
          </button>
        :
          <>        
            <button className="login-button" onClick={onSignIn} type="button">
              Log in
            </button>
            <button className="create-account-button" onClick={onSignIn} type="button">
              Create account
            </button>
          </>
        }
      </nav>
    </header>
  )
}

export default NavBar