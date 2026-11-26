# Picture search: relevance and choices

## The problem

Instructor feedback: many pictures did not fit their words, especially
verbs and adjectives, and tapping a picture opened the Pixabay website.

## What we found

Pixabay matches search words against each picture's tags, and every word
in the search must match. Many suggested phrases were long (for example
"child looking in toy shop window"), so they found few pictures or the
wrong ones. 60 of 297 phrases were longer than three words, 33 of them
verbs. Verbs and adjectives are also hard to photograph.

## What we changed

1. **Shorter phrases.** 79 phrases were rewritten as short tag words
   (for example "wish", "puddle jump", "starting blocks"). No phrase is
   longer than three words, and no two words share a phrase.
2. **Drawings first for verbs and adjectives.** Learners can choose All,
   Drawings or Photos. Verb and adjective suggestions search drawings
   (Pixabay `image_type=illustration`), which usually show an action or a
   quality more clearly than a photo.
3. **One tap.** "Search for this" searches the suggestion immediately.
4. **The meaning is always shown** next to the word, so learners do not
   rely on a picture alone.
5. **No links out of Mangos.** Tapping a picture enlarges it inside the
   app. The page shows "Pictures from Pixabay." as Pixabay's API terms ask
   ("show your users where the images and videos are from, whenever search
   results are displayed"); the terms do not require a link.

## Checking the phrases

`api/tools/check_hint_searches.py` counts how many pictures each phrase
finds, with the same picture type the app uses, and lists the weakest.
It needs the Pixabay key, sends at most one request per second, and keeps
results for 24 hours as Pixabay requires:

```
PIXABAY_API_KEY=... python api/tools/check_hint_searches.py --parts verb,adjective
```

A phrase with many results can still show unhelpful pictures, so look at
the weakest ones in the app as well.

## Options we considered

| Option | Decision | Why |
|---|---|---|
| Google image search (instructor's suggestion) | Not possible | Google's Custom Search JSON API is closed to new customers and is discontinued on January 1, 2027. New Programmable Search engines can search at most 50 chosen sites, and the embeddable search box renders its own results and ads instead of our `<img>` tags. Copying results from Google Images breaks Google's terms. |
| Openverse | Not chosen | About 5 searches an hour without an account; every picture needs its own license credit. |
| Wikimedia Commons | Not chosen | No safe-search filter, which matters for young learners. |
| Pixabay with the fixes above | Chosen | Safe search, free for this use, server-side key, and the fixes address the cause. |
| Team-picked pictures for the hardest words | Optional next step | Some words ("be", "seem", "know") have no good picture in any search engine. A teammate could choose one picture per hard word to show first. |
