import { useState } from 'react'
import { Link } from 'react-router-dom'
import { recordReview } from '../api/account.js'
import { useLanguage } from '../i18n/language.js'
import SpanishTranslation from '../components/SpanishTranslation.jsx'
import '../styles/QuizPage.css'

const CHOICES_PER_QUESTION = 4
const MAX_QUESTIONS_PER_ROUND = 10
const ALL_CARDS = 'all'

function shuffle(items) {
	const copy = [...items]
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
	}
	return copy
}

function hasDrawing(card) {
	return typeof card.drawing === 'string' && card.drawing !== ''
}

// Questions come from the chosen set. Wrong choices come from all of the
// learner's drawings so a small set still has enough pictures to choose from.
function buildRound(questionCards, allCards) {
	const pool = allCards.filter(hasDrawing)
	if (pool.length < CHOICES_PER_QUESTION) return []
	return shuffle(questionCards.filter(hasDrawing)).slice(0, MAX_QUESTIONS_PER_ROUND).map((answer) => {
		const others = shuffle(pool.filter((card) => card.id !== answer.id)).slice(0, CHOICES_PER_QUESTION - 1)
		return { answer, choices: shuffle([answer, ...others]) }
	})
}

function QuizPage({ flashCards = [], onReviewed }) {
	const { t, translateMessage } = useLanguage()
	const [round, setRound] = useState([])
	const [questionIndex, setQuestionIndex] = useState(0)
	const [selectedChoice, setSelectedChoice] = useState(null)
	const [isChecked, setIsChecked] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [correctCount, setCorrectCount] = useState(0)
	const [coinsEarned, setCoinsEarned] = useState(0)
	const [saveError, setSaveError] = useState('')

	const drawnCards = flashCards.filter(hasDrawing)
	const sets = []
	for (const card of drawnCards) {
		const key = card.set_id ?? card.set_name
		let set = sets.find((item) => item.id === key)
		if (!set) {
			set = { id: key, name: card.set_name, cards: [] }
			sets.push(set)
		}
		set.cards.push(card)
	}
	const question = round[questionIndex]
	const isFinished = round.length > 0 && questionIndex >= round.length
	const isCorrect = isChecked && selectedChoice === question?.answer.id

	function setLabel(set) {
		if (!set.name || set.name === 'My Flash Cards') return t('home.defaultSet')
		const match = set.name.match(/^Set (\d+)$/)
		return match ? t('home.numberedSet', { number: match[1] }) : set.name
	}

	function startRound(setId) {
		const questionCards = setId === ALL_CARDS ? drawnCards : sets.find((set) => set.id === setId)?.cards ?? []
		setRound(buildRound(questionCards, drawnCards))
		setQuestionIndex(0)
		setSelectedChoice(null)
		setIsChecked(false)
		setCorrectCount(0)
		setCoinsEarned(0)
		setSaveError('')
	}

	async function checkAnswer() {
		if (!selectedChoice || isChecked || isSaving) return
		const correct = selectedChoice === question.answer.id
		setIsSaving(true)
		setSaveError('')
		try {
			const result = await recordReview(question.answer.id, { source: 'quiz', chosen_flashcard_id: selectedChoice })
			onReviewed?.(question.answer.id, result)
			setCoinsEarned((total) => total + (result.coins_awarded ?? 0))
		} catch (error) {
			setSaveError(translateMessage(error.message))
		} finally {
			setIsSaving(false)
		}
		setIsChecked(true)
		if (correct) setCorrectCount((count) => count + 1)
	}

	function nextQuestion() {
		setQuestionIndex((index) => index + 1)
		setSelectedChoice(null)
		setIsChecked(false)
		setSaveError('')
	}

	if (drawnCards.length < CHOICES_PER_QUESTION) {
		return (
			<main className="quiz-page">
				<section className="quiz-window quiz-message">
					<p className="quiz-eyebrow">{t('quiz.eyebrow')}</p>
					<h1>{t('quiz.needMoreTitle')}</h1>
					<p>{t('quiz.needMore', { needed: CHOICES_PER_QUESTION, count: drawnCards.length })}</p>
					<Link className="quiz-submit-button quiz-link-button" to="/draw">{t('quiz.createCards')}</Link>
				</section>
			</main>
		)
	}

	if (!question && !isFinished) {
		return (
			<main className="quiz-page">
				<section className="quiz-window quiz-message">
					<p className="quiz-eyebrow">{t('quiz.eyebrow')}</p>
					<h1>{t('quiz.chooseTitle')}</h1>
					<p>{t('quiz.chooseHelp')}</p>
					<div className="quiz-set-list">
						<button className="quiz-submit-button" onClick={() => startRound(ALL_CARDS)} type="button">
							{t('quiz.allCards', { count: Math.min(drawnCards.length, MAX_QUESTIONS_PER_ROUND) })}
						</button>
						{sets.length > 1 && sets.map((set) => (
							<button className="quiz-set-button" key={set.id} onClick={() => startRound(set.id)} type="button">
								{setLabel(set)} · {t('quiz.questionCount', { count: Math.min(set.cards.length, MAX_QUESTIONS_PER_ROUND) })}
							</button>
						))}
					</div>
				</section>
			</main>
		)
	}

	if (isFinished) {
		return (
			<main className="quiz-page">
				<section className="quiz-window quiz-message">
					<p className="quiz-eyebrow">{t('quiz.roundComplete')}</p>
					<h1>{t('quiz.score', { correct: correctCount, total: round.length })}</h1>
					<p>{coinsEarned ? t('quiz.coinsEarned', { count: coinsEarned }) : t('quiz.noCoins')}</p>
					<button className="quiz-submit-button" onClick={() => setRound([])} type="button">{t('quiz.playAgain')}</button>
				</section>
			</main>
		)
	}

	return (
		<main className="quiz-page">
			<section className="quiz-window">
				<div className="quiz-heading">
					<p className="quiz-eyebrow">{t('quiz.position', { current: questionIndex + 1, total: round.length })}</p>
					<h1 className="quiz-word" lang="en">{question.answer.name}</h1>
					<SpanishTranslation className="quiz-word-spanish" word={question.answer.name} />
				</div>

				<div aria-label={t('quiz.choices')} className="quiz-choice-grid" role="group">
					{question.choices.map((choice, index) => {
						const isSelected = selectedChoice === choice.id
						const isAnswer = choice.id === question.answer.id
						const stateClass = isChecked
							? isAnswer ? ' is-correct' : isSelected ? ' is-incorrect' : ''
							: ''
						return (
							<button
								aria-label={t('quiz.choiceLabel', { number: index + 1 })}
								aria-pressed={isSelected}
								className={`quiz-choice${isSelected ? ' is-selected' : ''}${stateClass}`}
								disabled={isChecked || isSaving}
								key={choice.id}
								onClick={() => setSelectedChoice(choice.id)}
								type="button"
							>
								<img alt="" className="quiz-drawing" src={choice.drawing} />
							</button>
						)
					})}
				</div>

				<div className="quiz-footer">
					<p aria-live="polite" className={`quiz-feedback${isChecked ? (isCorrect ? ' feedback-correct' : ' feedback-incorrect') : ''}`}>
						{isChecked
							? isCorrect
								? t('quiz.correct', { word: question.answer.name })
								: t('quiz.incorrect', { word: question.answer.name })
							: t('quiz.selectOne')}
						{saveError && <span className="quiz-save-error"> {t('quiz.notSaved', { error: saveError })}</span>}
					</p>
					{isChecked ? (
						<button className="quiz-submit-button" onClick={nextQuestion} type="button">
							{questionIndex + 1 < round.length ? t('quiz.next') : t('quiz.results')}
						</button>
					) : (
						<button className="quiz-submit-button" disabled={!selectedChoice || isSaving} onClick={checkAnswer} type="button">
							{isSaving ? t('quiz.checking') : t('quiz.check')}
						</button>
					)}
				</div>
			</section>
		</main>
	)
}

export default QuizPage
