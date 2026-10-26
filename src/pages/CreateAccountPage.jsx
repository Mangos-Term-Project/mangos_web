import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/CreateAccountPage.css'

// Same rules as the API (api/main.py), so problems show before submitting.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/
const NAME_MAX_LENGTH = 256
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_BYTES = 72

function validateAccount({ name, username, password }, confirmation) {
	if (!name) return 'Please enter your name.'
	if (name.length > NAME_MAX_LENGTH) return 'Name must be 256 characters or fewer.'
	if (!USERNAME_PATTERN.test(username)) return 'Username must be 3 to 30 characters: letters, numbers or underscores.'
	if (password.length < PASSWORD_MIN_LENGTH) return 'Password must be at least 8 characters.'
	if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'Password must be at most 72 characters.'
	if (password !== confirmation) return 'Passwords do not match.'
	return ''
}

function CreateAccountPage({ onSubmit }) {
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(event) {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		const details = {
			name: formData.get('name').trim(),
			username: formData.get('username').trim(),
			password,
		}

		const validationError = validateAccount(details, confirmation)
		if (validationError) {
			setError(validationError)
			return
		}

		setError('')
		setIsSubmitting(true)
		try {
			await onSubmit(details)
		} catch (submitError) {
			setError(submitError.message)
			setIsSubmitting(false)
		}
	}

	function clearError() {
		if (error) setError('')
	}

	return (
		<main className="create-account-page">
			<section aria-labelledby="create-account-title" className="create-account-panel">
				<p className="create-account-eyebrow">Start your learning journey</p>
				<h1 id="create-account-title">Create an account</h1>
				<p className="create-account-description">Set up your Mangos learner profile.</p>

				<form className="create-account-form" onSubmit={handleSubmit}>
					<label htmlFor="name">Your name</label>
					<input
						autoComplete="name"
						id="name"
						name="name"
						placeholder="Your name"
						required
					/>

					<label htmlFor="new-username">Create a username</label>
					<input
						autoComplete="username"
						id="new-username"
						name="username"
						placeholder="Choose a username"
						required
					/>

					<label htmlFor="new-password">Create a password</label>
					<input
						autoComplete="new-password"
						id="new-password"
						name="password"
						onChange={(event) => {
							setPassword(event.target.value)
							clearError()
						}}
						placeholder="Choose a password"
						required
						type="password"
						value={password}
					/>

					<label htmlFor="confirm-password">Confirm your password</label>
					<input
						aria-describedby={error ? 'create-account-error' : undefined}
						autoComplete="new-password"
						id="confirm-password"
						name="confirmPassword"
						onChange={(event) => {
							setConfirmation(event.target.value)
							clearError()
						}}
						placeholder="Enter your password again"
						required
						type="password"
						value={confirmation}
					/>
					{error && <p className="password-error" id="create-account-error" role="alert">{error}</p>}

					<button className="create-account-submit" disabled={isSubmitting} type="submit">
						{isSubmitting ? 'Creating account...' : 'Create account'}
					</button>
				</form>

				<p className="create-account-login">Already have an account? <Link to="/login">Log in</Link></p>
			</section>
		</main>
	)
}

export default CreateAccountPage
