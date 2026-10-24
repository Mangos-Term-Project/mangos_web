import { useState } from 'react'
import { FaImage } from "react-icons/fa";
import '../styles/QuizPage.css'

const answerImages = [
	{ id: 'choice1', label: 'choice1', kind: 'choice1', correct: true },
	{ id: 'choice2', label: 'choice2', kind: 'choice2', correct: false },
	{ id: 'choice3', label: 'choice3', kind: 'choice3', correct: false },
	{ id: 'choice4', label: 'choice4', kind: 'choice4', correct: false },
]

function Drawing({ kind, label }) {
	return (
		<svg aria-label={label} className='quiz-drawing' role="img" viewBox="0 0 240 160">
			{kind === 'choice1' && (
				< FaImage />
			)}
			{kind === 'choice2' && (
				< FaImage />
			)}
			{kind === 'choice3' && (
				< FaImage />
			)}
			{kind === 'choice4' && (
				< FaImage />
			)}
		</svg>
	)
}

function QuizPage() {
	const [choices] = useState(() => answerImages)
	const [selectedChoice, setSelectedChoice] = useState(null)
	const [isChecked, setIsChecked] = useState(false)

	function checkAnswer() {
		if (selectedChoice) setIsChecked(true)
	}

	function tryAgain() {
		setSelectedChoice(null)
		setIsChecked(false)
	}

	const selectedAnswer = choices.find((choice) => choice.id === selectedChoice)

	return (
		<main className="quiz-page">
			<section className="quiz-window">

				<div className="quiz-heading">
					<p className="quiz-eyebrow">Set 1 of 1 · Question 1 of 100</p>
					<h1 className="quiz-word">Time</h1>
				</div>

				<div aria-label="Picture choices" className="quiz-choice-grid">
					{choices.map((choice) => {
						const isSelected = selectedChoice === choice.id
						const isCorrect = isChecked && isSelected && choice.correct
						const isIncorrect = isChecked && isSelected && !choice.correct

						return (
							<button
								aria-pressed={isSelected}
								className={`quiz-choice${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isIncorrect ? ' is-incorrect' : ''}`}
								disabled={isChecked}
								key={choice.id}
								onClick={() => setSelectedChoice(choice.id)}
								type="button"
							>
								<Drawing kind={choice.kind} label={choice.label} />
							</button>
						)
					})}
				</div>

				<div className="quiz-footer">
					<p aria-live="polite" className={`quiz-feedback${isChecked ? (selectedAnswer?.correct ? ' feedback-correct' : ' feedback-incorrect') : ''}`}>
						{isChecked
							? selectedAnswer?.correct ? 'That\'s right! You found the picture for “time.”' : 'Not quite—take another look and try again.'
							: 'Select one picture to answer.'}
					</p>
					{isChecked ? (
						<button className="quiz-submit-button" onClick={tryAgain} type="button">Try again</button>
					) : (
						<button className="quiz-submit-button" disabled={!selectedChoice} onClick={checkAnswer} type="button">
							Check answer
						</button>
					)}
				</div>
			</section>
		</main>
	)
}

export default QuizPage
