import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPets } from '../api/account.js'
import { petPicture } from '../data/pets.js'
import { useLanguage } from '../i18n/language.js'
import '../styles/StorePage.css'

function StorePage({ coins, onPurchase }) {
	const { t, translateMessage } = useLanguage()
	const [pets, setPets] = useState(null)
	const [loadError, setLoadError] = useState('')
	const [buyingId, setBuyingId] = useState(null)
	const [message, setMessage] = useState({ text: '', isError: false })

	function petName(pet) {
		const key = `pet.${pet.id}`
		const translated = t(key)
		return translated === key ? pet.name : translated
	}

	useEffect(() => {
		let cancelled = false
		getPets()
			.then((list) => {
				if (!cancelled) setPets(Array.isArray(list) ? list : [])
			})
			.catch((error) => {
				if (!cancelled) setLoadError(error.message)
			})
		return () => {
			cancelled = true
		}
	}, [])

	async function buy(pet) {
		if (buyingId) return
		setBuyingId(pet.id)
		setMessage({ text: '', isError: false })
		try {
			await onPurchase(pet.id)
			setPets((current) => current.map((item) => (item.id === pet.id ? { ...item, owned: true } : item)))
			setMessage({ text: t('store.bought', { pet: petName(pet) }), isError: false })
		} catch (error) {
			setMessage({ text: translateMessage(error.message), isError: true })
			if (error.status === 409 && /already/i.test(error.message)) {
				setPets((current) => current.map((item) => (item.id === pet.id ? { ...item, owned: true } : item)))
			}
		} finally {
			setBuyingId(null)
		}
	}

	return (
		<main className="store-page">
			<section aria-labelledby="store-title" className="store-window">
				<header className="store-heading">
					<h1 id="store-title">{t('store.title')}</h1>
					<p className="store-balance">
						{typeof coins === 'number' ? t('store.balance', { count: coins }) : t('coins.unknown')}
					</p>
					<p className="store-earn-hint">{t('store.earnHint')}</p>
				</header>

				<p aria-live="polite" className={`store-message${message.isError ? ' is-error' : ''}`} role="status">
					{message.text}
				</p>

				{loadError && <p className="store-message is-error" role="alert">{translateMessage(loadError)}</p>}
				{!pets && !loadError && <p className="store-message">{t('store.loading')}</p>}

				{pets && (
					<div aria-label={t('store.items')} className="store-grid">
						{pets.map((pet) => {
							const name = petName(pet)
							const shortBy = typeof coins === 'number' ? pet.price - coins : 0
							const isBuying = buyingId === pet.id
							return (
								<article className="store-item" key={pet.id}>
									<div aria-hidden="true" className="store-item-image store-pet">
										{petPicture(pet.id)}
									</div>
									<div className="store-item-details">
										<h2>{name}</h2>
										<p className="store-item-price">
											<span aria-hidden="true" className="store-coin">●</span>
											<span>{t('coins.count', { count: pet.price })}</span>
										</p>
									</div>
									<button
										aria-label={pet.owned ? t('store.ownedLabel', { pet: name }) : t('store.buyLabel', { pet: name, price: pet.price })}
										className="store-purchase-button"
										disabled={pet.owned || isBuying || Boolean(buyingId) || shortBy > 0}
										onClick={() => buy(pet)}
										type="button"
									>
										{pet.owned
											? t('store.owned')
											: isBuying
												? t('store.buying')
												: shortBy > 0
													? t('store.needMore', { count: shortBy })
													: t('store.buy')}
									</button>
								</article>
							)
						})}
					</div>
				)}
				<p className="store-footer-link"><Link to="/house">{t('store.visitHouse')}</Link></p>
			</section>
		</main>
	)
}

export default StorePage
