import EmailVerification from '../components/EmailVerification.jsx'
import { useLanguage } from '../i18n/language.js'
import '../styles/AccountPage.css'

// Shown instead of the rest of the app until the account's email is verified.
function VerifyEmailPage({ user, pendingEmail, emailStatus, onVerified, onSignOut }) {
	const { t } = useLanguage()
	// A code sent at sign-up (this visit) or one the server still has waiting (after a reload).
	const codeActive = Boolean(pendingEmail?.sent || emailStatus?.code_active)
	const sentTo = pendingEmail?.sent ? pendingEmail.email_masked ?? pendingEmail.email : emailStatus?.pending_email_masked
	return (
		<main className="account-page">
			<section aria-labelledby="verify-title" className="account-panel">
				<p className="account-eyebrow">{t('verify.eyebrow')}</p>
				<h1 id="verify-title">{t('verify.title')}</h1>
				<p className="account-description">
					{codeActive ? t('verify.introNew', { name: user?.name ?? '' }) : t('verify.introExisting', { name: user?.name ?? '' })}
				</p>
				{pendingEmail && pendingEmail.sent === false && (
					<p className="email-message is-error" role="alert">{t('verify.notSentYet')}</p>
				)}
				<EmailVerification
					codeAlreadySent={codeActive}
					initialEmail={pendingEmail?.email ?? ''}
					key={codeActive ? 'code-active' : 'no-code'}
					sentTo={sentTo}
					onVerified={onVerified}
				/>
				<button className="account-signout" onClick={onSignOut} type="button">{t('nav.signOut')}</button>
			</section>
		</main>
	)
}

export default VerifyEmailPage
