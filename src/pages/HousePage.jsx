import { Link } from 'react-router-dom'
import { petPicture } from '../data/pets.js'
import { useLanguage } from '../i18n/language.js'
import '../styles/HousePage.css'

function HousePage({ accountName, pets, loadError }) {
	const { t, translateMessage } = useLanguage()

	function petName(pet) {
		const key = `pet.${pet.id}`
		const translated = t(key)
		return translated === key ? pet.name : translated
	}

	return (
		<main className="house-page">
			<section aria-labelledby="house-title" className="house-content">
				<header className="house-heading">
					<h1 id="house-title">{t('house.title', { name: accountName ?? '' })}</h1>
					<p className="house-item-count">
						{pets.length === 1 ? t('house.petCountOne') : t('house.petCount', { count: pets.length })}
					</p>
				</header>

				{loadError && <p className="house-error" role="alert">{translateMessage(loadError)}</p>}

				{pets.length ? (
					<div aria-label={t('house.petsLabel')} className="house-grid">
						{pets.map((pet) => (
							<article className="house-item" key={pet.id}>
								<div aria-hidden="true" className="house-item-image house-pet">{petPicture(pet.id)}</div>
								<h2>{petName(pet)}</h2>
							</article>
						))}
					</div>
				) : (
					<div className="house-empty-state">
						<p>{t('house.empty')}</p>
						<Link to="/store">{t('house.browse')} <span aria-hidden="true">→</span></Link>
					</div>
				)}
			</section>
		</main>
	)
}

export default HousePage
