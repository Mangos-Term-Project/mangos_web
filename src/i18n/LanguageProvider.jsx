import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './language.js'
import { serverMessages, strings } from './strings.js'

const STORAGE_KEY = 'mangos-language'
const LANGUAGES = ['en', 'es']

function initialLanguage() {
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY)
		if (LANGUAGES.includes(saved)) return saved
	} catch {
		// Storage can be unavailable; fall back to the browser language.
	}
	return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function fill(text, values) {
	return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match))
}

function LanguageProvider({ children }) {
	const [language, setLanguageState] = useState(initialLanguage)

	useEffect(() => {
		document.documentElement.lang = language === 'es' ? 'es' : 'en'
	}, [language])

	const setLanguage = useCallback((next) => {
		if (!LANGUAGES.includes(next)) return
		setLanguageState(next)
		try {
			window.localStorage.setItem(STORAGE_KEY, next)
		} catch {
			// The choice still applies for this visit.
		}
	}, [])

	const t = useCallback((key, values = {}) => {
		const text = strings[language]?.[key] ?? strings.en[key] ?? key
		return fill(text, values)
	}, [language])

	// Server error messages arrive in English; show a Spanish version when one exists.
	const translateMessage = useCallback((message) => {
		if (!message || language === 'en') return message
		for (const [pattern, spanish] of serverMessages) {
			const match = message.match(pattern)
			if (match) return spanish.replace(/\$(\d)/g, (_, index) => match[Number(index)] ?? '')
		}
		return message
	}, [language])

	const value = useMemo(() => ({ language, setLanguage, t, translateMessage }), [language, setLanguage, t, translateMessage])
	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export default LanguageProvider
