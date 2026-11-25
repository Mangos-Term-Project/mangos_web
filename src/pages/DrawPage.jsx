import { useEffect, useRef, useState } from 'react'
import { FaSearch } from "react-icons/fa";
import { getNextWord, saveFlashCard as saveFlashCardRequest } from '../api/flashcards.js'
import '../styles/DrawPage.css'
import { getWordHints } from '../data/wordHints.js'

function DrawPage({ flashCards, onSaveFlashCard }) {
	const [search, setSearch] = useState('')
	const [images, setImages] = useState(null)
	const [searchMessage, setSearchMessage] = useState('')
	const [isSearching, setIsSearching] = useState(false)
	const searchRequest = useRef(null)

	useEffect(() => () => searchRequest.current?.abort(), [])

	async function searchPictures(event) {
		event.preventDefault()
		const query = search.trim()
		if (!query) return
		searchRequest.current?.abort()
		const controller = new AbortController()
		searchRequest.current = controller
		setIsSearching(true)
		setImages(null)
		setSearchMessage('')
		try {
			const response = await fetch(`/api/images/search?${new URLSearchParams({ q: query })}`, {
				credentials: 'same-origin', signal: controller.signal,
			})
			const data = await response.json().catch(() => null)
			if (!response.ok) throw new Error(typeof data?.detail === 'string'
				? data.detail : 'Picture search is unavailable. Please try again.')
			if (!Array.isArray(data?.images)) throw new Error('Picture search is unavailable. Please try again.')
			if (!controller.signal.aborted) setImages(data.images)
		} catch (error) {
			if (!controller.signal.aborted) setSearchMessage(error.message || 'Could not load pictures.')
		} finally {
			if (!controller.signal.aborted) setIsSearching(false)
		}
	}
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
	const hints = !isLoadingWord && !wordError ? getWordHints(currentWord?.word) : []
	const showPartOfSpeech = hints.length > 1

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
					{hints.length > 0 && (
						<div className="word-hint">
							{hints.map((hint) => (
								<div className="word-hint-entry" key={hint.partOfSpeech}>
									{showPartOfSpeech && (
										<p className="word-hint-part">As {hint.partOfSpeech === 'adjective' ? 'an' : 'a'} {hint.partOfSpeech}:</p>
									)}
									<p><strong>Meaning:</strong> {hint.definition}</p>
									<p>
										Suggested picture search: <strong>{hint.searchPhrase}</strong>
									</p>
									<button
										className="use-hint-button"
										type="button"
										onClick={() => setSearch(hint.searchPhrase)}
										disabled={isSearching}
									>
										Use suggested phrase
									</button>
								</div>
							))}
						</div>
					)}
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
						<FaSearch className="image-search-icon" aria-hidden="true" />
						<input
							id="image-search-input"
							aria-label="Search reference pictures"
							maxLength={80}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search pictures..."
							type="search"
							value={search}
						/>
						<button className="picture-search-button" type="submit" disabled={isSearching || !search.trim()}>
							{isSearching ? 'Searching…' : 'Search'}
						</button>
					</form>
					<p className="picture-search-status" role="status">
						{isSearching ? 'Looking for reference pictures…' : searchMessage ||
							(images?.length === 0 ? 'No pictures found. Try a related word, such as clock for time.' : '')}
					</p>
					<div className="reference-gallery" aria-busy={isSearching}>
						{images?.map((image) => (
							<a className="reference-picture" key={image.id} href={image.source}
								target="_blank" rel="noreferrer" aria-label="View source on Pixabay">
								<img src={image.thumbnail} alt={image.description} loading="lazy" />
								<span>View on Pixabay ↗</span>
							</a>
						))}
					</div>
					<p className="picture-search-credit">Reference pictures from <a href="https://pixabay.com/" target="_blank" rel="noreferrer">Pixabay</a>.
						Use these as inspiration for your own drawing.
					</p>
				</aside>
			</section>
		</main>
	)
}

export default DrawPage
