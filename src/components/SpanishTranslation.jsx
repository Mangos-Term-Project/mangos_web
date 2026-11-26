import { getSpanishTranslations } from '../data/wordTranslations.js'
import { useLanguage } from '../i18n/language.js'

// Shows a vocabulary word's Spanish translation, only in Spanish mode.
// Words that are two parts of speech (such as "work") show both.
function SpanishTranslation({ word, className = '' }) {
	const { language, t } = useLanguage()
	if (language !== 'es') return null
	const translations = getSpanishTranslations(word)
	if (!translations.length) return null
	const label = translations.length === 1
		? translations[0].spanish
		: translations.map((item) => `${item.spanish} (${t(`words.part.${item.partOfSpeech}`)})`).join(' · ')
	return (
		<span className={`spanish-translation ${className}`.trim()} lang="es">
			{t('words.inSpanish')} <strong>{label}</strong>
		</span>
	)
}

export default SpanishTranslation
