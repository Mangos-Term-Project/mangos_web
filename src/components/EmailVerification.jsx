import { useState } from 'react'
import { requestEmailCode, verifyEmailCode } from '../api/account.js'
import { useLanguage } from '../i18n/language.js'

// Two steps: send a code to an address, then enter the 6-digit code.
// The server enforces expiry, single use, resend limits and attempt limits;
// this form only shows its answers.
function EmailVerification({ initialEmail = '', codeAlreadySent = false, sentTo = '', onVerified }) {
	const { t, translateMessage } = useLanguage()
	const [email, setEmail] = useState(initialEmail)
	const [codeSent, setCodeSent] = useState(codeAlreadySent)
	const [code, setCode] = useState('')
	const [isBusy, setIsBusy] = useState(false)
	const [message, setMessage] = useState({ text: codeAlreadySent ? t('verify.codeSent', { email: sentTo || initialEmail }) : '', isError: false })

	async function sendCode(event) {
		event?.preventDefault()
		if (isBusy) return
		setIsBusy(true)
		setMessage({ text: '', isError: false })
		try {
			const result = await requestEmailCode(email)
			setCodeSent(true)
			setCode('')
			setMessage({ text: t('verify.codeSent', { email: result.email_masked }), isError: false })
		} catch (error) {
			setMessage({ text: translateMessage(error.message), isError: true })
		} finally {
			setIsBusy(false)
		}
	}

	async function checkCode(event) {
		event.preventDefault()
		if (isBusy) return
		setIsBusy(true)
		setMessage({ text: '', isError: false })
		try {
			const status = await verifyEmailCode(code)
			setMessage({ text: t('verify.verified'), isError: false })
			onVerified(status)
		} catch (error) {
			setMessage({ text: translateMessage(error.message), isError: true })
			setIsBusy(false)
		}
	}

	return (
		<div className="email-verification">
			<form className="email-verification-form" onSubmit={sendCode}>
				<label htmlFor="verify-email">{t('verify.emailLabel')}</label>
				<input
					autoComplete="email"
					id="verify-email"
					inputMode="email"
					maxLength={254}
					onChange={(event) => setEmail(event.target.value)}
					required
					type="email"
					value={email}
				/>
				<button className="email-secondary-button" disabled={isBusy || !email.trim()} type="submit">
					{codeSent ? t('verify.resend') : t('verify.send')}
				</button>
			</form>

			{codeSent && (
				<form className="email-verification-form" onSubmit={checkCode}>
					<label htmlFor="verify-code">{t('verify.codeLabel')}</label>
					<input
						autoComplete="one-time-code"
						id="verify-code"
						inputMode="numeric"
						maxLength={6}
						onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
						pattern="\d{6}"
						required
						value={code}
					/>
					<p className="email-help">{t('verify.codeHelp')}</p>
					<button className="email-primary-button" disabled={isBusy || code.length !== 6} type="submit">
						{t('verify.check')}
					</button>
				</form>
			)}

			<p aria-live="polite" className={`email-message${message.isError ? ' is-error' : ''}`} role="status">
				{message.text}
			</p>
		</div>
	)
}

export default EmailVerification
