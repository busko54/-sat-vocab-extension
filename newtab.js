let wordsData = [];
let currentWordIndex = 0;
let stats = {
  streak: 0,
  wordsLearned: 0,
  lastVisit: null
};

async function init() {
  await loadWords();
  await loadStats();
  updateStreak();
  displayWord();
  updateProgress();
}

async function loadWords() {
  const response = await fetch('words.json');
  wordsData = await response.json();
}

async function loadStats() {
  const result = await chrome.storage.local.get(['stats', 'currentIndex']);
  if (result.stats) {
    stats = result.stats;
  }
  if (result.currentIndex !== undefined) {
    currentWordIndex = result.currentIndex;
  }
}

function saveStats() {
  chrome.storage.local.set({ 
    stats: stats,
    currentIndex: currentWordIndex 
  });
}

function updateStreak() {
  const today = new Date().toDateString();
  const lastVisit = stats.lastVisit;

  if (lastVisit === today) {
    // Same day
  } else if (isYesterday(lastVisit)) {
    stats.streak++;
  } else if (lastVisit) {
    stats.streak = 1;
  } else {
    stats.streak = 1;
  }

  stats.lastVisit = today;
  saveStats();
  
  document.getElementById('streak').textContent = stats.streak;
  document.getElementById('wordsLearned').textContent = stats.wordsLearned;
}

function isYesterday(dateString) {
  if (!dateString) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateString === yesterday.toDateString();
}

function displayWord() {
  const word = wordsData[currentWordIndex];
  
  document.getElementById('word').textContent = word.word;
  document.getElementById('pronunciation').textContent = word.pronunciation;
  document.getElementById('definition').textContent = word.definition;
  document.getElementById('example').textContent = `"${word.example}"`;
}

function updateProgress() {
  const progress = (stats.wordsLearned / wordsData.length) * 100;
  document.getElementById('progressBar').style.width = progress + '%';
}

function pronounceWord() {
  const word = wordsData[currentWordIndex].word;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.8;
  speechSynthesis.speak(utterance);
}

function nextWord() {
  stats.wordsLearned++;
  currentWordIndex = (currentWordIndex + 1) % wordsData.length;
  
  saveStats();
  displayWord();
  updateProgress();
  
  document.getElementById('wordsLearned').textContent = stats.wordsLearned;
}

function hideOverlayShowSearch() {
  document.getElementById('vocabOverlay').classList.add('hidden');
  document.getElementById('normalTab').classList.add('visible');
  document.getElementById('searchBox').focus();
}

// Wait for page to load before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Event listeners for buttons
  document.getElementById('pronounceBtn').addEventListener('click', pronounceWord);
  document.getElementById('nextBtn').addEventListener('click', nextWord);
  document.getElementById('skipBtn').addEventListener('click', hideOverlayShowSearch);

  // Handle search box
  document.getElementById('searchBox').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value;
      if (query.includes('.') && !query.includes(' ')) {
        window.location.href = 'https://' + query;
      } else {
        window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
      }
    }
  });

  // Initialize the extension
  init();

  // Auto-hide vocab overlay after 7 seconds
  setTimeout(hideOverlayShowSearch, 7000);
});
