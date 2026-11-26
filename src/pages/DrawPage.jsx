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
	const [enlargedImage, setEnlargedImage] = useState(null)
	const searchRequest = useRef(null)
	const enlargeDialogRef = useRef(null)

	useEffect(() => () => searchRequest.current?.abort(), [])

	useEffect(() => {
		const dialog = enlargeDialogRef.current
		if (!dialog) return
		if (enlargedImage && !dialog.open) dialog.showModal()
		if (!enlargedImage && dialog.open) dialog.close()
	}, [enlargedImage])

	function closeEnlargedImage() {
		setEnlargedImage(null)
	}

	function closeOnBackdropClick(event) {
		// Clicks on the dialog's own box (outside its content) land on the backdrop.
		if (event.target === event.currentTarget) closeEnlargedImage()
	}

	function searchPictures(event) {
		event.preventDefault()
		runSearch(search.trim(), 'all')
	}

	// Verbs and adjectives are often clearer as illustrations than as photos.
	function searchSuggestion(hint) {
		setSearch(hint.searchPhrase)
		runSearch(hint.searchPhrase, hint.partOfSpeech === 'noun' ? 'all' : 'illustration')
	}

	async function runSearch(query, type) {
		if (!query) return
		searchRequest.current?.abort()
		const controller = new AbortController()
		searchRequest.current = controller
		setIsSearching(true)
		setEnlargedImage(null)
		setImages(null)
		setSearchMessage('')
		try {
			const response = await fetch(`/api/images/search?${new URLSearchParams({ q: query, image_type: type })}`, {
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
										onClick={() => searchSuggestion(hint)}
										disabled={isSearching}
									>
										Search for this
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
							<figure className="reference-picture" key={image.id}>
								<button
									aria-label={`Enlarge picture: ${image.description}`}
									className="reference-thumb-button"
									onClick={() => setEnlargedImage(image)}
									type="button"
								>
									<img src={image.thumbnail} alt="" loading="lazy" />
								</button>
							</figure>
						))}
					</div>
					<p className="picture-search-credit">Pictures from Pixabay. Tap a picture to see it larger.</p>
					<dialog
						aria-labelledby="enlarged-picture-title"
						className="enlarged-picture-dialog"
						onCancel={closeEnlargedImage}
						onClick={closeOnBackdropClick}
						onClose={closeEnlargedImage}
						ref={enlargeDialogRef}
					>
						{enlargedImage && (
							<div className="enlarged-picture-content">
								<div className="enlarged-picture-header">
									<h2 id="enlarged-picture-title">Reference picture</h2>
									<button className="enlarged-picture-close" type="button" onClick={closeEnlargedImage} autoFocus>
										Close
									</button>
								</div>
								<img src={enlargedImage.thumbnail} alt={enlargedImage.description} />
								<p className="enlarged-picture-description">{enlargedImage.description}</p>
								<p className="enlarged-picture-credit">Pictures from Pixabay.</p>
							</div>
						)}
					</dialog>
				</aside>
			</section>
		</main>
	)
}

export default DrawPage
