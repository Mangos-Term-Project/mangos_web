import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import '../styles/MemberPage.css'
import { useLanguage } from '../i18n.jsx'

function MemberPage({ flashCardSets, flashCardError }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [selectedSet, setSelectedSet] = useState(null)
  const [isQuizPickerOpen, setIsQuizPickerOpen] = useState(false)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const reviewDialogRef = useRef(null)
  const quizPickerDialogRef = useRef(null)

  useEffect(() => {
    const dialog = reviewDialogRef.current
    if (!dialog) return
    if (selectedSet && !dialog.open) dialog.showModal()
    if (!selectedSet && dialog.open) dialog.close()
  }, [selectedSet])

  useEffect(() => {
    const dialog = quizPickerDialogRef.current
    if (!dialog) return
    if (isQuizPickerOpen && !dialog.open) dialog.showModal()
    if (!isQuizPickerOpen && dialog.open) dialog.close()
  }, [isQuizPickerOpen])

  function openSet(flashCardSet) {
    setCurrentCardIndex(0)
    setIsRevealed(false)
    setSelectedSet(flashCardSet)
  }

  function closeSet() {
    setSelectedSet(null)
    setIsRevealed(false)
  }

  function closeOnBackdropClick(event) {
    if (event.target === event.currentTarget) closeSet()
  }

  function chooseQuizSet(flashCardSet) {
    setIsQuizPickerOpen(false)
    navigate(`/quiz/${encodeURIComponent(flashCardSet.id)}`)
  }

  function closeQuizPicker() {
    setIsQuizPickerOpen(false)
  }

  function closeQuizPickerOnBackdropClick(event) {
    if (event.target === event.currentTarget) closeQuizPicker()
  }

  function moveCard(direction) {
    setCurrentCardIndex((index) => index + direction)
    setIsRevealed(false)
  }

  const currentCard = selectedSet?.flashCards[currentCardIndex]

    return (
      <div className="member-page">

        <main className="member-main">
          <section aria-labelledby="member-title" className="member-welcome">
            <p className="landing-kicker">{t('Your learning garden')}</p>
            <h1 id="member-title">{t('Ready to grow?')}</h1>
          </section>

          <section aria-label="Learning activities" className="activity-grid">
            <Link className="activity-card flashcard-card" to="/draw">
              <span aria-hidden="true" className="activity-illustration">▤</span>
              <span className="activity-card-copy">
                <span className="activity-eyebrow">{t('Build your vocabulary')}</span>
                <span className="activity-title">{t('Create your')}<br />{t('Flash Cards')}</span>
                <span className="activity-link">{t('Make a set of 50 cards')} <span aria-hidden="true">→</span></span>
              </span>
            </Link>

            <button className="activity-card quiz-card" onClick={() => setIsQuizPickerOpen(true)} type="button">
              <span aria-hidden="true" className="activity-illustration">✓</span>
              <span className="activity-card-copy">
                <span className="activity-eyebrow">{t('Put your knowledge to work')}</span>
                <span className="activity-title">{t('Quiz yourself')}</span>
                <span className="activity-link">{t('Choose a set')} <span aria-hidden="true">→</span></span>
              </span>
            </button>
          </section>

          <section aria-labelledby="flashcard-review-title" className="flashcard-review">
            <div className="flashcard-review-heading">
              <p className="landing-kicker">{t('Keep growing')}</p>
              <h2 id="flashcard-review-title">{t('Review your flash cards')}</h2>
            </div>
            {flashCardError && <p className="flashcard-load-error" role="alert">{flashCardError}</p>}
            {flashCardSets.length === 0 ? (
              <p className="flashcard-empty">
                {t("You haven't saved any flash cards yet.")} <Link to="/draw">{t('Create your first one')}</Link>.
              </p>
            ) : (
              <div className="flashcard-review-grid">
                {flashCardSets.map((flashCardSet) => {
                  const cardCount = flashCardSet.flashCards.length
                  return (
                    <button
                      aria-label={`Review ${flashCardSet.name}, ${cardCount} ${cardCount === 1 ? 'flash card' : 'flash cards'}`}
                      className="flashcard-set-card"
                      key={flashCardSet.id}
                      onClick={() => openSet(flashCardSet)}
                      type="button"
                    >
                      <span aria-hidden="true" className="flashcard-set-icon">▤</span>
                      <span className="flashcard-set-copy">
                        <span className="flashcard-set-name">{flashCardSet.name}</span>
                        <span className="flashcard-set-count">{cardCount} {t(cardCount === 1 ? 'card' : 'cards')}</span>
                      </span>
                      <span aria-hidden="true" className="flashcard-set-arrow">→</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <dialog
            aria-labelledby="flashcard-modal-title"
            className="flashcard-review-dialog"
            onClose={closeSet}
            onClick={closeOnBackdropClick}
            ref={reviewDialogRef}
          >
            {selectedSet && (
              <div className="flashcard-modal-content">
                <div className="flashcard-modal-heading">
                  <div>
                    <p className="landing-kicker">{t('Reviewing your set')}</p>
                    <h2 id="flashcard-modal-title">{selectedSet.name}</h2>
                  </div>
                  <button aria-label="Close review" className="flashcard-modal-close" onClick={closeSet} type="button">×</button>
                </div>

                {currentCard ? (
                  <>
                    <p aria-live="polite" className="flashcard-modal-progress">
                      {t('Card')} {currentCardIndex + 1} {t('of')} {selectedSet.flashCards.length}
                    </p>
                    <button
                      aria-label={isRevealed ? `${t('Show the word')} ${currentCard.name}` : `${t('Reveal drawing for')} ${currentCard.name}`}
                      aria-pressed={isRevealed}
                      className="flashcard-review-item"
                      onClick={() => setIsRevealed((revealed) => !revealed)}
                      type="button"
                    >
                      <span className="flashcard-review-face">
                        {isRevealed
                          ? currentCard.drawing
                            ? <img alt={`Drawing for ${currentCard.name}`} src={currentCard.drawing} />
                            : <span>{t('No drawing saved')}</span>
                          : currentCard.name}
                      </span>
                      <span className="flashcard-review-hint">
                        {isRevealed ? t('Tap to see the word') : t('Tap to reveal the drawing')}
                      </span>
                    </button>

                    <div className="flashcard-modal-navigation">
                      <button disabled={currentCardIndex === 0} onClick={() => moveCard(-1)} type="button">← {t('Previous')}</button>
                      <button disabled={currentCardIndex === selectedSet.flashCards.length - 1} onClick={() => moveCard(1)} type="button">{t('Next')} →</button>
                    </div>
                  </>
                ) : (
                  <p className="flashcard-modal-empty">{t("This set doesn't have any flash cards yet.")}</p>
                )}
              </div>
            )}
          </dialog>

          <dialog
            aria-labelledby="quiz-set-picker-title"
            className="flashcard-review-dialog quiz-set-picker-dialog"
            onClose={closeQuizPicker}
            onClick={closeQuizPickerOnBackdropClick}
            ref={quizPickerDialogRef}
          >
            <div className="flashcard-modal-content">
              <div className="flashcard-modal-heading">
                <div>
                  <p className="landing-kicker">{t('Ready to practice?')}</p>
                  <h2 id="quiz-set-picker-title">{t('Choose a set to quiz')}</h2>
                </div>
                <button aria-label="Close set picker" className="flashcard-modal-close" onClick={closeQuizPicker} type="button">×</button>
              </div>
              {flashCardSets.some((set) => set.status === 'in_review') ? (
                <div className="quiz-set-picker-list">
                  {flashCardSets.filter((set) => set.status === 'in_review').map((flashCardSet) => (
                    <button
                      className="flashcard-set-card"
                      key={flashCardSet.id}
                      onClick={() => chooseQuizSet(flashCardSet)}
                      type="button"
                    >
                      <span aria-hidden="true" className="flashcard-set-icon">✓</span>
                      <span className="flashcard-set-copy">
                        <span className="flashcard-set-name">{flashCardSet.name}</span>
                        <span className="flashcard-set-count">{flashCardSet.flashCards.length} {t('cards')} · {t('In review')}</span>
                      </span>
                      <span aria-hidden="true" className="flashcard-set-arrow">→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flashcard-modal-empty">
                  {t('No sets are ready to quiz yet. Keep creating flash cards—your set will be ready after 50 cards.')}
                </p>
              )}
            </div>
          </dialog>
        </main>
      </div>
    )
}

export default MemberPage
