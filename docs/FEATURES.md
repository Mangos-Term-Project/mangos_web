# Mangos feature status

Last updated: November 25, 2026 (branch `checkpoint-feedback-fixes`).

- Live web app: https://mangoslearningenglish.vercel.app/
- Repository (web and mobile share it): https://github.com/Mangos-Term-Project/mangos_web

The three lists below follow the beta checkpoint guidelines. "Developed"
means finished and running on the live site. "Not yet deployed" means
finished and tested, but waiting on the steps in
[DEPLOYMENT.md](DEPLOYMENT.md) before it reaches the live site.

## 1. Features and functions developed (live now)

| Feature | What it does |
|---|---|
| Account sign-up and login | Accounts stored in PostgreSQL. Passwords hashed with bcrypt. Login sessions in Redis (1 hour), kept in a secure, HttpOnly cookie. |
| Create flash cards | A word from the 300-word list is shown; the learner draws it on a canvas (mouse or finger) and saves it. One card per word per account. |
| Vocabulary hints | Every word shows a short English meaning and a suggested picture search, grouped by noun, verb and adjective. |
| Picture search | Reference pictures from Pixabay with safe search on. Results are cached for 24 hours; each account can make 10 new searches a minute. The API key stays on the server. |
| Installable mobile app (PWA) | The same app installs on Android and iPhone home screens and opens full screen. See [MOBILE.md](MOBILE.md). |

## 2. Features and functions in progress

| Feature | Status | What is left |
|---|---|---|
| Email delivery for verification | Code finished and tested with a local test inbox | The team must choose an email service (any SMTP provider), add its settings in Vercel, and send a real test email. |
| Children under 13 and email | Sign-up lets learners use a parent's, guardian's or teacher's email | Confirm with the instructor how parental permission (COPPA) is handled. See [DEPLOYMENT.md](DEPLOYMENT.md#children-under-13). |
| Picture relevance for verbs and adjectives | Phrases rewritten; drawings-first search added | Run `api/tools/check_hint_searches.py` with the Pixabay key and fix any phrase that finds few pictures. See [PICTURE_SEARCH.md](PICTURE_SEARCH.md). |
| Pet artwork, prices and coin amounts | Working with placeholder pets (emoji) and proposed prices and rewards | The team should confirm or replace the pets, prices, coin rewards and the review schedule. |
| Spanish word translations | All 297 words translated | A Spanish speaker should review the 11 entries marked in `src/data/wordTranslations.js`. |

## 3. Features and functions not yet deployed (finished, waiting to go live)

All of these are on branch `checkpoint-feedback-fixes`, covered by automated
tests, and were checked in a browser on desktop and phone sizes. They go
live after the database migrations are run and the branch is merged.

| Feature | What it does |
|---|---|
| Email verification | Sign-up asks for an email and sends a 6-digit code. Codes expire after 15 minutes, work once, allow 5 tries, and can be re-sent once a minute, up to 3 times an hour. The server blocks cards, quiz, pets and search until the email is verified. Existing accounts verify the next time they log in and keep their cards and coins. |
| Coin tracker and rewards | The coin balance is always shown in the top bar. +10 coins for each new card (once per word), +2 when a card due for review reaches a new level. Rewards cannot be paid twice. |
| Pet store and house | Nine pets to buy. The server checks the price and the balance and deducts the coins in one step, so learners cannot overspend or buy the same pet twice. Bought pets appear in the House. Old browser-only "demo purchases" were removed. |
| Card sets and review | Cards are grouped into clickable sets of 10. Opening a set shows one large card at a time with previous and next buttons; tap to flip between the word and the drawing. |
| Review schedule | After "I remembered it", a card comes back after 1, 2, 4, 7, 14, then 30 days. After "Not yet", it comes back right away. |
| Edit drawings | Tap a drawing (or Edit) in **Your flash cards** under the Draw page canvas, or press **Edit drawing** on a card in Home. The card opens in the main drawing area with its previous drawing, its hint and Spanish translation, and pictures for that word already searched. **Save changes** or **Cancel** returns to the new word, keeping any unfinished drawing. Only the card's owner can edit it. |
| Quiz with the learner's own drawings | A word is shown with four of the learner's drawings; the learner picks the right one. Answers are saved and move cards along the review schedule. Rounds of up to 10 questions from all cards or one set. |
| Picture search improvements | Tapping a picture enlarges it inside Mangos (no links to the Pixabay website). Shorter, clearer suggested phrases, checked against real results. Choice of All, Illustrations or Photos, plus **My drawings**, which shows the learner's own saved drawings; tapping one opens it for editing. "Search for this" searches the suggestion in one tap. |
| Spanish mode | A button in the top bar (and on the Account page) switches the whole interface to Spanish, including error messages. Vocabulary words stay in English with their Spanish translation shown underneath. |
| Account page | Shows name, username and verified email (partly hidden), lets learners change their email, choose a language and sign out. |
| Privacy fixes | Removed a public address that listed every account's username. Drawings are no longer stored in browser storage shared by all accounts on a device. Every card, review, purchase and edit is checked against the signed-in account. |
