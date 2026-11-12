// Keep the supplied order and repeated entries. Position identifies each prompt.
export const wordGroups = [
	['Nouns', `
time person year way day thing man world life hand part child eye woman place work week case point company
number group problem fact home water room mother area money story student study book job word business issue
side kind head house service friend father power hour game line end member law car city name president team
minute idea kid body back parent face others level office door health person art war history party result
change morning reason research girl guy moment air teacher force education foot boy age policy process music
market sense nation plan college price news test
`],
	['Verbs', `
be seem have help do talk say turn go start get show make hear know play think run take move see like come live
want hold look bring use write find sit give stand tell lose work pay call meet try include ask continue need
change feel happen become wait follow explain stop reach learn add understand create allow decide suggest
consider appear improve produce establish offer depend cover win serve discover experience develop plan maintain
discuss support notice avoid build manage grow involve open increase close recommend send share receive focus
build respond choose achieve drive prepare break belong
`],
	['Adjectives', `
good new first last long great little own other old right big high different small large next early young
important few public bad same able happy sure clear hard whole low strong free true full special easy human
local late short single simple recent wrong main current useful popular serious common likely ready private
fine real open legal cold hot dead central safe nice dark bright left modern poor rich light various close
clean strong busy quiet familiar foreign excellent difficult similar expensive wide narrow deep flat mental
physical smart interesting boring funny lucky angry calm honest friendly helpful healthy
`],
].map(([label, words]) => ({ label, words: words.trim().split(/\s+/) }))
