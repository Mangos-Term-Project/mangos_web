import { useState } from 'react'
import { useLanguage } from '../i18n/language.js'
import '../styles/LoginPage.css'

function LoginPage({ onSubmit }) {
	const { t, translateMessage } = useLanguage()
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
			setError(translateMessage(submitError.message))
			setIsSubmitting(false)
		}
	}

	return (
		<main className="login-page">
			<section aria-labelledby="login-title" className="login-panel">
				<p className="login-eyebrow">{t('login.eyebrow')}</p>
				<h1 id="login-title">{t('login.title')}</h1>
				<p className="login-description">{t('login.description')}</p>

				<form className="login-form" onSubmit={handleSubmit}>
					<label htmlFor="username">{t('login.username')}</label>
					<input
						autoComplete="username"
						id="username"
						name="username"
						placeholder={t('login.usernamePlaceholder')}
						required
					/>

					<label htmlFor="password">{t('login.password')}</label>
					<input
						aria-describedby={error ? 'login-error' : undefined}
						autoComplete="current-password"
						id="password"
						name="password"
						placeholder={t('login.passwordPlaceholder')}
						required
						type="password"
					/>
					{error && <p className="login-error" id="login-error" role="alert">{error}</p>}

					<button className="login-submit" disabled={isSubmitting} type="submit">
						{isSubmitting ? t('login.submitting') : t('nav.logIn')}
					</button>
				</form>
			</section>
		</main>
	)
}

export default LoginPage
