import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAuthConfig } from '../api/auth.js'
import { useLanguage } from '../i18n/language.js'
import '../styles/CreateAccountPage.css'

// Same rules as the API (api/main.py), so problems show before submitting.
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/
const NAME_MAX_LENGTH = 256
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_BYTES = 72
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/

// Returns a message key, or '' when the details pass.
function validateAccount({ name, username, password, email }, confirmation, emailRequired) {
	if (!name) return 'signup.errorName'
	if (name.length > NAME_MAX_LENGTH) return 'signup.errorNameLength'
	if (!USERNAME_PATTERN.test(username)) return 'signup.errorUsername'
	if (emailRequired && !EMAIL_PATTERN.test(email)) return 'signup.errorEmail'
	if (password.length < PASSWORD_MIN_LENGTH) return 'signup.errorPasswordShort'
	if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'signup.errorPasswordLong'
	if (password !== confirmation) return 'signup.errorPasswordMatch'
	return ''
}

function CreateAccountPage({ onSubmit }) {
	const { t, translateMessage } = useLanguage()
	const [emailRequired, setEmailRequired] = useState(false)
	const [password, setPassword] = useState('')
	const [confirmation, setConfirmation] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		let cancelled = false
		getAuthConfig()
			.then((config) => {
				if (!cancelled) setEmailRequired(Boolean(config?.email_verification_required))
			})
			.catch(() => {
				// The server still checks; without the setting the form just hides the field.
			})
		return () => {
			cancelled = true
		}
	}, [])

	async function handleSubmit(event) {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		const details = {
			name: formData.get('name').trim(),
			username: formData.get('username').trim(),
			password,
			email: emailRequired ? (formData.get('email') ?? '').trim() : undefined,
		}

		const validationError = validateAccount(details, confirmation, emailRequired)
		if (validationError) {
			setError(t(validationError))
			return
		}

		setError('')
		setIsSubmitting(true)
		try {
			await onSubmit(details)
		} catch (submitError) {
			setError(translateMessage(submitError.message))
			setIsSubmitting(false)
		}
	}

	function clearError() {
		if (error) setError('')
	}

	return (
		<main className="create-account-page">
			<section aria-labelledby="create-account-title" className="create-account-panel">
				<p className="create-account-eyebrow">{t('signup.eyebrow')}</p>
				<h1 id="create-account-title">{t('signup.title')}</h1>
				<p className="create-account-description">{t('signup.description')}</p>

				<form className="create-account-form" onSubmit={handleSubmit}>
					<label htmlFor="name">{t('signup.name')}</label>
					<input
						autoComplete="name"
						id="name"
						name="name"
						placeholder={t('signup.namePlaceholder')}
						required
					/>

					<label htmlFor="new-username">{t('signup.username')}</label>
					<input
						autoComplete="username"
						id="new-username"
						name="username"
						placeholder={t('signup.usernamePlaceholder')}
						required
					/>

					{emailRequired && (
						<>
							<label htmlFor="new-email">{t('signup.email')}</label>
							<input
								aria-describedby="new-email-help"
								autoComplete="email"
								id="new-email"
								inputMode="email"
								maxLength={254}
								name="email"
								placeholder={t('signup.emailPlaceholder')}
								required
								type="email"
							/>
							<p className="create-account-help" id="new-email-help">{t('signup.emailHelp')}</p>
						</>
					)}

					<label htmlFor="new-password">{t('signup.password')}</label>
					<input
						autoComplete="new-password"
						id="new-password"
						name="password"
						onChange={(event) => {
							setPassword(event.target.value)
							clearError()
						}}
						placeholder={t('signup.passwordPlaceholder')}
						required
						type="password"
						value={password}
					/>

					<label htmlFor="confirm-password">{t('signup.confirm')}</label>
					<input
						aria-describedby={error ? 'create-account-error' : undefined}
						autoComplete="new-password"
						id="confirm-password"
						name="confirmPassword"
						onChange={(event) => {
							setConfirmation(event.target.value)
							clearError()
						}}
						placeholder={t('signup.confirmPlaceholder')}
						required
						type="password"
						value={confirmation}
					/>
					{error && <p className="password-error" id="create-account-error" role="alert">{error}</p>}

					<button className="create-account-submit" disabled={isSubmitting} type="submit">
						{isSubmitting ? t('signup.submitting') : t('signup.submit')}
					</button>
				</form>

				<p className="create-account-login">{t('signup.haveAccount')} <Link to="/login">{t('nav.logIn')}</Link></p>
			</section>
		</main>
	)
}

export default CreateAccountPage
