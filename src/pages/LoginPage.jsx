import { useState } from 'react'
import '../styles/LoginPage.css'
import { useLanguage } from '../i18n.jsx'

function LoginPage({ onSubmit }) {
	const { t } = useLanguage()
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
			setError(t(submitError.message))
			setIsSubmitting(false)
		}
	}

	return (
		<main className="login-page">
			<section aria-labelledby="login-title" className="login-panel">
				<p className="login-eyebrow">{t('Welcome back')}</p>
				<h1 id="login-title">{t('Log in to Mangos')}</h1>
				<p className="login-description">{t('Pick up where your English practice left off.')}</p>

				<form className="login-form" onSubmit={handleSubmit}>
					<label htmlFor="username">{t('Username')}</label>
					<input
						autoComplete="username"
						id="username"
						name="username"
						placeholder={t('Your username')}
						required
					/>

					<label htmlFor="password">{t('Password')}</label>
					<input
						aria-describedby={error ? 'login-error' : undefined}
						autoComplete="current-password"
						id="password"
						name="password"
						placeholder={t('Your password')}
						required
						type="password"
					/>
					{error && <p className="login-error" id="login-error" role="alert">{error}</p>}

					<button className="login-submit" disabled={isSubmitting} type="submit">
						{isSubmitting ? t('Logging in...') : t('Log in')}
					</button>
				</form>
			</section>
		</main>
	)
}

export default LoginPage
