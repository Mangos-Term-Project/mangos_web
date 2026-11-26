// Pictures for the PLACEHOLDER pet catalog in api/migrations/001_coins_and_pets.sql.
// Names and prices come from the server; this only maps each pet to an emoji.
export const petEmoji = {
	puppy: '🐶',
	kitten: '🐱',
	bunny: '🐰',
	hamster: '🐹',
	turtle: '🐢',
	parrot: '🦜',
	fox: '🦊',
	panda: '🐼',
	unicorn: '🦄',
}

export function petPicture(petId) {
	return petEmoji[petId] ?? '🐾'
}
