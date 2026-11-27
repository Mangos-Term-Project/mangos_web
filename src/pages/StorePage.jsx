import { useState } from 'react'
import '../styles/StorePage.css'

const storeItems = [
	{ id: 1, name: 'Item 1', price: 25 },
	{ id: 2, name: 'Item 2', price: 40 },
	{ id: 3, name: 'Item 3', price: 55 },
	{ id: 4, name: 'Item 4', price: 70 },
	{ id: 5, name: 'Item 5', price: 85 },
	{ id: 6, name: 'Item 6', price: 100 },
	{ id: 7, name: 'Item 7', price: 125 },
	{ id: 8, name: 'Item 8', price: 150 },
	{ id: 9, name: 'Item 9', price: 175 },
]

function StorePage({ coins, onPurchase, purchasedItems }) {
	const [pendingItemId, setPendingItemId] = useState(null)
	const [purchaseMessage, setPurchaseMessage] = useState('')
	const [purchaseError, setPurchaseError] = useState(false)

	async function buyItem(item) {
		setPendingItemId(item.id)
		setPurchaseMessage('')
		setPurchaseError(false)
		try {
			await onPurchase(item)
			setPurchaseMessage(`${item.name} was added to your house.`)
		} catch (error) {
			setPurchaseMessage(error.message || 'Could not complete the purchase.')
			setPurchaseError(true)
		} finally {
			setPendingItemId(null)
		}
	}

	return (
		<main className="store-page">
			<section aria-labelledby="store-title" className="store-window">
				<header className="store-heading">
					<h1 id="store-title">The Store</h1>
					<p className="store-balance">You have <strong>{coins}</strong> coins</p>
				</header>
				<p aria-live="polite" className="store-purchase-message" role={purchaseError ? 'alert' : 'status'}>
					{purchaseMessage}
				</p>

				<div aria-label="Store items" className="store-grid">
					{storeItems.map((item) => {
						const isPurchased = purchasedItems.some((purchasedItem) => purchasedItem.id === item.id)
						const cannotAfford = coins < item.price
						return (
						<article aria-label={`${item.name}, ${item.price} coins`} className="store-item" key={item.id}>
							<div aria-label={`${item.name} image placeholder`} className="store-item-image" role="img">
								<span className="store-image-placeholder-text">Image coming soon</span>
							</div>
							<div className="store-item-details">
								<h2>{item.name}</h2>
								<p className="store-item-price">
									<span aria-hidden="true" className="store-coin">●</span>
									<span>{item.price}</span>
									<span>coins</span>
								</p>
							</div>
							<button
								className={`store-purchase-button${isPurchased ? ' is-purchased' : ''}`}
								disabled={isPurchased || cannotAfford || pendingItemId !== null}
								onClick={() => buyItem(item)}
								type="button"
							>
								{isPurchased ? 'In your house' : pendingItemId === item.id ? 'Buying…' : cannotAfford ? 'Need more coins' : 'Buy'}
							</button>
						</article>
						)
					})}
				</div>
			</section>
		</main>
	)
}

export default StorePage
