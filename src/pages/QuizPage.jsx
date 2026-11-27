import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import '../styles/QuizPage.css'
import { useLanguage } from '../i18n.jsx'

const EMPTY_FLASH_CARDS = []

function makeChoices(correctCard, flashCards) {
	const distractors = flashCards.filter((card) => card.id !== correctCard.id)
	for (let index = distractors.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		;[distractors[index], distractors[randomIndex]] = [distractors[randomIndex], distractors[index]]
	}
	const choices = [correctCard, ...distractors.slice(0, 3)]
	for (let index = choices.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		;[choices[index], choices[randomIndex]] = [choices[randomIndex], choices[index]]
	}
	return choices
}

function QuizPage({ flashCardSets, onCorrectAnswer }) {
	const { t } = useLanguage()
	const { setId } = useParams()
	const availableSets = flashCardSets.filter((set) => set.status === 'in_review')
	const flashCardSet = setId
		? availableSets.find((set) => set.id === setId)
		: availableSets[0]
	const flashCards = flashCardSet ? flashCardSet.flashCards : EMPTY_FLASH_CARDS
	const [currentCardIndex, setCurrentCardIndex] = useState(0)
	const [selectedChoice, setSelectedChoice] = useState(null)
	const [isChecked, setIsChecked] = useState(false)
	const [score, setScore] = useState(0)
	const [isAwarding, setIsAwarding] = useState(false)
	const [coinMessage, setCoinMessage] = useState('')
	const currentCard = flashCards[currentCardIndex]
	const choices = useMemo(
		() => currentCard ? makeChoices(currentCard, flashCards) : [],
		[currentCard, flashCards],
	)

	if (!flashCardSet) return <Navigate to="/home" replace />

	async function checkAnswer() {
		if (!selectedChoice) return
		setIsChecked(true)
		setCoinMessage('')
		if (selectedChoice !== currentCard.id) return

		setIsAwarding(true)
		try {
			const result = await onCorrectAnswer({ setId: flashCardSet.id, flashCardId: currentCard.id })
			setCoinMessage(result.coins_awarded ? `+${result.amount} ${t('coin earned!')}` : t('You already earned a coin for this card.'))
		} catch (error) {
			setCoinMessage(t(error.message || 'Could not award your quiz coin.'))
		} finally {
			setIsAwarding(false)
		}
	}

	function advance() {
		if (selectedChoice === currentCard.id) setScore((currentScore) => currentScore + 1)
		setCurrentCardIndex((index) => index + 1)
		setSelectedChoice(null)
		setIsChecked(false)
		setCoinMessage('')
	}

	const selectedAnswer = choices.find((choice) => choice.id === selectedChoice)
	const isComplete = currentCardIndex >= flashCards.length

	return (
		<main className="quiz-page">
			<section className="quiz-window">
				{isComplete ? (
					<div className="quiz-complete">
						<p className="quiz-eyebrow">{t('Set complete')}</p>
						<h1 className="quiz-word">{t('Nice work!')}</h1>
						<p>{t('You got')} {score} {t('out of')} {flashCards.length} {t('correct in')} {flashCardSet.name}.</p>
						<Link className="quiz-submit-button quiz-home-link" to="/home">{t('Back to your sets')}</Link>
					</div>
				) : currentCard ? (
					<>
						<div className="quiz-heading">
							<p className="quiz-eyebrow">{flashCardSet.name} · {t('Question')} {currentCardIndex + 1} {t('of')} {flashCards.length}</p>
							<h1 className="quiz-word">{currentCard.name}</h1>
							<p className="quiz-prompt">{t('Which drawing matches this word?')}</p>
						</div>

						<div aria-label="Drawing choices" className="quiz-choice-grid">
							{choices.map((choice, choiceIndex) => {
								const isSelected = selectedChoice === choice.id
								const isCorrect = isChecked && choice.id === currentCard.id
								const isIncorrect = isChecked && isSelected && choice.id !== currentCard.id

								return (
									<button
										aria-pressed={isSelected}
										className={`quiz-choice${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isIncorrect ? ' is-incorrect' : ''}`}
										disabled={isChecked}
										key={choice.id}
										onClick={() => setSelectedChoice(choice.id)}
										aria-label={`Drawing choice ${choiceIndex + 1}`}
										type="button"
									>
										{choice.drawing
											? <img alt="" className="quiz-choice-image" src={choice.drawing} />
											: <span className="quiz-choice-no-image">{t('No drawing saved')}</span>}
									</button>
								)
							})}
						</div>

						<div className="quiz-footer">
							<p aria-live="polite" className={`quiz-feedback${isChecked ? (selectedAnswer?.id === currentCard.id ? ' feedback-correct' : ' feedback-incorrect') : ''}`}>
								{isChecked
									? selectedAnswer?.id === currentCard.id ? t('That’s right!') : `${t('Not quite—the answer is')} “${currentCard.name}.”`
										: t('Choose the drawing that matches the word.')}
								{coinMessage && <span className="quiz-coin-message"> {coinMessage}</span>}
							</p>
							{isChecked ? (
								<button className="quiz-submit-button" disabled={isAwarding} onClick={advance} type="button">
									{currentCardIndex === flashCards.length - 1 ? t('Finish quiz') : t('Next question')}
								</button>
							) : (
								<button className="quiz-submit-button" disabled={!selectedChoice} onClick={checkAnswer} type="button">
									{t('Check answer')}
								</button>
							)}
						</div>
					</>
				) : (
					<div className="quiz-complete">
						<p>{t('This set doesn’t have any cards to quiz yet.')}</p>
						<Link className="quiz-submit-button quiz-home-link" to="/home">{t('Back to your sets')}</Link>
					</div>
				)}
			</section>
		</main>
	)
}

export default QuizPage
