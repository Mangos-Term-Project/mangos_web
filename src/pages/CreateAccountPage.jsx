import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/CreateAccountPage.css'

function CreateAccountPage({ onSubmit }) {
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [passwordError, setPasswordError] = useState('')

	function handleSubmit(event) {
		event.preventDefault()

		if (password !== confirmation) {
			setPasswordError('Passwords do not match.')
			return
		}

		setPasswordError('')
		onSubmit()
	}

	function clearPasswordError() {
		if (passwordError) setPasswordError('')
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
							clearPasswordError()
						}}
						placeholder="Choose a password"
						required
						type="password"
						value={password}
					/>

					<label htmlFor="confirm-password">Confirm your password</label>
					<input
						aria-describedby={passwordError ? 'password-error' : undefined}
						autoComplete="new-password"
						id="confirm-password"
						name="confirmPassword"
						onChange={(event) => {
							setConfirmation(event.target.value)
							clearPasswordError()
						}}
						placeholder="Enter your password again"
						required
						type="password"
						value={confirmation}
					/>
					{passwordError && <p className="password-error" id="password-error" role="alert">{passwordError}</p>}

					<button className="create-account-submit" type="submit">Create account</button>
				</form>

				<p className="create-account-demo-note">Demo mode: account details are not saved.</p>
				<p className="create-account-login">Already have an account? <Link to="/login">Log in</Link></p>
			</section>
		</main>
	)
}

export default CreateAccountPage
