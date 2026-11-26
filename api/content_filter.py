"""Child-safety filter for picture search, applied on the server.

Pixabay's safesearch removes explicit images, but not rude words in captions
or dark themes. Mangos is used by young learners, so every search result is
also checked here: a picture is dropped when any of its tags (or a search
itself) contains a blocked word. The team should review this list.

Checked against the top 20 results of all 297 suggested searches: "skeleton"
(anatomy diagrams for "body") and "shooting" (archery targets for "central")
were removed because they only blocked good pictures.
"""
import re

BLOCKED_WORDS = {
    # rude words
    "shit", "shitty", "crap", "fuck", "fucking", "damn", "bitch", "ass", "asshole", "bastard", "hell", "piss",
    "wtf", "stupid", "idiot", "sucks",
    # adult themes
    "sex", "sexy", "nude", "naked", "nudity", "erotic", "lingerie", "bikini", "underwear", "topless", "kiss",
    "kissing", "romance", "romantic", "lovers", "seduction", "flirt",
    # violence and fear
    "gun", "guns", "pistol", "rifle", "weapon", "weapons", "shooter", "sniper", "crosshair",
    "knife", "blood", "bloody", "gore", "kill", "killer", "murder", "dead body", "corpse", "skull", "skulls",
    "horror", "scary", "creepy", "zombie", "zombies", "monster", "demon", "devil", "satan",
    "evil", "ghost", "halloween", "death", "grave", "coffin", "suicide", "war crime", "terror", "terrorist",
    # alcohol, drugs, gambling
    "beer", "wine", "alcohol", "drunk", "cocktail", "whiskey", "vodka", "cigarette", "smoking", "drugs",
    "cannabis", "marijuana", "casino", "gambling",
    # symbols that confused earlier reviews
    "occult", "illuminati", "pentagram",
}

_WORD = re.compile(r"[a-z]+(?: [a-z]+)?")


def _words(text):
    words = set(re.findall(r"[a-z]+", text.lower()))
    tokens = re.findall(r"[a-z]+", text.lower())
    words.update(f"{a} {b}" for a, b in zip(tokens, tokens[1:]))  # two-word entries such as "dead body"
    return words


def is_blocked(text):
    """True when text (a search or a picture's tags) contains a blocked word."""
    return bool(_words(text or "") & BLOCKED_WORDS)
