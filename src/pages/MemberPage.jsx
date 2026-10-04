import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/MemberPage.css'

function MemberPage() {
  const [selectedActivity, setSelectedActivity] = useState('')

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

            <button
              aria-pressed={selectedActivity === 'quiz'}
              className={`activity-card quiz-card${selectedActivity === 'quiz' ? ' is-selected' : ''}`}
              onClick={() => setSelectedActivity('quiz')}
              type="button"
            >
              <span aria-hidden="true" className="activity-illustration">✓</span>
              <span className="activity-card-copy">
                <span className="activity-eyebrow">Put your knowledge to work</span>
                <span className="activity-title">Quiz<br />yourself</span>
                <span className="activity-link">Choose a set <span aria-hidden="true">→</span></span>
              </span>
            </button>
          </section>
          {selectedActivity && (
            <p aria-live="polite" className="activity-feedback">
              {selectedActivity === 'flashcards' ? 'Flash Cards' : 'Quiz yourself'} selected — coming soon!
            </p>
          )}
        </main>
      </div>
    )
}

export default MemberPage
