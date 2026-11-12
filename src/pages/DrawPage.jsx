import { useEffect, useRef, useState } from 'react'
import { FaSearch } from "react-icons/fa";
import { getNextWord, saveFlashCard as saveFlashCardRequest } from '../api/flashcards.js'
import '../styles/DrawPage.css'

function DrawPage({ flashCards, onSaveFlashCard }) {
	const [search, setSearch] = useState('')
	const [saveMessage, setSaveMessage] = useState('')
	const [wordError, setWordError] = useState('')
	const [currentWord, setCurrentWord] = useState(null)
	const [isLoadingWord, setIsLoadingWord] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [wordRefresh, setWordRefresh] = useState(0)
	const canvasRef = useRef(null)
	const drawingRef = useRef(false)

	useEffect(() => {
		let cancelled = false

		getNextWord(flashCards.map((flashCard) => flashCard.name))
			.then((word) => {
				if (cancelled) return
				setCurrentWord(word)
				if (!word) setSaveMessage('You have made flash cards for every available word.')
			})
			.catch((error) => {
				if (cancelled) return
				setCurrentWord(null)
				setWordError(error.message)
			})
			.finally(() => {
				if (!cancelled) setIsLoadingWord(false)
			})

		return () => {
			cancelled = true
		}
	}, [flashCards, wordRefresh])

	function getCanvasPoint(event) {
		const canvas = canvasRef.current
		const bounds = canvas.getBoundingClientRect()

		return {
			x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
			y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
		}
	}

	function startDrawing(event) {
		const canvas = canvasRef.current
		const context = canvas.getContext('2d')
		const point = getCanvasPoint(event)

		drawingRef.current = true
		canvas.setPointerCapture(event.pointerId)
		context.beginPath()
		context.moveTo(point.x, point.y)
		context.strokeStyle = '#db7900'
		context.lineWidth = 5
		context.lineCap = 'round'
		context.lineJoin = 'round'
	}

	function continueDrawing(event) {
		if (!drawingRef.current) return

		const point = getCanvasPoint(event)
		const context = canvasRef.current.getContext('2d')
		context.lineTo(point.x, point.y)
		context.stroke()
	}

	function stopDrawing() {
		drawingRef.current = false
	}

	function clearDrawing() {
		const canvas = canvasRef.current
		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
	}

	async function saveFlashCard() {
		if (!currentWord || isSaving) {
			return
		}

		setIsSaving(true)
		try {
			const flashCard = await saveFlashCardRequest({
				wordId: currentWord.word_id,
				drawing: canvasRef.current.toDataURL(),
			})
			setIsLoadingWord(true)
			setWordError('')
			clearDrawing()
			onSaveFlashCard(flashCard)
			setSaveMessage(`"${flashCard.name}" was saved to your flash cards.`)
		} catch (error) {
			setSaveMessage(error.message)
			if (error.status === 409) {
				setIsLoadingWord(true)
				setWordError('')
				setWordRefresh((currentRefresh) => currentRefresh + 1)
			}
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<main className="draw-page">
			<section aria-label="Draw and explore images" className="draw-workspace">
				<div className="drawing-column">
					<label className="draw-word-label">Draw this word</label>
					<label className="draw-word">
						{isLoadingWord
							? 'Loading a word...'
							: wordError
								? 'Word unavailable'
								: currentWord?.word ?? 'All words completed'}
					</label>

					<div className="drawing-toolbar">
						<p>Use your mouse or finger to draw</p>
						<div className="drawing-actions">
							<button className="clear-drawing-button" onClick={clearDrawing} type="button">
								Clear
							</button>
							<button
								className="save-flashcard-button"
								disabled={!currentWord || isLoadingWord || isSaving}
								onClick={saveFlashCard}
								type="button"
							>
								{isSaving ? 'Saving...' : 'Save flash card'}
							</button>
						</div>
					</div>
					<p className="flashcard-save-message" aria-live="polite" role="status">
						{wordError || saveMessage}
					</p>
					<div className="drawing-canvas-wrap">
						<canvas
							className="drawing-canvas"
							height="560"
							onPointerCancel={stopDrawing}
							onPointerDown={startDrawing}
							onPointerMove={continueDrawing}
							onPointerUp={stopDrawing}
							ref={canvasRef}
							width="800"
						/>
						<span aria-hidden="true" className="canvas-hint">Your drawing goes here</span>
					</div>
				</div>

				<aside aria-labelledby="reference-title" className="reference-column">
					<div className="reference-heading">
						<p className="draw-eyebrow">Get inspired</p>
						<h1 id="reference-title">Picture search</h1>
					</div>
					<form className="image-search" onSubmit={searchPictures}>
						<FaSearch aria-hidden="true" className="image-search-icon"/>
						<input
							id="image-search-input"
							aria-label="Search pictures"
							maxLength={80}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search pictures..."
							type="search"
							value={search}
						/>
						<button type="submit" disabled={loading || !search.trim()}>Search</button>
					</form>

					<p role="status" className="reference-status">
						{loading ? 'Searching for pictures…' : message ||
							(results?.length === 0 ? 'No pictures found. Try a more specific phrase.' : '')}
					</p>
					{results?.length > 0 && <div className="reference-gallery">
						{results.map(({ id, source, thumbnail, description }) => (
							<a key={id} href={source} target="_blank" rel="noreferrer">
								<img src={thumbnail} alt={description} loading="lazy" referrerPolicy="no-referrer" />
							</a>
						))}
					</div>}
					<p className="reference-credit">Reference images from <a href="https://pixabay.com/">Pixabay</a>.</p>
				</aside>
			</section>
		</main>
	)
}

export default DrawPage
