/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const LANGUAGE_KEY = 'mangos-language'

const translations = {
  es: {
    Language: 'Idioma',
    English: 'Inglés', Spanish: 'Español', French: 'Francés',
    'A little practice. A lot of progress.': 'Un poco de práctica. Mucho progreso.',
    'English Learning': 'Aprendizaje de inglés',
    'Grow your confidence, one picture at a time.': 'Gana confianza, una imagen a la vez.',
    'Start learning': 'Empezar a aprender',
    'Your learning garden': 'Tu jardín de aprendizaje', 'Ready to grow?': '¿Listo para crecer?',
    'Build your vocabulary': 'Amplía tu vocabulario', 'Create your': 'Crea tus', 'Flash Cards': 'tarjetas de memoria',
    'Put your knowledge to work': 'Pon en práctica lo que sabes', 'Quiz yourself': 'Ponte a prueba',
    'Choose a set': 'Elige un conjunto', 'Make a set of 50 cards': 'Crea un conjunto de 50 tarjetas',
    'Keep growing': 'Sigue creciendo', 'Review your flash cards': 'Repasa tus tarjetas de memoria',
    "You haven't saved any flash cards yet.": 'Todavía no has guardado ninguna tarjeta.',
    'Create your first one': 'Crea la primera', 'Reviewing your set': 'Repasando tu conjunto',
    'Tap to see the word': 'Toca para ver la palabra', 'Tap to reveal the drawing': 'Toca para revelar el dibujo',
    'No drawing saved': 'No hay ningún dibujo guardado', 'Previous': 'Anterior', 'Next': 'Siguiente',
    'This set doesn\'t have any flash cards yet.': 'Este conjunto todavía no tiene tarjetas.',
    'Ready to practice?': '¿Listo para practicar?', 'Choose a set to quiz': 'Elige un conjunto para el cuestionario',
    'No sets are ready to quiz yet. Keep creating flash cards—your set will be ready after 50 cards.': 'Todavía no hay conjuntos listos para practicar. Sigue creando tarjetas: el conjunto estará listo al llegar a 50.',
    'Set complete': 'Conjunto terminado', 'Nice work!': '¡Buen trabajo!',
    'Back to your sets': 'Volver a tus conjuntos', 'Which drawing matches this word?': '¿Qué dibujo corresponde a esta palabra?',
    'Drawing choices': 'Opciones de dibujo', 'Choose the drawing that matches the word.': 'Elige el dibujo que corresponde a la palabra.',
    'That’s right!': '¡Correcto!', 'Not quite—the answer is': 'No exactamente: la respuesta es',
    'Finish quiz': 'Terminar cuestionario', 'Next question': 'Siguiente pregunta', 'Check answer': 'Comprobar respuesta',
    'This set doesn’t have any cards to quiz yet.': 'Este conjunto todavía no tiene tarjetas para el cuestionario.',
    'Your house': 'Tu casa', 'item': 'artículo', 'items': 'artículos', 'Image coming soon': 'Imagen próximamente',
    'Your house is waiting for its first item.': 'Tu casa espera su primer artículo.', 'Browse the store': 'Visitar la tienda',
    'The Store': 'La tienda', 'You have': 'Tienes', 'coins': 'monedas', 'was added to your house.': 'se añadió a tu casa.',
    'Could not complete the purchase.': 'No se pudo completar la compra.', 'In your house': 'En tu casa', 'Buying…': 'Comprando…',
    'Need more coins': 'Necesitas más monedas', Buy: 'Comprar',
    'Welcome back': 'Qué bueno verte de nuevo', 'Log in to Mangos': 'Inicia sesión en Mangos',
    'Pick up where your English practice left off.': 'Continúa donde dejaste tu práctica de inglés.',
    Username: 'Nombre de usuario', Password: 'Contraseña', 'Your username': 'Tu nombre de usuario', 'Your password': 'Tu contraseña',
    'Logging in...': 'Iniciando sesión...', 'Log in': 'Iniciar sesión',
    'Start your learning journey': 'Comienza tu aprendizaje', 'Create an account': 'Crear una cuenta',
    'Set up your Mangos learner profile.': 'Configura tu perfil de estudiante de Mangos.', 'Your name': 'Tu nombre',
    'Create a username': 'Crea un nombre de usuario', 'Choose a username': 'Elige un nombre de usuario',
    'Create a password': 'Crea una contraseña', 'Choose a password': 'Elige una contraseña',
    'Confirm your password': 'Confirma tu contraseña', 'Enter your password again': 'Escribe tu contraseña otra vez',
    'Creating account...': 'Creando cuenta...', 'Already have an account?': '¿Ya tienes una cuenta?',
    'Sign out': 'Cerrar sesión', House: 'Casa', Store: 'Tienda',
    'Draw this word': 'Dibuja esta palabra', 'Loading a word...': 'Cargando una palabra...', 'Word unavailable': 'Palabra no disponible',
    'All words completed': 'Has completado todas las palabras', 'Suggested picture searches:': 'Búsquedas de imágenes sugeridas:',
    'Suggested picture search:': 'Búsqueda de imágenes sugerida:', 'Search for this': 'Buscar esto',
    'Use your mouse or finger to draw': 'Usa el ratón o el dedo para dibujar', Undo: 'Deshacer', Clear: 'Borrar',
    'Save flash card': 'Guardar tarjeta', 'Saving...': 'Guardando...', Tool: 'Herramienta', Color: 'Color',
    Pencil: 'Lápiz', Marker: 'Rotulador', Eraser: 'Borrador', 'Brush size': 'Tamaño del pincel',
    'Achievement unlocked': 'Logro desbloqueado', 'Set complete!': '¡Conjunto terminado!',
    'You finished all 50 cards in': 'Terminaste las 50 tarjetas de', 'Great work!': '¡Excelente trabajo!', 'Keep going': 'Continuar',
    'Get inspired': 'Inspírate', 'Picture search': 'Búsqueda de imágenes', 'Search pictures...': 'Buscar imágenes...',
    'Searching…': 'Buscando…', Search: 'Buscar', 'Looking for reference pictures…': 'Buscando imágenes de referencia…',
    'No pictures found. Try a related word, such as clock for time.': 'No se encontraron imágenes. Prueba con una palabra relacionada.',
    'Pictures picked for this word': 'Imágenes seleccionadas para esta palabra',
    'Pictures from Pixabay. Tap a picture to see it larger.': 'Imágenes de Pixabay. Toca una imagen para verla más grande.',
    'Reference picture': 'Imagen de referencia', Close: 'Cerrar', 'Pictures from Pixabay.': 'Imágenes de Pixabay.',
    'As a noun:': 'Como sustantivo:', 'As an adjective:': 'Como adjetivo:', 'As a verb:': 'Como verbo:',
    'As an adjective': 'Como adjetivo', 'As a noun': 'Como sustantivo', 'As a verb': 'Como verbo',
    Meaning: 'Significado', 'Search reference pictures': 'Buscar imágenes de referencia',
    'card': 'tarjeta', 'cards': 'tarjetas', 'In review': 'En repaso',
    Card: 'Tarjeta', of: 'de', Quiz: 'Cuestionario',
    'Show the word': 'Mostrar la palabra', 'Reveal drawing for': 'Revelar el dibujo de',
    'House of': 'Casa de', 'You got': 'Obtuviste', 'out of': 'de', 'correct in': 'correctas en',
    'coin earned!': 'moneda ganada!', 'You already earned a coin for this card.': 'Ya ganaste una moneda por esta tarjeta.',
    'Could not award your quiz coin.': 'No se pudo otorgar la moneda del cuestionario.',
    Question: 'Pregunta', meaning: 'significado', color: 'color', Cocoa: 'Cacao', Mango: 'Mango',
    Tomato: 'Tomate', Blueberry: 'Arándano', Leaf: 'Hoja', Grape: 'Uva', Pink: 'Rosa',
    'You have made flash cards for every available word.': 'Ya has creado tarjetas con todas las palabras disponibles.',
    'was saved to your flash cards.': 'se guardó en tus tarjetas.',
    'Please enter your name.': 'Escribe tu nombre.', 'Name must be 256 characters or fewer.': 'El nombre debe tener 256 caracteres o menos.',
    'Username must be 3 to 30 characters: letters, numbers or underscores.': 'El nombre de usuario debe tener entre 3 y 30 caracteres: letras, números o guiones bajos.',
    'Password must be at least 8 characters.': 'La contraseña debe tener al menos 8 caracteres.',
    'Password must be at most 72 characters.': 'La contraseña debe tener como máximo 72 caracteres.',
    'Passwords do not match.': 'Las contraseñas no coinciden.',
  },
  fr: {
    Language: 'Langue',
    English: 'Anglais', Spanish: 'Espagnol', French: 'Français',
    'A little practice. A lot of progress.': 'Un peu de pratique. Beaucoup de progrès.',
    'English Learning': 'Apprentissage de l’anglais',
    'Grow your confidence, one picture at a time.': 'Gagnez en confiance, une image à la fois.',
    'Start learning': 'Commencer à apprendre',
    'Your learning garden': 'Votre jardin d’apprentissage', 'Ready to grow?': 'Prêt à progresser ?',
    'Build your vocabulary': 'Enrichissez votre vocabulaire', 'Create your': 'Créez vos', 'Flash Cards': 'cartes mémoire',
    'Put your knowledge to work': 'Mettez vos connaissances en pratique', 'Quiz yourself': 'Testez-vous',
    'Choose a set': 'Choisir une série', 'Make a set of 50 cards': 'Créer une série de 50 cartes',
    'Keep growing': 'Continuez à progresser', 'Review your flash cards': 'Réviser vos cartes mémoire',
    "You haven't saved any flash cards yet.": 'Vous n’avez pas encore enregistré de cartes mémoire.',
    'Create your first one': 'Créez la première', 'Reviewing your set': 'Révision de votre série',
    'Tap to see the word': 'Touchez pour voir le mot', 'Tap to reveal the drawing': 'Touchez pour révéler le dessin',
    'No drawing saved': 'Aucun dessin enregistré', Previous: 'Précédent', Next: 'Suivant',
    'This set doesn\'t have any flash cards yet.': 'Cette série ne contient pas encore de cartes mémoire.',
    'Ready to practice?': 'Prêt à vous entraîner ?', 'Choose a set to quiz': 'Choisissez une série pour le quiz',
    'No sets are ready to quiz yet. Keep creating flash cards—your set will be ready after 50 cards.': 'Aucune série n’est encore prête. Continuez à créer des cartes : la série sera prête après 50 cartes.',
    'Set complete': 'Série terminée', 'Nice work!': 'Beau travail !', 'Back to your sets': 'Retour à vos séries',
    'Which drawing matches this word?': 'Quel dessin correspond à ce mot ?', 'Drawing choices': 'Choix de dessins',
    'Choose the drawing that matches the word.': 'Choisissez le dessin qui correspond au mot.', 'That’s right!': 'C’est exact !',
    'Not quite—the answer is': 'Pas tout à fait : la réponse est', 'Finish quiz': 'Terminer le quiz',
    'Next question': 'Question suivante', 'Check answer': 'Vérifier la réponse',
    'This set doesn’t have any cards to quiz yet.': 'Cette série ne contient pas encore de cartes à tester.',
    'Your house': 'Votre maison', item: 'objet', items: 'objets', 'Image coming soon': 'Image à venir',
    'Your house is waiting for its first item.': 'Votre maison attend son premier objet.', 'Browse the store': 'Visiter la boutique',
    'The Store': 'La boutique', 'You have': 'Vous avez', coins: 'pièces', 'was added to your house.': 'a été ajouté à votre maison.',
    'Could not complete the purchase.': 'L’achat n’a pas pu être effectué.', 'In your house': 'Dans votre maison', 'Buying…': 'Achat…',
    'Need more coins': 'Pas assez de pièces', Buy: 'Acheter', 'Welcome back': 'Bon retour',
    'Log in to Mangos': 'Se connecter à Mangos', 'Pick up where your English practice left off.': 'Reprenez votre apprentissage de l’anglais là où vous l’aviez laissé.',
    Username: 'Nom d’utilisateur', Password: 'Mot de passe', 'Your username': 'Votre nom d’utilisateur', 'Your password': 'Votre mot de passe',
    'Logging in...': 'Connexion...', 'Log in': 'Se connecter', 'Start your learning journey': 'Commencez votre apprentissage',
    'Create an account': 'Créer un compte', 'Set up your Mangos learner profile.': 'Configurez votre profil d’apprenant Mangos.',
    'Your name': 'Votre nom', 'Create a username': 'Créer un nom d’utilisateur', 'Choose a username': 'Choisissez un nom d’utilisateur',
    'Create a password': 'Créer un mot de passe', 'Choose a password': 'Choisissez un mot de passe',
    'Confirm your password': 'Confirmez votre mot de passe', 'Enter your password again': 'Saisissez à nouveau votre mot de passe',
    'Creating account...': 'Création du compte...', 'Already have an account?': 'Vous avez déjà un compte ?',
    'Sign out': 'Se déconnecter', House: 'Maison', Store: 'Boutique',
    'Draw this word': 'Dessinez ce mot', 'Loading a word...': 'Chargement d’un mot...', 'Word unavailable': 'Mot indisponible',
    'All words completed': 'Tous les mots sont terminés', 'Suggested picture searches:': 'Recherches d’images suggérées :',
    'Suggested picture search:': 'Recherche d’image suggérée :', 'Search for this': 'Rechercher ceci',
    'Use your mouse or finger to draw': 'Dessinez avec votre souris ou votre doigt', Undo: 'Annuler', Clear: 'Effacer',
    'Save flash card': 'Enregistrer la carte mémoire', 'Saving...': 'Enregistrement...', Tool: 'Outil', Color: 'Couleur',
    Pencil: 'Crayon', Marker: 'Feutre', Eraser: 'Gomme', 'Brush size': 'Taille du pinceau',
    'Achievement unlocked': 'Succès débloqué', 'Set complete!': 'Série terminée !',
    'You finished all 50 cards in': 'Vous avez terminé les 50 cartes de', 'Great work!': 'Excellent travail !', 'Keep going': 'Continuer',
    'Get inspired': 'Trouvez l’inspiration', 'Picture search': 'Recherche d’images', 'Search pictures...': 'Rechercher des images...',
    'Searching…': 'Recherche…', Search: 'Rechercher', 'Looking for reference pictures…': 'Recherche d’images de référence…',
    'No pictures found. Try a related word, such as clock for time.': 'Aucune image trouvée. Essayez un mot associé.',
    'Pictures picked for this word': 'Images sélectionnées pour ce mot',
    'Pictures from Pixabay. Tap a picture to see it larger.': 'Images de Pixabay. Touchez une image pour l’agrandir.',
    'Reference picture': 'Image de référence', Close: 'Fermer', 'Pictures from Pixabay.': 'Images de Pixabay.',
    'As a noun:': 'Comme nom :', 'As an adjective:': 'Comme adjectif :', 'As a verb:': 'Comme verbe :',
    'As an adjective': 'Comme adjectif', 'As a noun': 'Comme nom', 'As a verb': 'Comme verbe',
    Meaning: 'Sens', 'Search reference pictures': 'Rechercher des images de référence',
    card: 'carte', cards: 'cartes', 'In review': 'À réviser',
    Card: 'Carte', of: 'sur', Quiz: 'Quiz',
    'Show the word': 'Afficher le mot', 'Reveal drawing for': 'Révéler le dessin de',
    'House of': 'Maison de', 'You got': 'Vous avez obtenu', 'out of': 'sur', 'correct in': 'bonnes réponses dans',
    'coin earned!': 'pièce gagnée !', 'You already earned a coin for this card.': 'Vous avez déjà gagné une pièce pour cette carte.',
    'Could not award your quiz coin.': 'Impossible d’attribuer la pièce du quiz.',
    Question: 'Question', meaning: 'sens', color: 'couleur', Cocoa: 'Cacao', Mango: 'Mangue',
    Tomato: 'Tomate', Blueberry: 'Myrtille', Leaf: 'Feuille', Grape: 'Raisin', Pink: 'Rose',
    'You have made flash cards for every available word.': 'Vous avez créé des cartes mémoire pour tous les mots disponibles.',
    'was saved to your flash cards.': 'a été enregistré dans vos cartes mémoire.',
    'Please enter your name.': 'Veuillez saisir votre nom.', 'Name must be 256 characters or fewer.': 'Le nom doit comporter 256 caractères ou moins.',
    'Username must be 3 to 30 characters: letters, numbers or underscores.': 'Le nom d’utilisateur doit comporter de 3 à 30 caractères : lettres, chiffres ou traits de soulignement.',
    'Password must be at least 8 characters.': 'Le mot de passe doit comporter au moins 8 caractères.',
    'Password must be at most 72 characters.': 'Le mot de passe doit comporter au maximum 72 caractères.',
    'Passwords do not match.': 'Les mots de passe ne correspondent pas.',
  },
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_KEY)
      return ['en', 'es', 'fr'].includes(saved) ? saved : 'en'
    } catch {
      return 'en'
    }
  })

  const setLanguage = (nextLanguage) => {
    if (!['en', 'es', 'fr'].includes(nextLanguage)) return
    setLanguageState(nextLanguage)
    try {
      window.localStorage.setItem(LANGUAGE_KEY, nextLanguage)
    } catch {
      // Language selection still works for the current page if storage is unavailable.
    }
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (text) => translations[language]?.[text] ?? text,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

const definitionCache = new Map()

export async function translateDefinition(text, language) {
  if (!text || language === 'en') return text
  const key = `${language}:${text}`
  if (definitionCache.has(key)) return definitionCache.get(key)

  try {
    const params = new URLSearchParams({ q: text, langpair: `en|${language}` })
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`)
    if (!response.ok) return text
    const data = await response.json()
    const translated = data?.responseData?.translatedText
    const result = typeof translated === 'string' && data?.responseStatus === 200 ? translated : text
    definitionCache.set(key, result)
    return result
  } catch {
    return text
  }
}
