import { request } from './client.js'

export function getAccount() {
	return request('/api/account')
}

export function getPets() {
	return request('/api/pets')
}

export function purchasePet(petId) {
	return request(`/api/pets/${encodeURIComponent(petId)}/purchase`, { method: 'POST' })
}

export function updateDrawing(flashCardId, drawing) {
	return request(`/api/flashcards/${encodeURIComponent(flashCardId)}/drawing`, {
		method: 'PUT',
		body: { drawing },
	})
}

export function recordReview(flashCardId, answer) {
	return request(`/api/flashcards/${encodeURIComponent(flashCardId)}/reviews`, {
		method: 'POST',
		body: answer,
	})
}

export function requestEmailCode(email) {
	return request('/api/account/email', { method: 'POST', body: { email } })
}

export function verifyEmailCode(code) {
	return request('/api/account/email/verify', { method: 'POST', body: { code } })
}
