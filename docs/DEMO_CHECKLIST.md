# Demo checklist (web and mobile)

Run every row twice: once on a computer at
https://mangoslearningenglish.vercel.app/ and once on a phone with the
installed app. Tick each box as you show it.

Before the demo: the branch is merged, the migrations are run, and email
is set up (see [DEPLOYMENT.md](DEPLOYMENT.md)). Use a fresh email address
you can open during the demo.

| # | Feature | Steps to show | Expected result | Web | Phone |
|---|---|---|---|---|---|
| 0 | Install (phone only) | Follow [MOBILE.md](MOBILE.md#installing-it) | Mangos icon on the home screen; opens full screen | n/a | ☐ |
| 1 | Sign-up asks for an email | Create account → fill name, username, **email**, password | Email field is required | ☐ | ☐ |
| 2 | Email verification | Open the email, enter the 6-digit code | App unlocks; coin tracker shows 0 coins | ☐ | ☐ |
| 3 | Wrong code is refused | Before step 2, type 000000 | "That code is not right. 4 tries left." | ☐ | ☐ |
| 4 | Blocked until verified | Before step 2, go to /draw | Still shows the verify screen | ☐ | ☐ |
| 5 | Create a card | Draw → draw the word → Save flash card | "+10 coins!"; coin tracker goes up by 10 | ☐ | ☐ |
| 6 | Hints | On Draw, read the meaning and suggestion | Meaning and suggested search shown | ☐ | ☐ |
| 7 | Picture search | Tap **Search for this**; switch Illustrations/Photos; then choose **My drawings** and tap one | Pictures appear; credit line "Pictures from Pixabay."; My drawings shows your own drawings and opens the tapped one for editing | ☐ | ☐ |
| 8 | Enlarge a picture | Tap a picture | Opens larger **inside Mangos**; Close returns; no Pixabay website | ☐ | ☐ |
| 9 | Make 4+ cards | Repeat step 5 | Coins increase each time | ☐ | ☐ |
| 10 | Card sets | Home → Review and edit your flash cards | Sets shown as tiles with card counts and "Review or edit" | ☐ | ☐ |
| 11 | Review a set | Open a set → tap the card → **I remembered it** | "+2 coins. Next review: (date)"; large card | ☐ | ☐ |
| 12 | Edit a card | Draw page → **Your flash cards** → tap a drawing (or Home → open a set → **Edit drawing**) → draw → **Save changes** | Card opens in the main drawing area with its old drawing and pictures for its word; after saving, the new drawing is kept and the page returns to the new word | ☐ | ☐ |
| 13 | Quiz | Quiz yourself → All cards → answer all questions | Your own drawings as choices; score at the end; coins for due cards | ☐ | ☐ |
| 14 | Store: not enough coins | Store → look at an expensive pet | Button says "Need N more" and cannot be pressed | ☐ | ☐ |
| 15 | Store: buy a pet | Buy a pet you can afford | Coins go down by the exact price; "moved into your house!" | ☐ | ☐ |
| 16 | No double purchase | Look at the bought pet | Says "In your house"; cannot buy again | ☐ | ☐ |
| 17 | House | House | The bought pet is shown | ☐ | ☐ |
| 18 | Spanish mode | Tap **Español** (or **ES** on a phone) | Whole interface in Spanish; words stay English with "En español: …" | ☐ | ☐ |
| 19 | Account page | Account | Name, username, verified email (partly hidden), language, Sign out | ☐ | ☐ |
| 20 | Sign out and privacy | Sign out → create a second account | Second account sees none of the first account's cards, coins or pets | ☐ | ☐ |
| 21 | Same account on both | Log in on the phone with the computer's account | Same cards, coins and pets | ☐ | ☐ |

If something fails during the demo, say so and show the automated test for
it (`tests/integration/test_saved_features.py`).
