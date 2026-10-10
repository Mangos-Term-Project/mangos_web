import { FaHome, FaStore } from "react-icons/fa";
import { Link, NavLink } from 'react-router-dom'
import '../styles/NavBar.css'

function NavBar({ onSignOut, onLogin, onCreateAccount, isLoggedIn }) {

  return (
    <header className="header">
      <Link aria-label="Mangos home" className="brand-mark" to={isLoggedIn ? '/home' : '/'}>
        <span aria-hidden="true" className="brand-fruit">🥭</span>
      </Link>

      {isLoggedIn ?
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink aria-label="Home" className='nav-icon-button'>
            <FaHome className="nav-icon" />
            <span>House</span>
          </NavLink>
          <NavLink aria-label="Store" className='nav-icon-button' to="/store">
            <FaStore className="nav-icon" />
            <span>Store</span>
          </NavLink>
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
            <button className="login-button" onClick={onLogin} type="button">
              Log in
            </button>
            <button className="create-account-button" onClick={onCreateAccount} type="button">
              Create account
            </button>
          </>
        }
      </nav>
    </header>
  )
}

export default NavBar