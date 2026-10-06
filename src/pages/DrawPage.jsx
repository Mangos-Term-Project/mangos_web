import { useRef, useState } from 'react'
import { FaSearch } from "react-icons/fa";
import '../styles/DrawPage.css'

function DrawPage() {
	const [search, setSearch] = useState('')
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
					<label className="draw-word">Time</label>

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
					<label className="image-search" htmlFor="image-search-input">
						<FaSearch class="image-search-icon"/>
						<input
							id="image-search-input"
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search pictures..."
							type="search"
							value={search}
						/>
					</label>

					<div className="reference-gallery">
						{/* TODO: Implement API call to fetch reference images */}
					</div>
				</aside>
			</section>
		</main>
	)
}

export default DrawPage
