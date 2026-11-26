import { useLanguage } from '../i18n/language.js'
import '../styles/LandingPage.css'

function LandingPage({ onStartLearning }) {
  const { t } = useLanguage()

  return (
    <main className="landing-page">
      <div aria-hidden="true" className="mango-orbit">
        <span className="floating-mango mango-one">🥭</span>
        <span className="floating-mango mango-two">🥭</span>
        <span className="floating-mango mango-three">🥭</span>
        <span className="floating-mango mango-four">🥭</span>
        <span className="floating-mango mango-five">🥭</span>
        <span className="floating-mango mango-six">🥭</span>
      </div>
      <section aria-labelledby="landing-title" className="landing-hero">
        <p className="landing-kicker">{t('landing.kicker')}</p>
        <h1 id="landing-title">Mang<span className='landing-title-fruit'>🥭</span>s
          <br />
          <span className='landing-subtitle'>{t('landing.subtitle')}</span>
        </h1>
        <p className="landing-description">
          {t('landing.description')}
        </p>
        <button className="start-learning-button" onClick={onStartLearning} type="button">
          {t('landing.start')} <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  )
}

export default LandingPage
