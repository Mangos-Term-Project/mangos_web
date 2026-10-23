import '../styles/LandingPage.css'
import TestBackend from '../components/Test_Backend'

function LandingPage({ onStartLearning }) {

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
        <p className="landing-kicker">A little practice. A lot of progress.</p>
        <h1 id="landing-title">Mang<span className='landing-title-fruit'>🥭</span>s
          <br />
          <span className='landing-subtitle'>English Learning</span>
        </h1>
        <span>
          <TestBackend />
        </span>
        <p className="landing-description">
          Grow your confidence, one picture at a time.
        </p>
        <button className="start-learning-button" onClick={onStartLearning} type="button">
          Start learning <span aria-hidden="true">→</span>
        </button>
      </section>
    </main>
  )
}

export default LandingPage
