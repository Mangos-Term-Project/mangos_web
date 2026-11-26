import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FaPencilAlt, FaSearch } from "react-icons/fa";
import { getNextWord, saveFlashCard as saveFlashCardRequest } from '../api/flashcards.js'
import '../styles/DrawPage.css'
import { getWordHints } from '../data/wordHints.js'
import { useLanguage } from '../i18n/language.js'
import SpanishTranslation from '../components/SpanishTranslation.jsx'
import { updateDrawing } from '../api/account.js'

function DrawPage({ flashCards, onSaveFlashCard, onDrawingUpdated }) {
	const { t, translateMessage } = useLanguage()
	const location = useLocation()
	// Arriving from Home's "Edit drawing" opens that card in edit mode right away,
	// with the picture search for its word already started.
	const [openedFromHome] = useState(() => {
		const card = flashCards.find((item) => item.id === location.state?.editCardId)
		if (!card) return null
		const [hint] = getWordHints(card.name)
		return {
			card,
			query: hint?.searchPhrase ?? card.name,
			type: hint && hint.partOfSpeech !== 'noun' ? 'illustration' : 'all',
		}
	})
	const [search, setSearch] = useState(openedFromHome?.query ?? '')
	const [images, setImages] = useState(null)
	const [searchMessage, setSearchMessage] = useState('')
	const [isSearching, setIsSearching] = useState(Boolean(openedFromHome))
	const [enlargedImage, setEnlargedImage] = useState(null)
	const [imageType, setImageType] = useState(openedFromHome?.type ?? 'all')
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
		// Typing a search while "My drawings" is open searches every picture type.
		const type = imageType === 'mine' ? 'all' : imageType
		if (type !== imageType) setImageType(type)
		runSearch(search.trim(), type)
	}

	// Verbs and adjectives are often clearer as drawings than as photos, so their
	// suggested searches use illustrations; nouns search every picture type.
	function searchSuggestion(hint) {
		const type = hint.partOfSpeech === 'noun' ? 'all' : 'illustration'
		setSearch(hint.searchPhrase)
		setImageType(type)
		runSearch(hint.searchPhrase, type)
	}

	function changeImageType(type) {
		setImageType(type)
		// "My drawings" shows the learner's own saved drawings; no search needed.
		if (type === 'mine') return
		if (search.trim()) runSearch(search.trim(), type)
	}

	function runSearch(query, type) {
		if (!query) return
		searchRequest.current?.abort()
		const controller = new AbortController()
		searchRequest.current = controller
		setIsSearching(true)
		setEnlargedImage(null)
		setImages(null)
		setSearchMessage('')
		fetchPictures(query, type, controller)
	}

	// Only sets state after the response arrives, so it can also run from an effect.
	async function fetchPictures(query, type, controller) {
		try {
			const response = await fetch(`/api/images/search?${new URLSearchParams({ q: query, image_type: type })}`, {
				credentials: 'same-origin', signal: controller.signal,
			})
			const data = await response.json().catch(() => null)
			if (!response.ok) throw new Error(typeof data?.detail === 'string'
				? data.detail : t('draw.searchUnavailable'))
			if (!Array.isArray(data?.images)) throw new Error(t('draw.searchUnavailable'))
			if (!controller.signal.aborted) setImages(data.images)
		} catch (error) {
			if (!controller.signal.aborted) setSearchMessage(translateMessage(error.message) || t('draw.searchFailed'))
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
	const [allWordsDone, setAllWordsDone] = useState(false)
	const canvasRef = useRef(null)
	const drawingRef = useRef(false)
	const [editingCard, setEditingCard] = useState(openedFromHome?.card ?? null)
	const [hasStrokes, setHasStrokes] = useState(() => Boolean(editingCard?.drawing))
	// A new drawing in progress is kept while a saved card is being edited.
	const unfinishedDrawingRef = useRef(null)
	const paintRequestRef = useRef(0)
	// Only the saved words matter for picking the next word, so editing a
	// drawing (which changes flashCards) does not swap the current word.
	const savedWordsKey = flashCards.map((flashCard) => flashCard.name.toLowerCase()).sort().join('\n')
	const newestFirst = [...flashCards].reverse()
	const ownDrawings = newestFirst.filter((card) => card.drawing)

	useEffect(() => {
		let cancelled = false

		getNextWord(savedWordsKey ? savedWordsKey.split('\n') : [])
			.then((word) => {
				if (cancelled) return
				setCurrentWord(word)
				setAllWordsDone(!word)
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
	}, [savedWordsKey, wordRefresh])

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
		setHasStrokes(true)
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
		setHasStrokes(false)
		paintRequestRef.current += 1
		const canvas = canvasRef.current
		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
	}

	// Puts a saved drawing (a PNG data URL) on the canvas, or clears it.
	function paintCanvas(dataUrl) {
		const canvas = canvasRef.current
		if (!canvas) return
		const request = paintRequestRef.current + 1
		paintRequestRef.current = request
		const context = canvas.getContext('2d')
		context.clearRect(0, 0, canvas.width, canvas.height)
		if (!dataUrl) return
		const image = new Image()
		image.onload = () => {
			// Ignore a slow image if another drawing was opened since.
			if (paintRequestRef.current === request) context.drawImage(image, 0, 0, canvas.width, canvas.height)
		}
		image.src = dataUrl
	}

	// Show the opened card's drawing when the page opens straight into edit mode.
	useEffect(() => {
		if (editingCard) {
			paintCanvas(editingCard.drawing)
			// Forget the request so a later refresh opens the normal Draw page.
			window.history.replaceState({ ...window.history.state, usr: undefined }, '')
			// Pictures for the card's word, as when a card is opened from the list below.
			const controller = new AbortController()
			searchRequest.current = controller
			fetchPictures(openedFromHome.query, openedFromHome.type, controller)
		}
		// Runs once on mount; later card switches paint in startEditing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function startEditing(card) {
		if (editingCard?.id === card.id) return
		if (!editingCard) unfinishedDrawingRef.current = hasStrokes ? canvasRef.current.toDataURL() : null
		setEditingCard(card)
		setHasStrokes(Boolean(card.drawing))
		paintCanvas(card.drawing)
		setSaveMessage('')
		const [firstHint] = getWordHints(card.name)
		if (firstHint) searchSuggestion(firstHint)
		else {
			setSearch(card.name)
			runSearch(card.name, imageType)
		}
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	function stopEditing(message = '') {
		setEditingCard(null)
		const unfinished = unfinishedDrawingRef.current
		unfinishedDrawingRef.current = null
		setHasStrokes(Boolean(unfinished))
		paintCanvas(unfinished)
		setSaveMessage(message)
	}

	async function saveChanges() {
		if (!editingCard || isSaving) return
		setIsSaving(true)
		try {
			const result = await updateDrawing(editingCard.id, canvasRef.current.toDataURL('image/png'))
			onDrawingUpdated?.(editingCard.id, result.drawing)
			stopEditing(t('draw.changesSaved', { word: editingCard.name }))
		} catch (error) {
			setSaveMessage(translateMessage(error.message))
		} finally {
			setIsSaving(false)
		}
	}

	async function saveFlashCard() {
		if (editingCard) {
			saveChanges()
			return
		}
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
			setSaveMessage(flashCard.coins_awarded
				? t('draw.savedWithCoins', { word: flashCard.name, count: flashCard.coins_awarded })
				: t('draw.saved', { word: flashCard.name }))
		} catch (error) {
			setSaveMessage(translateMessage(error.message))
			if (error.status === 409) {
				setIsLoadingWord(true)
				setWordError('')
				setWordRefresh((currentRefresh) => currentRefresh + 1)
			}
		} finally {
			setIsSaving(false)
		}
	}
	const hints = editingCard
		? getWordHints(editingCard.name)
		: !isLoadingWord && !wordError ? getWordHints(currentWord?.word) : []
	const showPartOfSpeech = hints.length > 1

	return (
		<main className="draw-page">
			<section aria-label={t('draw.workspaceLabel')} className="draw-workspace">
				<div className="drawing-column">
					{editingCard && (
						<div className="editing-banner" role="status">
							<p>{t('draw.editingBanner', { word: editingCard.name })}</p>
							<button className="editing-cancel" onClick={() => stopEditing()} type="button">
								{t('draw.cancelEditing')}
							</button>
						</div>
					)}
					<label className="draw-word-label">{editingCard ? t('draw.editingLabel') : t('draw.drawThisWord')}</label>
					<label className="draw-word">
						{editingCard
							? editingCard.name
							: isLoadingWord
								? t('draw.loadingWord')
								: wordError
									? t('draw.wordUnavailable')
									: currentWord?.word ?? t('draw.allWordsCompleted')}
					</label>
					{editingCard
						? <SpanishTranslation className="draw-word-spanish" word={editingCard.name} />
						: !isLoadingWord && !wordError && currentWord && <SpanishTranslation className="draw-word-spanish" word={currentWord.word} />}
					{hints.length > 0 && (
						<div className="word-hint">
							{hints.map((hint) => (
								<div className="word-hint-entry" key={hint.partOfSpeech}>
									{showPartOfSpeech && (
										<p className="word-hint-part">{t(`draw.as.${hint.partOfSpeech}`)}</p>
									)}
									<p><strong>{t('draw.meaning')}</strong> <span lang="en">{hint.definition}</span></p>
									<p>
										{t('draw.suggestedSearch')} <strong lang="en">{hint.searchPhrase}</strong>
									</p>
									<button
										className="use-hint-button"
										type="button"
										onClick={() => searchSuggestion(hint)}
										disabled={isSearching}
									>
										{t('draw.useSuggestion')}
									</button>
								</div>
							))}
						</div>
					)}
					<div className="drawing-toolbar">
						<p>{t('draw.instructions')}</p>
						<div className="drawing-actions">
							<button className="clear-drawing-button" onClick={clearDrawing} type="button">
								{t('draw.clear')}
							</button>
							<button
								className="save-flashcard-button"
								disabled={editingCard ? isSaving : !currentWord || isLoadingWord || isSaving}
								onClick={saveFlashCard}
								type="button"
							>
								{isSaving ? t('draw.saving') : editingCard ? t('draw.saveChanges') : t('draw.save')}
							</button>
						</div>
					</div>
					<p className="flashcard-save-message" aria-live="polite" role="status">
						{translateMessage(wordError) || saveMessage || (allWordsDone ? t('draw.allDone') : '')}
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
						{!hasStrokes && <span aria-hidden="true" className="canvas-hint">{t('draw.canvasHint')}</span>}
					</div>
				</div>

				<aside aria-labelledby="reference-title" className="reference-column">
					<div className="reference-heading">
						<p className="draw-eyebrow">{t('draw.getInspired')}</p>
						<h1 id="reference-title">{t('draw.pictureSearch')}</h1>
					</div>
					<form className="image-search" onSubmit={searchPictures}>
						<FaSearch className="image-search-icon" aria-hidden="true" />
						<input
							id="image-search-input"
							aria-label={t('draw.searchLabel')}
							maxLength={80}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('draw.searchPlaceholder')}
							type="search"
							value={search}
						/>
						<button className="picture-search-button" type="submit" disabled={isSearching || !search.trim()}>
							{isSearching ? t('draw.searching') : t('draw.search')}
						</button>
					</form>
					<fieldset className="picture-type">
						<legend>{t('draw.pictureType')}</legend>
						{[
							['all', 'draw.typeAll'],
							['illustration', 'draw.typeDrawings'],
							['photo', 'draw.typePhotos'],
							['mine', 'draw.typeMine'],
						].map(([type, label]) => (
							<label className={`picture-type-option${type === 'mine' ? ' is-mine' : ''}${imageType === type ? ' is-selected' : ''}`} key={type}>
								<input
									checked={imageType === type}
									disabled={isSearching && type !== 'mine'}
									name="picture-type"
									onChange={() => changeImageType(type)}
									type="radio"
									value={type}
								/>
								{t(label)}
							</label>
						))}
					</fieldset>
					{imageType === 'mine' ? (
						<>
							<p className="picture-search-status" role="status">
								{ownDrawings.length ? t('draw.myDrawingsHelp') : t('draw.noOwnDrawings')}
							</p>
							<div className="reference-gallery">
								{ownDrawings.map((card) => (
									<figure
										className={`reference-picture own-drawing${editingCard?.id === card.id ? ' is-editing' : ''}`}
										key={card.id}
									>
										<button
											aria-current={editingCard?.id === card.id ? 'true' : undefined}
											aria-label={t('draw.editCard', { word: card.name })}
											className="reference-thumb-button"
											onClick={() => startEditing(card)}
											type="button"
										>
											<img alt="" loading="lazy" src={card.drawing} />
										</button>
										<figcaption lang="en">{card.name}</figcaption>
									</figure>
								))}
							</div>
						</>
					) : (
					<>
					<p className="picture-search-status" role="status">
						{isSearching ? t('draw.lookingForPictures') : searchMessage ||
							(images?.length === 0 ? t('draw.noPictures') : '')}
					</p>
					<div className="reference-gallery" aria-busy={isSearching}>
						{images?.map((image) => (
							<figure className="reference-picture" key={image.id}>
								<button
									className="reference-thumb-button"
									type="button"
									onClick={() => setEnlargedImage(image)}
									aria-label={t('draw.enlarge', { description: image.description })}
								>
									<img src={image.thumbnail} alt="" loading="lazy" />
								</button>
							</figure>
						))}
					</div>
					<p className="picture-search-credit">
						{t('draw.pictureCredit')} {t('draw.pictureHelp')}
					</p>
					</>
					)}
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
									<h2 id="enlarged-picture-title">{t('draw.referencePicture')}</h2>
									<button className="enlarged-picture-close" type="button" onClick={closeEnlargedImage} autoFocus>
										{t('draw.close')}
									</button>
								</div>
								<img src={enlargedImage.thumbnail} alt={enlargedImage.description} />
								<p className="enlarged-picture-description">{enlargedImage.description}</p>
								<p className="enlarged-picture-credit">{t('draw.pictureCredit')}</p>
							</div>
						)}
					</dialog>
				</aside>
			</section>

			{flashCards.length > 0 && (
				<section aria-labelledby="saved-cards-title" className="saved-cards">
					<div className="saved-cards-heading">
						<h2 id="saved-cards-title">{t('draw.savedCardsTitle', { count: flashCards.length })}</h2>
						<p>{t('draw.savedCardsHelp')}</p>
					</div>
					<ul className="saved-cards-list">
						{newestFirst.map((card) => (
							<li className={`saved-card${editingCard?.id === card.id ? ' is-editing' : ''}`} key={card.id}>
								{/* Tapping the drawing opens it for editing, like the Edit button. */}
								<button
									aria-label={t('draw.editCard', { word: card.name })}
									className="saved-card-picture"
									aria-current={editingCard?.id === card.id ? 'true' : undefined}
									onClick={() => startEditing(card)}
									type="button"
								>
									{card.drawing
										? <img alt="" src={card.drawing} />
										: <span className="saved-card-empty">{t('home.noDrawing')}</span>}
								</button>
								<span className="saved-card-word" lang="en">{card.name}</span>
								<button
									aria-label={t('draw.editCard', { word: card.name })}
									className="saved-card-edit"
									aria-current={editingCard?.id === card.id ? 'true' : undefined}
									onClick={() => startEditing(card)}
									type="button"
								>
									<FaPencilAlt aria-hidden="true" /> {t('draw.edit')}
								</button>
							</li>
						))}
					</ul>
				</section>
			)}
		</main>
	)
}

export default DrawPage
