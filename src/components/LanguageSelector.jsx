import { useState } from 'react'
import { useLanguage } from '../i18n.jsx'
import '../styles/LanguageSelector.css'

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
]

function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="language-selector">
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="language-selector-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">文</span> {t('Language')}
      </button>
      {isOpen && (
        <div aria-label={t('Language')} className="language-selector-menu" role="group">
          {languages.map((option) => (
            <button
              aria-pressed={language === option.code}
              className="language-selector-option"
              key={option.code}
              onClick={() => {
                setLanguage(option.code)
                setIsOpen(false)
              }}
              type="button"
            >
              <span>{option.name}</span>
              {language === option.code && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSelector
