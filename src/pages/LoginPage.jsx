import { useState } from 'react'
import '../styles/LoginPage.css'

function LoginPage({ onSubmit }) {
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	async function handleSubmit(event) {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)

		setError('')
		setIsSubmitting(true)
		try {
			await onSubmit({
				username: formData.get('username'),
				password: formData.get('password'),
			})
		} catch (submitError) {
			setError(submitError.message)
			setIsSubmitting(false)
		}
	}

	return (
		<main className="login-page">
			<section aria-labelledby="login-title" className="login-panel">
				<p className="login-eyebrow">Welcome back</p>
				<h1 id="login-title">Log in to Mangos</h1>
				<p className="login-description">Pick up where your English practice left off.</p>

				<form className="login-form" onSubmit={handleSubmit}>
					<label htmlFor="username">Username</label>
					<input
						autoComplete="username"
						id="username"
						name="username"
						placeholder="Your username"
						required
					/>

					<label htmlFor="password">Password</label>
					<input
						aria-describedby={error ? 'login-error' : undefined}
						autoComplete="current-password"
						id="password"
						name="password"
						placeholder="Your password"
						required
						type="password"
					/>
					{error && <p className="login-error" id="login-error" role="alert">{error}</p>}

					<button className="login-submit" disabled={isSubmitting} type="submit">
						{isSubmitting ? 'Logging in...' : 'Log in'}
					</button>
				</form>
			</section>
		</main>
	)
}

export default LoginPage
