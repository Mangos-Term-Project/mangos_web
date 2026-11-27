import { useEffect, useMemo, useRef, useState } from 'react'
import { FaSearch } from "react-icons/fa";
import { getNextWord, saveFlashCard as saveFlashCardRequest } from '../api/flashcards.js'
import { translateDefinition, useLanguage } from '../i18n.jsx'
import '../styles/DrawPage.css'

function getDrawingCursor(tool, brushSize) {
	if (tool === 'eraser') {
		const diameter = Math.max(2, brushSize)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}px" height="${diameter}px" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#2f241b" stroke-width="8"/></svg>`
		return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${diameter / 2} ${diameter / 2}, crosshair`
	}
	return 'crosshair'
}

function DrawPage({ onSaveFlashCard }) {
	const { language, t } = useLanguage()
	const [search, setSearch] = useState('')
	const [images, setImages] = useState(null)
	const [searchMessage, setSearchMessage] = useState('')
	const [isSearching, setIsSearching] = useState(false)
	const [enlargedImage, setEnlargedImage] = useState(null)
	// Hand-picked pictures for the current word (checked for meaning and for young learners).
	const [picked, setPicked] = useState(null)
	const [resultsArePicked, setResultsArePicked] = useState(false)
	const [searchGroups, setSearchGroups] = useState(null)
	const searchRequest = useRef(null)
	const enlargeDialogRef = useRef(null)
	const setCompletedDialogRef = useRef(null)

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
		// A meaning with hand-picked pictures shows those, not an open search.
		const pickedGroup = pickedGroups?.find((group) => group.part === hint.partOfSpeech && (group.sense ?? 0) === (hint.sense ?? 0))
		if (pickedGroup) {
			searchRequest.current?.abort()
			setEnlargedImage(null)
			setSearchMessage('')
			setIsSearching(false)
			setImages(pickedGroup.images)
			setResultsArePicked(true)
			setSearchGroups(null)
			return
		}
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
		setResultsArePicked(false)
		setSearchGroups(null)
		setSearchMessage('')
		try {
			const response = await fetch(`/api/images/search?${new URLSearchParams({ q: query, image_type: type })}`, {
				credentials: 'same-origin', signal: controller.signal,
			})
			const data = await response.json().catch(() => null)
			if (!response.ok) throw new Error(typeof data?.detail === 'string'
				? data.detail : 'Picture search is unavailable. Please try again.')
			if (!Array.isArray(data?.images)) throw new Error('Picture search is unavailable. Please try again.')
			if (!controller.signal.aborted) {
				setImages(data.images)
				setResultsArePicked(Boolean(data.picked))
				setSearchGroups(data.picked && Array.isArray(data.groups) && data.groups.length > 1 ? data.groups : null)
			}
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
	const [completedSetName, setCompletedSetName] = useState('')
	const [activeTool, setActiveTool] = useState('pencil')
	const [brushColor, setBrushColor] = useState('#2f241b')
	const [brushSize, setBrushSize] = useState(6)
	const [canUndo, setCanUndo] = useState(false)
	const canvasRef = useRef(null)
	const drawingRef = useRef(false)
	const undoStackRef = useRef([])
	const brushOptions = [
		{ id: 'pencil', label: 'Pencil', sizeMultiplier: 1, alpha: 1 },
		{ id: 'marker', label: 'Marker', sizeMultiplier: 2.5, alpha: 0.48 },
	]
	const drawingColors = [
		{ value: '#2f241b', label: 'Cocoa' },
		{ value: '#db7900', label: 'Mango' },
		{ value: '#d94f3d', label: 'Tomato' },
		{ value: '#3978b8', label: 'Blueberry' },
		{ value: '#578447', label: 'Leaf' },
		{ value: '#8a5bb5', label: 'Grape' },
		{ value: '#ef8ba8', label: 'Pink' },
	]

	// Shown under "Pictures picked for this word" as soon as the word appears.
	async function loadPicked(word, partOfSpeech) {
		try {
			const response = await fetch(`/api/images/word?${new URLSearchParams({ word, part_of_speech: partOfSpeech })}`, { credentials: 'same-origin' })
			const data = await response.json().catch(() => null)
			if (response.ok && Array.isArray(data?.images) && data.images.length) setPicked({ word, groups: Array.isArray(data.groups) && data.groups.length ? data.groups : [{ part: '', images: data.images }] })
		} catch {
			// The word can still be drawn; the search box below still works.
		}
	}

	useEffect(() => {
		let cancelled = false

		getNextWord()
			.then((word) => {
				if (cancelled) return
				setCurrentWord(word)
				if (word) loadPicked(word.word, word.part_of_speech)
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
	}, [wordRefresh])

	useEffect(() => {
		const dialog = setCompletedDialogRef.current
		if (!dialog) return
		if (completedSetName && !dialog.open) dialog.showModal()
		if (!completedSetName && dialog.open) dialog.close()
	}, [completedSetName])

	function closeSetCompletedDialog() {
		setCompletedSetName('')
	}

	function getCanvasPoint(event) {
		const canvas = canvasRef.current
		const bounds = canvas.getBoundingClientRect()

		return {
			x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
			y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
		}
	}

	function saveUndoState() {
		const canvas = canvasRef.current
		if (!canvas) return
		const context = canvas.getContext('2d')
		undoStackRef.current = [...undoStackRef.current, context.getImageData(0, 0, canvas.width, canvas.height)].slice(-10)
		setCanUndo(true)
	}

	function startDrawing(event) {
		const canvas = canvasRef.current
		const context = canvas.getContext('2d')
		const point = getCanvasPoint(event)
		const selectedBrush = brushOptions.find((brush) => brush.id === activeTool)

		saveUndoState()
		drawingRef.current = true
		canvas.setPointerCapture(event.pointerId)
		context.beginPath()
		context.moveTo(point.x, point.y)
		context.strokeStyle = brushColor
		context.lineWidth = brushSize * (selectedBrush?.sizeMultiplier ?? 1)
		context.globalAlpha = selectedBrush?.alpha ?? 1
		context.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over'
		context.lineCap = 'round'
		context.lineJoin = 'round'
		context.lineTo(point.x + 0.01, point.y + 0.01)
		context.stroke()
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
		const context = canvasRef.current?.getContext('2d')
		if (context) {
			context.globalAlpha = 1
			context.globalCompositeOperation = 'source-over'
		}
	}

	function clearDrawing() {
		const canvas = canvasRef.current
		if (!canvas) return
		saveUndoState()
		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
	}

	function undoDrawing() {
		const canvas = canvasRef.current
		const previousState = undoStackRef.current.pop()
		if (!canvas || !previousState) return
		canvas.getContext('2d').putImageData(previousState, 0, 0)
		setCanUndo(undoStackRef.current.length > 0)
	}

	function resetDrawing() {
		const canvas = canvasRef.current
		if (!canvas) return
		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
		undoStackRef.current = []
		setCanUndo(false)
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
				setId: currentWord.set_id,
			})
			setIsLoadingWord(true)
			setWordError('')
			resetDrawing()
			onSaveFlashCard(flashCard)
			setSaveMessage(`saved:${flashCard.name}`)
			if (flashCard.setCompleted) setCompletedSetName(flashCard.setName)
			setWordRefresh((currentRefresh) => currentRefresh + 1)
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
	const hints = useMemo(
		() => !isLoadingWord && !wordError ? currentWord?.hints ?? [] : [],
		[isLoadingWord, wordError, currentWord],
	)
	const showPartOfSpeech = hints.length > 1
	const [translatedDefinitions, setTranslatedDefinitions] = useState({})

	useEffect(() => {
		let cancelled = false
		const definitions = [...new Set(hints.flatMap((hint) => hint.senses.map((sense) => sense.definition)))]
		Promise.all(definitions.map(async (definition) => [definition, await translateDefinition(definition, language)]))
			.then((entries) => {
				if (!cancelled) setTranslatedDefinitions(Object.fromEntries(entries))
			})
		return () => { cancelled = true }
	}, [currentWord, hints, language])

	const pickedGroups = picked && picked.word === currentWord?.word ? picked.groups : null
	// Search results show as one group; hand-picked pictures show one group per part of speech.
	// Nothing shows until the learner searches; picked pictures are what a search returns.
	const galleryGroups = searchGroups ?? (images ? [{ part: '', images }] : [])
	const saveStatusMessage = saveMessage.startsWith('saved:')
		? `“${saveMessage.slice('saved:'.length)}” ${t('was saved to your flash cards.')}`
		: t(wordError || saveMessage)
	// Label hand-picked groups by part of speech and meaning when a word has more than one.
	// Labels for a typed word's groups: part of speech, plus the meaning number when
	// the same part has more than one (for example "As an adjective, meaning 2").
	function groupLabel(group) {
		if (!group.part) return ''
		const sameParts = galleryGroups.filter((item) => item.part === group.part).length
		const parts = new Set(galleryGroups.map((item) => item.part)).size
		const label = parts > 1 || sameParts > 1
			? t(`As ${group.part === 'adjective' ? 'an' : 'a'} ${group.part}`)
			: ''
		return sameParts > 1 ? `${label}, ${t('meaning')} ${(group.sense ?? 0) + 1}` : label
	}

	return (
		<main className="draw-page">
			<section aria-label="Draw and explore images" className="draw-workspace">
				<div className="drawing-column">
					<div className="drawing-column-heading">
						<label className="draw-word-label">{t('Draw this word')}</label>
						{currentWord?.set_name && (
							<p className="draw-set-progress">
								{currentWord.set_name} · {t('Card')} {currentWord.set_card_number} {t('of')} {currentWord.set_card_limit}
							</p>
						)}
					</div>
					
					<label className="draw-word">
						{isLoadingWord
							? t('Loading a word...')
							: wordError
								? t('Word unavailable')
								: currentWord?.word ?? t('All words completed')}
					</label>
					{hints.length > 0 && (
						<div className="word-hint">
							{hints.map((hint) => (
								<div className="word-hint-entry" key={hint.partOfSpeech}>
									{showPartOfSpeech && (
										<p className="word-hint-part">{t(`As ${hint.partOfSpeech === 'adjective' ? 'an' : 'a'} ${hint.partOfSpeech}:`)}</p>
									)}
									{hint.senses.map((sense, index) => (
										<div className="word-hint-sense" key={sense.searchPhrase}>
											<p>
												<strong>{hint.senses.length > 1 ? `${t('Meaning')} ${index + 1}:` : `${t('Meaning')}:`}</strong> {translatedDefinitions[sense.definition] ?? sense.definition}
											</p>
											<p>
												{t(sense.moreSearches?.length ? 'Suggested picture searches:' : 'Suggested picture search:')}{' '}
												<strong>{[sense.searchPhrase, ...(sense.moreSearches ?? [])].join(' · ')}</strong>
											</p>
											<button
												className="use-hint-button"
												type="button"
												onClick={() => searchSuggestion({ partOfSpeech: hint.partOfSpeech, sense: index, searchPhrase: sense.searchPhrase })}
												disabled={isSearching}
											>
												{t('Search for this')}
											</button>
										</div>
									))}
								</div>
							))}
						</div>
					)}
					<div className="drawing-toolbar">
						<p>{t('Use your mouse or finger to draw')}</p>
						<div className="drawing-actions">
							<button className="clear-drawing-button" disabled={!canUndo} onClick={undoDrawing} type="button">
								{t('Undo')}
							</button>
							<button className="clear-drawing-button" onClick={clearDrawing} type="button">
								{t('Clear')}
							</button>
							<button
								className="save-flashcard-button"
								disabled={!currentWord || isLoadingWord || isSaving}
								onClick={saveFlashCard}
								type="button"
							>
								{isSaving ? t('Saving...') : t('Save flash card')}
							</button>
						</div>
					</div>
					<div aria-label="Drawing tools" className="drawing-controls">
						<div className="drawing-control-group">
							<span className="drawing-control-label" id="drawing-tool-label">{t('Tool')}</span>
							<div aria-labelledby="drawing-tool-label" className="drawing-tool-options" role="group">
								{brushOptions.map((brush) => (
									<button
										aria-pressed={activeTool === brush.id}
										className={`drawing-tool-button${activeTool === brush.id ? ' is-active' : ''}`}
										key={brush.id}
										onClick={() => setActiveTool(brush.id)}
										type="button"
									>
										{t(brush.label)}
									</button>
								))}
								<button
									aria-pressed={activeTool === 'eraser'}
									className={`drawing-tool-button${activeTool === 'eraser' ? ' is-active' : ''}`}
									onClick={() => setActiveTool('eraser')}
									type="button"
								>
									{t('Eraser')}
								</button>
							</div>
						</div>
						<div className="drawing-control-group">
							<span className="drawing-control-label" id="drawing-color-label">{t('Color')}</span>
							<div aria-labelledby="drawing-color-label" className="drawing-color-options" role="group">
								{drawingColors.map((color) => (
									<button
										aria-label={`${t(color.label)} ${t('color')}`}
										aria-pressed={brushColor === color.value}
										className={`drawing-color-button${brushColor === color.value ? ' is-active' : ''}`}
										key={color.value}
										onClick={() => {
											setBrushColor(color.value)
											if (activeTool === 'eraser') setActiveTool('pencil')
										}}
										style={{ '--swatch-color': color.value }}
										type="button"
									/>
								))}
							</div>
						</div>
						<div className="drawing-control-group drawing-size-control">
							<label className="drawing-control-label" htmlFor="drawing-size">{t('Brush size')}: {brushSize}</label>
							<input
								id="drawing-size"
								max="20"
								min="2"
								onChange={(event) => setBrushSize(Number(event.target.value))}
								type="range"
								value={brushSize}
							/>
						</div>
					</div>
					<p className="flashcard-save-message" aria-live="polite" role="status">
						{saveStatusMessage}
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
							style={{ cursor: getDrawingCursor(activeTool, brushSize) }}
							width="800"
						/>
						<span aria-hidden="true" className="canvas-hint"></span>
					</div>
					<dialog
						aria-labelledby="set-completed-title"
						className="set-completed-dialog"
						onClose={closeSetCompletedDialog}
						ref={setCompletedDialogRef}
					>
						<div className="set-completed-content">
							<span aria-hidden="true" className="set-completed-icon">🎉</span>
							<p className="draw-eyebrow">{t('Achievement unlocked')}</p>
							<h2 id="set-completed-title">{t('Set complete!')}</h2>
							<p>{t('You finished all 50 cards in')} <strong>{completedSetName}</strong>. {t('Great work!')}</p>
							<button className="save-flashcard-button" onClick={closeSetCompletedDialog} type="button">{t('Keep going')}</button>
						</div>
					</dialog>
				</div>

				<aside aria-labelledby="reference-title" className="reference-column">
					<div className="reference-heading">
						<p className="draw-eyebrow">{t('Get inspired')}</p>
						<h1 id="reference-title">{t('Picture search')}</h1>
					</div>
					<form className="image-search" onSubmit={searchPictures}>
						<FaSearch className="image-search-icon" aria-hidden="true" />
						<input
							id="image-search-input"
							aria-label={t('Search reference pictures')}
							maxLength={80}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={t('Search pictures...')}
							type="search"
							value={search}
						/>
						<button className="picture-search-button" type="submit" disabled={isSearching || !search.trim()}>
							{isSearching ? t('Searching…') : t('Search')}
						</button>
					</form>
					<p className="picture-search-status" role="status">
						{isSearching ? t('Looking for reference pictures…') : t(searchMessage) ||
							(images?.length === 0 ? t('No pictures found. Try a related word, such as clock for time.') : '')}
					</p>
					{resultsArePicked && images && (
						<p className="picked-title">{t('Pictures picked for this word')}</p>
					)}
					{galleryGroups.map((group) => (
						<div key={`${group.part}-${group.sense ?? 0}`}>
							{groupLabel(group) && <p className="picked-part">{groupLabel(group)}</p>}
							<div className="reference-gallery" aria-busy={isSearching}>
								{group.images.map((image) => (
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
						</div>
					))}
					<p className="picture-search-credit">{t('Pictures from Pixabay. Tap a picture to see it larger.')}</p>
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
									<h2 id="enlarged-picture-title">{t('Reference picture')}</h2>
									<button className="enlarged-picture-close" type="button" onClick={closeEnlargedImage} autoFocus>
										{t('Close')}
									</button>
								</div>
								<img src={enlargedImage.thumbnail} alt={enlargedImage.description} />
								<p className="enlarged-picture-description">{enlargedImage.description}</p>
								<p className="enlarged-picture-credit">{t('Pictures from Pixabay.')}</p>
							</div>
						)}
					</dialog>
				</aside>
			</section>
		</main>
	)
}

export default DrawPage
