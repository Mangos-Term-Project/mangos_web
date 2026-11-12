import { useRef, useState } from 'react'
import { FaSearch } from "react-icons/fa";
import { wordGroups } from '../flashcardWords'
import '../styles/DrawPage.css'

function DrawPage() {
	const [groupIndex, setGroupIndex] = useState(0)
	const [wordIndex, setWordIndex] = useState(0)
	const word = wordGroups[groupIndex].words[wordIndex]
	const [search, setSearch] = useState(word)
	const [results, setResults] = useState(null)
	const [message, setMessage] = useState('')
	const [loading, setLoading] = useState(false)
	const activeRequest = useRef(null)

	function selectPrompt(group, index) {
		activeRequest.current?.abort()
		setGroupIndex(group)
		setWordIndex(index)
		setSearch(wordGroups[group].words[index])
		setResults(null)
		setMessage('')
		setLoading(false)
	}

	async function searchPictures(event) {
		event.preventDefault()
		const query = search.trim()
		if (!query) return
		activeRequest.current?.abort()
		const controller = new AbortController()
		activeRequest.current = controller
		setLoading(true)
		setResults(null)
		setMessage('')
		try {
			const response = await fetch(`/api/images/search?${new URLSearchParams({ q: query })}`, {
				signal: controller.signal,
			})
			const data = await response.json()
			if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '')
			if (!controller.signal.aborted) setResults(data.images)
		} catch (error) {
			if (!controller.signal.aborted) setMessage(error instanceof SyntaxError
				? 'Picture search is unavailable. Please try again.'
				: error.message || 'Picture search is unavailable. Please try again.')
		} finally {
			if (!controller.signal.aborted) setLoading(false)
		}
	}
	const canvasRef = useRef(null)
	const drawingRef = useRef(false)

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

	return (
		<main className="draw-page">
			<section aria-label="Draw and explore images" className="draw-workspace">
				<div className="drawing-column">
					<label className="draw-word-label" htmlFor="draw-word">Draw this word</label>
					<div className="word-selectors">
						<label>Word group
							<select value={groupIndex} onChange={(event) => selectPrompt(Number(event.target.value), 0)}>
								{wordGroups.map(({ label }, index) => <option key={label} value={index}>{label}</option>)}
							</select>
						</label>
						<select id="draw-word" className="draw-word" value={wordIndex}
							onChange={(event) => selectPrompt(groupIndex, Number(event.target.value))}>
							{wordGroups[groupIndex].words.map((entry, index) => (
								<option key={index} value={index}>{index + 1}. {entry}</option>
							))}
						</select>
					</div>

					<div className="drawing-toolbar">
						<p>Use your mouse or finger to draw</p>
						<button className="clear-drawing-button" onClick={clearDrawing} type="button">
							Clear
						</button>
					</div>
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
