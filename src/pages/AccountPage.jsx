import { useState } from 'react'
import EmailVerification from '../components/EmailVerification.jsx'
import { useLanguage } from '../i18n/language.js'
import '../styles/AccountPage.css'

function AccountPage({ user, email, onEmailChange, onSignOut }) {
	const { language, setLanguage, t } = useLanguage()
	const [isChangingEmail, setIsChangingEmail] = useState(false)

	return (
		<main className="account-page">
			<section aria-labelledby="account-title" className="account-panel">
				<p className="account-eyebrow">{t('account.eyebrow')}</p>
				<h1 id="account-title">{t('account.title')}</h1>

				<dl className="account-details">
					<div>
						<dt>{t('account.name')}</dt>
						<dd>{user?.name}</dd>
					</div>
					<div>
						<dt>{t('account.username')}</dt>
						<dd>{user?.username}</dd>
					</div>
					<div>
						<dt>{t('account.email')}</dt>
						<dd>
							{email?.verified
								? t('account.emailVerified', { email: email.email_masked })
								: t('account.emailNone')}
						</dd>
					</div>
				</dl>

				<section aria-labelledby="account-email-title" className="account-section">
					<h2 id="account-email-title">{t('account.emailTitle')}</h2>
					{email?.feature_enabled === false ? (
						<p className="account-description">{t('account.emailOff')}</p>
					) : isChangingEmail || !email?.verified ? (
						<EmailVerification
							onVerified={(status) => {
								onEmailChange(status)
								setIsChangingEmail(false)
							}}
						/>
					) : (
						<button className="email-secondary-button" onClick={() => setIsChangingEmail(true)} type="button">
							{t('account.changeEmail')}
						</button>
					)}
				</section>

				<section aria-labelledby="account-language-title" className="account-section">
					<h2 id="account-language-title">{t('account.languageTitle')}</h2>
					<div className="account-language" role="group" aria-labelledby="account-language-title">
						<button aria-pressed={language === 'en'} lang="en" onClick={() => setLanguage('en')} type="button">English</button>
						<button aria-pressed={language === 'es'} lang="es" onClick={() => setLanguage('es')} type="button">Español</button>
					</div>
					<p className="account-description">{t('account.languageHelp')}</p>
				</section>

				<button className="account-signout" onClick={onSignOut} type="button">{t('nav.signOut')}</button>
			</section>
		</main>
	)
}

export default AccountPage
