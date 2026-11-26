import { FaHome, FaStore, FaUserCircle } from "react-icons/fa";
import { Link, NavLink } from 'react-router-dom'
import { useLanguage } from '../i18n/language.js'
import '../styles/NavBar.css'

function NavBar({ onSignOut, onLogin, onCreateAccount, isLoggedIn, showAppNav = true, coins }) {
  const { language, setLanguage, t } = useLanguage()
  const nextLanguage = language === 'es' ? 'en' : 'es'

  return (
    <header className="header">
      <div className="primary-navigation">
        <Link aria-label={t('nav.homeLabel')} className="brand-mark" to={isLoggedIn ? '/home' : '/'}>
          <span aria-hidden="true" className="brand-fruit">🥭</span>
          <span>Mangos</span>
        </Link>

        {isLoggedIn && showAppNav && (
          <nav aria-label={t('nav.main')} className="main-nav">
            <NavLink className="nav-icon-button" to="/house">
              <FaHome aria-hidden="true" className="nav-icon" />
              <span>{t('nav.house')}</span>
            </NavLink>
            <NavLink className="nav-icon-button" to="/store">
              <FaStore aria-hidden="true" className="nav-icon" />
              <span>{t('nav.store')}</span>
            </NavLink>
            <NavLink className="nav-icon-button" to="/account">
              <FaUserCircle aria-hidden="true" className="nav-icon" />
              <span>{t('nav.account')}</span>
            </NavLink>
          </nav>
        )}
      </div>

      <nav aria-label={t('nav.accountActions')} className="account-actions">
        {isLoggedIn && showAppNav && (
          <p className="coin-balance" aria-live="polite">
            <span aria-hidden="true" className="coin-icon">●</span>
            <span>{typeof coins === 'number' ? t('coins.count', { count: coins }) : t('coins.unknown')}</span>
          </p>
        )}
        <button
          aria-label={nextLanguage === 'es' ? 'Cambiar a español' : 'Switch to English'}
          className="language-toggle"
          lang={nextLanguage}
          onClick={() => setLanguage(nextLanguage)}
          type="button"
        >
          <span className="language-long">{nextLanguage === 'es' ? 'Español' : 'English'}</span>
          <span aria-hidden="true" className="language-short">{nextLanguage === 'es' ? 'ES' : 'EN'}</span>
        </button>
        {isLoggedIn ?
          <button className="signout-button" onClick={onSignOut} type="button">
            {t('nav.signOut')}
          </button>
        :
          <>
            <button className="login-button" onClick={onLogin} type="button">
              {t('nav.logIn')}
            </button>
            <button className="create-account-button" onClick={onCreateAccount} type="button">
              {t('nav.createAccount')}
            </button>
          </>
        }
      </nav>
    </header>
  )
}

export default NavBar
