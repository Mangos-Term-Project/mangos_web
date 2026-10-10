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

function StorePage() {
	return (
		<main className="store-page">
			<section aria-labelledby="store-title" className="store-window">
				<header className="store-heading">
						<h1 id="store-title">The Store</h1>
				</header>

				<div aria-label="Store items" className="store-grid">
					{storeItems.map((item) => (
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
						</article>
					))}
				</div>
			</section>
		</main>
	)
}

export default StorePage
