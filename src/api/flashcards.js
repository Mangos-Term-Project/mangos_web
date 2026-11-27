import { request } from './client.js'

export function getNextWord() {
	return request('/api/words/next')
}

export function getFlashCards() {
	return request('/api/flashcards')
}

export function getFlashCardSets() {
	return request('/api/flashcard-sets')
}

export function saveFlashCard({ wordId, drawing, setId }) {
	return request('/api/flashcards', {
		method: 'POST',
		body: { word_id: wordId, drawing, set_id: setId },
	})
}
