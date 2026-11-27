import { Link } from 'react-router-dom'
import '../styles/HousePage.css'
import { useLanguage } from '../i18n.jsx'

function HousePage({ accountName, items }) {
	const { t } = useLanguage()
	return (
		<main className="house-page">
			<section aria-labelledby="house-title" className="house-content">
				<header className="house-heading">
					{/*<p className="house-eyebrow">Your house</p>*/}
					<h1 id="house-title">{t('House of')} {accountName}</h1>
					<p className="house-item-count">{items.length} {t(items.length === 1 ? 'item' : 'items')}</p>
				</header>

				{items.length ? (
					<div aria-label="Items in your house" className="house-grid">
						{items.map((item) => (
							<article className="house-item" key={item.id}>
								<div aria-label={`${item.name} image placeholder`} className="house-item-image" role="img">
									<span>{t('Image coming soon')}</span>
								</div>
								<h2>{item.name}</h2>
							</article>
						))}
					</div>
				) : (
					<div className="house-empty-state">
						<p>{t('Your house is waiting for its first item.')}</p>
						<Link to="/store">{t('Browse the store')} <span aria-hidden="true">→</span></Link>
					</div>
				)}
			</section>
		</main>
	)
}

export default HousePage
