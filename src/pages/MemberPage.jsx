import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { FaPencilAlt } from 'react-icons/fa'
import { recordReview } from '../api/account.js'
import SpanishTranslation from '../components/SpanishTranslation.jsx'
import { useLanguage } from '../i18n/language.js'
import '../styles/MemberPage.css'

const DEFAULT_SET = 'My Flash Cards'

function isDue(card, now) {
	return !card.due_at || new Date(card.due_at).getTime() <= now
}

function groupIntoSets(cards) {
	const sets = new Map()
	for (const card of cards) {
		const key = card.set_id ?? card.set_name ?? DEFAULT_SET
		if (!sets.has(key)) sets.set(key, { id: key, name: card.set_name ?? DEFAULT_SET, cards: [] })
		sets.get(key).cards.push(card)
	}
	return [...sets.values()].sort((a, b) => {
		if (a.name === DEFAULT_SET) return -1
		if (b.name === DEFAULT_SET) return 1
		return a.name.localeCompare(b.name, undefined, { numeric: true })
	})
}

function MemberPage({ flashCards, flashCardError, onReviewed }) {
	const { language, t, translateMessage } = useLanguage()
	const navigate = useNavigate()
	const [now] = useState(() => Date.now())
	const [openSetId, setOpenSetId] = useState(null)
	const [cardIndex, setCardIndex] = useState(0)
	const [isFlipped, setIsFlipped] = useState(false)
	const [isRecording, setIsRecording] = useState(false)
	const [feedback, setFeedback] = useState({ text: '', isError: false })

	const sets = groupIntoSets(flashCards)
	const openSet = sets.find((set) => set.id === openSetId) ?? null
	const card = openSet?.cards[Math.min(cardIndex, openSet.cards.length - 1)] ?? null

	function setName(set) {
		if (set.name === DEFAULT_SET) return t('home.defaultSet')
		const match = set.name.match(/^Set (\d+)$/)
		return match ? t('home.numberedSet', { number: match[1] }) : set.name
	}

	function openSetForReview(set) {
		setOpenSetId(set.id)
		setCardIndex(0)
		setIsFlipped(false)
		setFeedback({ text: '', isError: false })
	}

	function goTo(index) {
		setCardIndex(index)
		setIsFlipped(false)
		setFeedback({ text: '', isError: false })
	}

	async function answer(remembered) {
		if (!card || isRecording) return
		setIsRecording(true)
		try {
			const result = await recordReview(card.id, { source: 'review', remembered })
			onReviewed(card.id, result)
			const nextDate = result.due_at
				? new Date(result.due_at).toLocaleDateString(language === 'es' ? 'es' : 'en', { month: 'long', day: 'numeric' })
				: ''
			setFeedback({
				text: result.coins_awarded
					? t('home.reviewCoins', { count: result.coins_awarded, date: nextDate })
					: remembered ? t('home.reviewNext', { date: nextDate }) : t('home.reviewAgain'),
				isError: false,
			})
		} catch (error) {
			setFeedback({ text: translateMessage(error.message), isError: true })
		} finally {
			setIsRecording(false)
		}
	}

	return (
		<div className="member-page">
			<main className="member-main">
				<section aria-labelledby="member-title" className="member-welcome">
					<p className="landing-kicker">{t('home.kicker')}</p>
					<h1 id="member-title">{t('home.title')}</h1>
				</section>

				<section aria-label={t('home.activities')} className="activity-grid">
					<Link className="activity-card flashcard-card" to="/draw">
						<span aria-hidden="true" className="activity-illustration">▤</span>
						<span className="activity-card-copy">
							<span className="activity-eyebrow">{t('home.createEyebrow')}</span>
							<span className="activity-title">{t('home.createTitle')}</span>
							<span className="activity-link">{t('home.createLink')} <span aria-hidden="true">→</span></span>
						</span>
					</Link>

					<Link className="activity-card quiz-card" to="/quiz">
						<span aria-hidden="true" className="activity-illustration">✓</span>
						<span className="activity-card-copy">
							<span className="activity-eyebrow">{t('home.quizEyebrow')}</span>
							<span className="activity-title">{t('home.quizTitle')}</span>
							<span className="activity-link">{t('home.quizLink')} <span aria-hidden="true">→</span></span>
						</span>
					</Link>
				</section>

				<section aria-labelledby="flashcard-review-title" className="flashcard-review">
					<div className="flashcard-review-heading">
						<p className="landing-kicker">{t('home.reviewKicker')}</p>
						<h2 id="flashcard-review-title">{openSet ? setName(openSet) : t('home.reviewTitle')}</h2>
					</div>
					{flashCardError && <p className="flashcard-load-error" role="alert">{translateMessage(flashCardError)}</p>}

					{flashCards.length === 0 && (
						<p className="flashcard-empty">
							{t('home.noCards')} <Link to="/draw">{t('home.createFirst')}</Link>
						</p>
					)}

					{!openSet && flashCards.length > 0 && (
						<div className="set-grid">
							{sets.map((set) => {
								const dueCount = set.cards.filter((item) => isDue(item, now)).length
								return (
									<button className="set-tile" key={set.id} onClick={() => openSetForReview(set)} type="button">
										<span className="set-tile-name">{setName(set)}</span>
										<span className="set-tile-count">
											{set.cards.length === 1 ? t('home.cardCountOne') : t('home.cardCount', { count: set.cards.length })}
										</span>
										<span className={`set-tile-due${dueCount ? ' has-due' : ''}`}>
											{dueCount ? t('home.dueCount', { count: dueCount }) : t('home.nothingDue')}
										</span>
										<span className="set-tile-action">{t('home.openSet')} <span aria-hidden="true">→</span></span>
									</button>
								)
							})}
						</div>
					)}

					{openSet && card && (
						<div className="review-stage">
							<div className="review-toolbar">
								<button className="review-back" onClick={() => setOpenSetId(null)} type="button">
									<span aria-hidden="true">←</span> {t('home.backToSets')}
								</button>
								<p className="review-position">
									{t('home.cardPosition', { current: openSet.cards.indexOf(card) + 1, total: openSet.cards.length })}
								</p>
								<button className="review-edit" onClick={() => navigate('/draw', { state: { editCardId: card.id } })} type="button">
									<FaPencilAlt aria-hidden="true" /> {t('home.editDrawing')}
								</button>
							</div>

							<button
								aria-label={isFlipped ? t('home.showWord', { word: card.name }) : t('home.showDrawing', { word: card.name })}
								aria-pressed={isFlipped}
								className="review-card"
								onClick={() => setIsFlipped((flipped) => !flipped)}
								type="button"
							>
								<span className="review-card-face">
									{isFlipped
										? card.drawing
											? <img alt={t('home.drawingAlt', { word: card.name })} src={card.drawing} />
											: <span>{t('home.noDrawing')}</span>
										: (
											<span className="review-card-word-group">
												<span className="review-card-word" lang="en">{card.name}</span>
												<SpanishTranslation word={card.name} />
											</span>
										)}
								</span>
								<span className="review-card-hint">{isFlipped ? t('home.tapForWord') : t('home.tapForDrawing')}</span>
							</button>

							<p className={`review-status${isDue(card, now) ? ' is-due' : ''}`}>
								{isDue(card, now)
									? t('home.dueNow')
									: t('home.nextReview', {
										date: new Date(card.due_at).toLocaleDateString(language === 'es' ? 'es' : 'en', { month: 'long', day: 'numeric' }),
									})}
							</p>

							{isFlipped && isDue(card, now) && (
								<div className="review-answer" role="group" aria-label={t('home.didYouRemember')}>
									<p>{t('home.didYouRemember')}</p>
									<button className="review-yes" disabled={isRecording} onClick={() => answer(true)} type="button">
										{t('home.remembered')}
									</button>
									<button className="review-no" disabled={isRecording} onClick={() => answer(false)} type="button">
										{t('home.notYet')}
									</button>
								</div>
							)}

							<p aria-live="polite" className={`review-feedback${feedback.isError ? ' is-error' : ''}`} role="status">
								{feedback.text}
							</p>

							<div className="review-navigation">
								<button
									disabled={openSet.cards.indexOf(card) === 0}
									onClick={() => goTo(openSet.cards.indexOf(card) - 1)}
									type="button"
								>
									<span aria-hidden="true">←</span> {t('home.previous')}
								</button>
								<button
									disabled={openSet.cards.indexOf(card) === openSet.cards.length - 1}
									onClick={() => goTo(openSet.cards.indexOf(card) + 1)}
									type="button"
								>
									{t('home.next')} <span aria-hidden="true">→</span>
								</button>
							</div>
						</div>
					)}
				</section>
			</main>

		</div>
	)
}

export default MemberPage
