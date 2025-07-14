import { updateStudyStreak } from './streak.js';
import { applyTheme } from './utils.js';
import { calculateNextSRSState } from './srs.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM ELEMENTS ---
  const elements = {
    // Flashcard
    cardFrontText: document.getElementById('card-front-text'),
    cardExample: document.getElementById('card-example'),
    listenBtn: document.getElementById('listen-btn'),
    cardBackText: document.getElementById('card-back-text'),
    cardBack: document.getElementById('card-back'),
    showAnswerBtn: document.getElementById('show-answer-btn'),
    ratingButtons: {
      again: document.getElementById('again-btn'),
      hard: document.getElementById('hard-btn'),
      good: document.getElementById('good-btn'),
      easy: document.getElementById('easy-btn'),
    },
    restartBtn: document.getElementById('restart-btn'),
    progressText: document.getElementById('progress-text'),
    
    // Pomodoro
    pomodoroDisplay: document.getElementById('pomodoro-display'),
    pomodoroStatus: document.getElementById('pomodoro-status'),
    pomodoroStartBtn: document.getElementById('pomodoro-start-btn'),
    pomodoroPauseBtn: document.getElementById('pomodoro-pause-btn'),
    pomodoroResetBtn: document.getElementById('pomodoro-reset-btn'),
    
    // Dictionary
    dictionaryLinksContainer: document.getElementById('dictionary-links'),
    googleLink: document.getElementById('google-link'),
    wrLink: document.getElementById('wr-link')
  };

  // --- STATE MANAGEMENT ---
  const state = {
    allCards: [],
    studyDeck: [],
    currentIndex: 0,
    cardsInAgainQueue: [],
    targetLang: 'en',
    dailyStudyLimit: 20,
    
    // Pomodoro
    pomodoroTimerId: null,
    pomodoroTimeLeft: 1500,
    pomodoroIsRunning: false,
    pomodoroIsWorkSession: true,
    pomodoroSettings: { work: 25, break: 5 },
  };

  // --- UI State Management ---
  /**
   * Manages the visibility of UI elements based on the study state.
   * @param {'question'|'answer'|'end'|'idle'} uiState - The current state of the UI.
   */
  const setUIState = (uiState) => {
    const isQuestion = uiState === 'question';
    const isAnswer = uiState === 'answer';
    const isEnd = uiState === 'end';
    const isIdle = uiState === 'idle';

    // Card visibility
    elements.cardBack.style.display = isAnswer ? 'block' : 'none';

    // Button visibility
    elements.showAnswerBtn.style.display = isQuestion ? 'inline-block' : 'none';
    Object.values(elements.ratingButtons).forEach(btn => {
      btn.style.display = isAnswer ? 'inline-block' : 'none';
    });
    elements.restartBtn.style.display = isEnd ? 'inline-block' : 'none';
    elements.listenBtn.style.display = (isQuestion || isAnswer) ? 'inline-block' : 'none';

    // Other elements
    elements.dictionaryLinksContainer.style.display = isAnswer ? 'block' : 'none';

    const currentCard = state.studyDeck[state.currentIndex];
    const showExample = (isQuestion || isAnswer) && currentCard && currentCard.example;
    elements.cardExample.style.display = showExample ? 'block' : 'none';
    if (showExample) {
      elements.cardExample.textContent = `"${currentCard.example}"`;
    }

    if (isIdle) {
      elements.cardFrontText.textContent = 'No tienes tarjetas guardadas. ¡Añade algunas para empezar a estudiar!';
    }
  };

  // --- UTILITY FUNCTIONS ---
  const shuffleArray = array => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const formatTime = seconds => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // --- CORE FUNCTIONS ---
  const buildStudyDeck = () => {
    const now = new Date();
    const dueCards = state.allCards.filter(card => new Date(card.due) <= now);
    return shuffleArray(dueCards).slice(0, state.dailyStudyLimit);
  };

  const displayCard = () => {
    // Handle deck transitions
    if (state.currentIndex >= state.studyDeck.length) {
      if (state.cardsInAgainQueue.length > 0) {
        state.studyDeck = shuffleArray(state.cardsInAgainQueue);
        state.cardsInAgainQueue = [];
        state.currentIndex = 0;
      } else {
        endSession();
        return;
      }
    }

    const currentCard = state.studyDeck[state.currentIndex];
    
    elements.cardFrontText.textContent = currentCard.original;
    elements.cardBackText.textContent = currentCard.traduccion;
    
    setUIState('question');
    
    elements.listenBtn.onclick = () => {
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${
        encodeURIComponent(currentCard.original)
      }&tl=${state.targetLang}&client=tw-ob`;
      new Audio(audioUrl).play();
    };
    
    elements.progressText.textContent = `Tarjetas restantes: ${
      state.studyDeck.length - state.currentIndex + state.cardsInAgainQueue.length
    }`;
  };

  const startSession = () => {
    state.studyDeck = buildStudyDeck();
    state.cardsInAgainQueue = [];
    state.currentIndex = 0;
    
    state.studyDeck.length === 0 
      ? endSession(true)
      : displayCard();
  };

  const endSession = (noCardsToStudy = false) => {
    elements.cardFrontText.textContent = noCardsToStudy
      ? '¡Felicidades! No tienes tarjetas para estudiar hoy.'
      : '¡Sesión de estudio completada!';
    elements.progressText.textContent = '';
    setUIState('end');
  };

  const loadCards = () => {
    chrome.storage.local.get({ selecciones: [] }, result => {
      state.allCards = result.selecciones.map(card => ({
        ...card,
        due: card.due || new Date().toISOString(),
        stability: card.stability || 0,
        difficulty: card.difficulty || 0.5
      }));

      if (state.allCards.length === 0) {
        setUIState('idle');
      } else {
        startSession();
      }
    });
  };

  const handleCardRating = async rating => {
    const cardInSession = state.studyDeck[state.currentIndex];
    const cardInStorage = state.allCards.find(c => c.original === cardInSession.original);
    
    if (!cardInStorage) return;

    const { stability, difficulty, due, isAgain } = calculateNextSRSState(cardInStorage, rating);

    // Update card properties
    cardInStorage.difficulty = difficulty;
    cardInStorage.stability = stability;
    cardInStorage.due = due;

    if (isAgain) {
      state.cardsInAgainQueue.push(cardInSession);
    }

    // Persist changes
    await chrome.storage.local.set({ selecciones: state.allCards });
    updateStudyStreak();
    state.currentIndex++;
    displayCard();
  };

  const updateDictionaryLinks = () => {
    const currentCard = state.studyDeck[state.currentIndex];
    if (!currentCard) return;

    chrome.storage.local.get({ targetLanguage: 'es' }, ({ targetLanguage }) => {
      const encodedWord = encodeURIComponent(currentCard.traduccion);
      
      // Google Translate link
      elements.googleLink.onclick = e => {
        e.preventDefault();
        chrome.tabs.create({ 
          url: `https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodedWord}&op=translate`
        });
      };

      // WordReference link
      const fromLang = currentCard.sourceLang && !['auto', 'csv'].includes(currentCard.sourceLang) 
        ? currentCard.sourceLang 
        : 'en';
      
      elements.wrLink.onclick = e => {
        e.preventDefault();
        chrome.tabs.create({ 
          url: `https://www.wordreference.com/${fromLang}${targetLanguage}/${encodedWord}`
        });
      };
    });
  };

  // --- POMODORO FUNCTIONS ---
  const stopAllTimers = () => {
    clearInterval(state.pomodoroTimerId);
    state.pomodoroTimerId = null;
    document.title = 'Modo Estudio';
  };

  const updatePomodoroDisplay = () => {
    elements.pomodoroDisplay.textContent = formatTime(state.pomodoroTimeLeft);
    if (state.pomodoroIsRunning) {
      document.title = `(${formatTime(state.pomodoroTimeLeft)}) Modo Estudio`;
    }
  };

  const startPomodoro = () => {
    if (state.pomodoroIsRunning) return;
    state.pomodoroIsRunning = true;

    elements.pomodoroStartBtn.style.display = 'none';
    elements.pomodoroPauseBtn.style.display = 'inline-block';

    state.pomodoroTimerId = setInterval(() => {
      state.pomodoroTimeLeft--;
      updatePomodoroDisplay();

      if (state.pomodoroTimeLeft <= 0) {
        switchPomodoroSession();
      }
    }, 1000);
    updatePomodoroDisplay(); // Update title immediately
  };

  const pausePomodoro = () => {
    if (!state.pomodoroIsRunning) return;
    state.pomodoroIsRunning = false;

    elements.pomodoroStartBtn.style.display = 'inline-block';
    elements.pomodoroPauseBtn.style.display = 'none';
    stopAllTimers();
  };

  const switchPomodoroSession = () => {
    stopAllTimers();
    state.pomodoroIsWorkSession = !state.pomodoroIsWorkSession;
    state.pomodoroIsRunning = false;

    if (state.pomodoroIsRunning) {
      state.pomodoroStatus.textContent = 'Tiempo de Trabajo';
      state.pomodoroTimeLeft = state.pomodoroSettings.work * 60;
    } else {
      state.pomodoroStatus.textContent = 'Tiempo de Descanso';
      state.pomodoroTimeLeft = state.pomodoroSettings.break * 60;
    }

    updatePomodoroDisplay();
    elements.pomodoroStartBtn.style.display = 'inline-block';
    elements.pomodoroPauseBtn.style.display = 'none';
    alert(state.pomodoroIsWorkSession ? '¡Hora de trabajar!' : '¡Tiempo de un descanso!');
  };

  const resetPomodoro = () => {
    stopAllTimers();

    state.pomodoroIsRunning = false;
    state.pomodoroIsWorkSession = true;
    state.pomodoroStatus.textContent = 'Tiempo de Trabajo';
    state.pomodoroTimeLeft = state.pomodoroSettings.work * 60;
    
    updatePomodoroDisplay();
    elements.pomodoroStartBtn.style.display = 'inline-block';
    elements.pomodoroPauseBtn.style.display = 'none';
  };

  const loadPomodoroSettings = () => {
    chrome.storage.local.get({ pomodoroWork: 25, pomodoroBreak: 5 }, items => {
      state.pomodoroSettings = { 
        work: items.pomodoroWork, 
        break: items.pomodoroBreak 
      };
      resetPomodoro();
    });
  };

  // --- EVENT HANDLERS ---
  const setupEventListeners = () => {
    // Flashcard events
    elements.showAnswerBtn.addEventListener('click', () => {
      setUIState('answer');
      updateDictionaryLinks();
    });

    Object.entries(elements.ratingButtons).forEach(([rating, button]) => {
      button.addEventListener('click', () => handleCardRating(rating));
    });

    elements.restartBtn.addEventListener('click', startSession);

    // Pomodoro events
    elements.pomodoroStartBtn.addEventListener('click', startPomodoro);
    elements.pomodoroPauseBtn.addEventListener('click', pausePomodoro);
    elements.pomodoroResetBtn.addEventListener('click', resetPomodoro);
  };

  // --- INITIALIZATION ---
  const initialize = () => {
    chrome.storage.local.get(
      {
        pomodoroWork: 25,
        pomodoroBreak: 5,
        dailyStudyLimit: 20,
        theme: 'system',
        targetLanguage: 'es'
      },
      items => {
        state.pomodoroSettings = {
          work: items.pomodoroWork,
          break: items.pomodoroBreak
        };
        state.dailyStudyLimit = items.dailyStudyLimit;
        state.targetLang = items.targetLanguage;
        
        applyTheme(items.theme);
        resetPomodoro();
        loadCards();
      }
    );
  };

  // --- START APPLICATION ---
  setupEventListeners();
  initialize();
});