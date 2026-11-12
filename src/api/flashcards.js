import { request } from './client.js'

export function getNextWord(excludedWords = []) {
	const search = new URLSearchParams()
	excludedWords.forEach((word) => search.append('exclude_words', word))
	const query = search.toString()
	return request(`/api/words/next${query ? `?${query}` : ''}`)
}

export function getFlashCards() {
	return request('/api/flashcards')
}

export function saveFlashCard({ wordId, drawing }) {
	return request('/api/flashcards', {
		method: 'POST',
		body: { word_id: wordId, drawing },
	})
}
