import { request } from './client.js'

export function recordCorrectQuizAnswer({ setId, flashCardId }) {
	return request('/api/quiz/answer', {
		method: 'POST',
		body: {
			set_id: setId,
			flashcard_id: flashCardId,
			selected_flashcard_id: flashCardId,
		},
	})
}

export function getStorePurchases() {
	return request('/api/store/purchases')
}

export function purchaseStoreItem(itemId) {
	return request('/api/store/purchases', {
		method: 'POST',
		body: { item_id: itemId },
	})
}
