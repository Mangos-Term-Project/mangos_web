import { Link } from 'react-router-dom'
import { useState } from 'react'
import '../styles/MemberPage.css'

function MemberPage({ flashCards, flashCardError }) {
    const [revealedCardIds, setRevealedCardIds] = useState([])

    function toggleFlashCard(id) {
        setRevealedCardIds((currentIds) => (
            currentIds.includes(id)
                ? currentIds.filter((currentId) => currentId !== id)
                : [...currentIds, id]
        ))
    }

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

          <section aria-labelledby="flashcard-review-title" className="flashcard-review">
            <div className="flashcard-review-heading">
              <p className="landing-kicker">Keep growing</p>
              <h2 id="flashcard-review-title">Review your flash cards</h2>
            </div>
            {flashCardError && <p className="flashcard-load-error" role="alert">{flashCardError}</p>}
            {flashCards.length === 0 ? (
              <p className="flashcard-empty">
                You haven't saved any flash cards yet. <Link to="/draw">Create your first one</Link>.
              </p>
            ) : (
              <div className="flashcard-review-grid">
                {flashCards.map((flashCard) => {
                  const isRevealed = revealedCardIds.includes(flashCard.id)
                  return (
                    <button
                      aria-label={`${isRevealed ? 'Hide' : 'Review'} flash card: ${flashCard.name}`}
                      aria-pressed={isRevealed}
                      className="flashcard-review-item"
                      key={flashCard.id}
                      onClick={() => toggleFlashCard(flashCard.id)}
                      type="button"
                    >
                      <span className="flashcard-review-face">
                        {isRevealed
                          ? flashCard.drawing
                            ? <img alt={`Drawing for ${flashCard.name}`} src={flashCard.drawing} />
                            : <span>No drawing saved</span>
                          : flashCard.name}
                      </span>
                      <span className="flashcard-review-hint">
                        {isRevealed ? 'Tap to see the word' : 'Tap to review'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    )
}

export default MemberPage
