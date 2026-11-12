const GENERIC_ERROR = 'Something went wrong. Please try again.'

export async function request(path, { method = 'GET', body } = {}) {
	let response
	try {
		response = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		})
	} catch {
		throw new Error('Could not reach the server. Please try again.')
	}

	const data = await response.json().catch(() => null)

	if (!response.ok) {
		const serverMessage = typeof data?.detail === 'string' ? data.detail : ''
		const error = new Error(response.status < 500 && serverMessage ? serverMessage : GENERIC_ERROR)
		error.status = response.status
		throw error
	}

	return data
}
