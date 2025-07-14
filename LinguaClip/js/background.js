// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveSelection",
    title: "Guardar Selección",
    contexts: ["selection"]
  });
});

// Handle the context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveSelection" && info.selectionText) {
    await saveSelection(info.selectionText);
  }
});

/**
 * Translates text using the Google Translate API.
 * @param {string} text - The text to translate.
 * @param {string} from - Source language ('auto' for detection).
 * @param {string} to - Target language.
 * @returns {Promise<{translation: string, detectedLang: string}>}
 */
async function translateText(text, from, to) {
  const encodedText = encodeURIComponent(text);
  const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodedText}`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Error en la API de traducción: ${response.status}`);
  }
  const data = await response.json();
  
  return {
    translation: data?.[0]?.[0]?.[0] || text,
    detectedLang: data?.[2] || from,
  };
}

/**
 * Gets an example sentence from the dictionary API.
 * @param {string} word - The word to look up.
 * @param {string} lang - The language of the word.
 * @returns {Promise<string|null>} The example sentence or null.
 */
async function getExampleSentence(word, lang) {
  if (!lang || word.includes(' ')) {
    return null;
  }
  try {
    const dictionaryApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`;
    const dictionaryResponse = await fetch(dictionaryApiUrl);
    if (dictionaryResponse.ok) {
        const dictionaryData = await dictionaryResponse.json();
        return dictionaryData[0]?.meanings?.flatMap(m => m.definitions)?.find(d => d.example)?.example || null;
    }
  } catch (dictError) {
    console.log("Could not get dictionary information:", dictError.message);
  }
  return null;
}

/**
 * Adds a new card to local storage.
 * @param {object} card - The card object to save.
 */
async function addCardToStorage(card) {
  const storageResult = await chrome.storage.local.get({ selecciones: [] });
  const cards = storageResult.selecciones;
  cards.push(card);
  await chrome.storage.local.set({ selecciones: cards });
  console.log("Selection saved:", card);
}

// translate and save the selection
async function saveSelection(text) {
  try {
    // Get settings and system language
    const settings = await chrome.storage.local.get({ targetLanguage: 'es' });
    const targetLang = settings.targetLanguage;
    const systemLang = chrome.i18n.getUILanguage().split('-')[0];

    const { translation: initialTranslation, detectedLang } = await translateText(text, 'auto', targetLang);

    let cardOriginal, cardTraduccion, cardSourceLang;

    // If the detected text is already in the target language, translate it to the system language for the back of the card.
    if (detectedLang === targetLang && targetLang !== systemLang) {
      cardOriginal = text; // The text is already in the learning language
      const { translation: backTranslation } = await translateText(text, targetLang, systemLang);
      cardTraduccion = backTranslation || "Translation not available";
      cardSourceLang = systemLang;
    } else {
      // NOTE: the front is the translation, the back is the original text.
      cardOriginal = initialTranslation;
      cardTraduccion = text;
      cardSourceLang = detectedLang;
    }

    // Get example sentence for the front of the card
    const example = await getExampleSentence(cardOriginal, targetLang);

    const newCard = {
      original: cardOriginal,
      traduccion: cardTraduccion,
      sourceLang: cardSourceLang,
      example: example,
      // Properties for the SRS algorithm
      due: new Date().toISOString(),
      stability: 0,
      difficulty: 0.5,
    };

    await addCardToStorage(newCard);

  } catch (error) {
    console.error("Error translating or saving:", error);
    // Optional: notify the user about the error.
  }
}
