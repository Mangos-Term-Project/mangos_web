import { Link } from 'react-router-dom'
import '../styles/MemberPage.css'

function MemberPage() {
    return (
      <div className="member-page">

        <main className="member-main">
          <section aria-labelledby="member-title" className="member-welcome">
            <p className="landing-kicker">Your learning garden</p>
            <h1 id="member-title">Ready to grow?</h1>
          </section>

          <section aria-label="Learning activities" className="activity-grid">
            <Link className="activity-card flashcard-card" to="/draw">
              <span aria-hidden="true" className="activity-illustration">▤</span>
              <span className="activity-card-copy">
                <span className="activity-eyebrow">Build your vocabulary</span>
                <span className="activity-title">Create your<br />Flash Cards</span>
                <span className="activity-link">Make a new set <span aria-hidden="true">→</span></span>
              </span>
            </Link>

            <Link className="activity-card quiz-card" to="/quiz">
              <span aria-hidden="true" className="activity-illustration">✓</span>
              <span className="activity-card-copy">
                <span className="activity-eyebrow">Put your knowledge to work</span>
                <span className="activity-title">Quiz<br />yourself</span>
                <span className="activity-link">Choose a set <span aria-hidden="true">→</span></span>
              </span>
            </Link>
          </section>
        </main>
      </div>
    )
}

export default MemberPage
