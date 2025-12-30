let wordsData = [];
let currentWordIndex = 0;
let stats = {
  streak: 0,
  wordsLearned: 0,
  lastVisit: null
};
let quizWords = [];
let isWidgetMinimized = false;

async function init() {
  await loadWords();
  await loadStats();
  await loadTopSites();
  updateStreak();
  displayWord();
  
  // Ensure quiz is hidden on startup
  document.getElementById('quizModal').classList.add('hidden');
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

async function loadTopSites() {
  try {
    const sites = await chrome.topSites.get();
    const shortcutsContainer = document.getElementById('shortcuts');
    
    // Display up to 8 sites
    const sitesToShow = sites.slice(0, 8);
    
    sitesToShow.forEach(site => {
      const shortcut = document.createElement('a');
      shortcut.className = 'shortcut-item';
      shortcut.href = site.url;
      shortcut.title = site.title;
      
      // Extract domain for favicon
      const url = new URL(site.url);
      const domain = url.hostname;
      
      shortcut.innerHTML = `
        <div class="shortcut-icon">
          <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" 
               onerror="this.style.display='none'; this.parentElement.textContent='🌐'">
        </div>
        <div class="shortcut-title">${site.title || domain}</div>
      `;
      
      shortcutsContainer.appendChild(shortcut);
    });
  } catch (error) {
    console.error('Error loading top sites:', error);
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
  if (wordsData.length === 0) return;
  
  const word = wordsData[currentWordIndex];
  
  document.getElementById('word').textContent = word.word;
  document.getElementById('pronunciation').textContent = word.pronunciation;
  document.getElementById('definition').textContent = word.definition;
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
  
  document.getElementById('wordsLearned').textContent = stats.wordsLearned;
  
  // Check if quiz should be shown
  if (shouldShowQuiz()) {
    setTimeout(() => {
      generateQuiz();
    }, 500);
  }
}

function shuffleWord() {
  // Get random word index different from current
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * wordsData.length);
  } while (randomIndex === currentWordIndex && wordsData.length > 1);
  
  currentWordIndex = randomIndex;
  displayWord();
  saveStats();
}

function toggleMinimize() {
  const widget = document.querySelector('.vocab-widget');
  const btn = document.getElementById('minimizeBtn');
  
  isWidgetMinimized = !isWidgetMinimized;
  
  if (isWidgetMinimized) {
    widget.classList.add('minimized');
    btn.textContent = '+';
    btn.title = 'Expand';
  } else {
    widget.classList.remove('minimized');
    btn.textContent = '−';
    btn.title = 'Minimize';
  }
}

function shouldShowQuiz() {
  // Show quiz every 10 words
  return stats.wordsLearned > 0 && stats.wordsLearned % 10 === 0;
}

function generateQuiz() {
  // Get the last 5 words learned
  quizWords = [];
  for (let i = 0; i < 5; i++) {
    let wordIndex = (currentWordIndex - i - 1 + wordsData.length) % wordsData.length;
    quizWords.push(wordsData[wordIndex]);
  }
  
  const questionsContainer = document.getElementById('quizQuestions');
  questionsContainer.innerHTML = '';
  
  quizWords.forEach((word, index) => {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'quiz-question';
    
    // Generate wrong answers
    const wrongAnswers = getRandomDefinitions(word.definition, 3);
    const allAnswers = [word.definition, ...wrongAnswers];
    shuffleArray(allAnswers);
    
    questionDiv.innerHTML = `
      <h4>What does "${word.word}" mean?</h4>
      <div class="quiz-options">
        ${allAnswers.map((answer, i) => `
          <div class="quiz-option">
            <input type="radio" id="q${index}_a${i}" name="question${index}" value="${answer}">
            <label for="q${index}_a${i}">${answer}</label>
          </div>
        `).join('')}
      </div>
    `;
    
    questionsContainer.appendChild(questionDiv);
  });
  
  document.getElementById('quizModal').classList.remove('hidden');
  document.getElementById('quizResults').classList.add('hidden');
  document.getElementById('submitQuizBtn').classList.remove('hidden');
}

function getRandomDefinitions(correctDefinition, count) {
  const wrongDefs = wordsData
    .filter(w => w.definition !== correctDefinition)
    .map(w => w.definition);
  
  shuffleArray(wrongDefs);
  return wrongDefs.slice(0, count);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function submitQuiz() {
  let score = 0;
  const feedback = [];
  
  quizWords.forEach((word, index) => {
    const selected = document.querySelector(`input[name="question${index}"]:checked`);
    const selectedAnswer = selected ? selected.value : null;
    const correct = selectedAnswer === word.definition;
    
    if (correct) score++;
    
    feedback.push({
      word: word.word,
      correct: correct,
      selectedAnswer: selectedAnswer,
      correctAnswer: word.definition
    });
    
    // Highlight correct/incorrect
    const options = document.querySelectorAll(`input[name="question${index}"]`);
    options.forEach(option => {
      const parent = option.parentElement;
      if (option.value === word.definition) {
        parent.classList.add('correct');
      } else if (option.checked && option.value !== word.definition) {
        parent.classList.add('incorrect');
      }
    });
  });
  
  // Show results
  document.getElementById('quizScore').textContent = `You scored ${score} out of 5!`;
  
  const feedbackContainer = document.getElementById('quizFeedback');
  feedbackContainer.innerHTML = feedback.map(item => `
    <div class="feedback-item ${item.correct ? 'correct' : 'incorrect'}">
      <div class="feedback-word">${item.word}</div>
      <div class="feedback-answer">
        ${item.correct ? '✓ Correct!' : `✗ Wrong. Correct answer: ${item.correctAnswer}`}
      </div>
    </div>
  `).join('');
  
  document.getElementById('quizResults').classList.remove('hidden');
  document.getElementById('submitQuizBtn').classList.add('hidden');
}

function closeQuiz() {
  document.getElementById('quizModal').classList.add('hidden');
}

// Wait for page to load before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Ensure quiz is hidden immediately
  document.getElementById('quizModal').classList.add('hidden');
  
  // Event listeners for vocab widget buttons
  document.getElementById('pronounceBtn').addEventListener('click', pronounceWord);
  document.getElementById('nextBtn').addEventListener('click', nextWord);
  document.getElementById('shuffleBtn').addEventListener('click', shuffleWord);
  document.getElementById('minimizeBtn').addEventListener('click', toggleMinimize);
  
  // Quiz event listeners
  document.getElementById('submitQuizBtn').addEventListener('click', submitQuiz);
  document.getElementById('continueBtn').addEventListener('click', closeQuiz);

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
});
