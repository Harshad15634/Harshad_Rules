// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAHZW7qV9wBSEt1eLmEl3_btb2tPt619qY",
    authDomain: "tradingjournal-a04ac.firebaseapp.com",
    databaseURL: "https://tradingjournal-a04ac-default-rtdb.firebaseio.com",
    projectId: "tradingjournal-a04ac",
    storageBucket: "tradingjournal-a04ac.appspot.com",
    messagingSenderId: "875390460439",
    appId: "1:875390460439:web:0c1b5a9a3a6a5e5a5a5a5a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global variables
let studyData = {};
let currentSubject = '';
let currentChapter = '';
let currentQuestionType = '';
let currentQuestions = [];
let currentIndex = 0;
let isFlipped = false;
let mcqAnswered = false;
let userName = '';
let userKey = '';

// Sanitize username for Firebase key
function sanitizeUsername(username) {
    // Replace invalid Firebase key characters with underscores
    return username.replace(/[.$#[\]/]/g, '_');
}

// Generate a unique suffix if username exists
async function getUniqueUsernameKey(baseKey) {
    let counter = 1;
    let uniqueKey = baseKey;
    
    // Check if the key exists
    const snapshot = await database.ref('users/' + uniqueKey).once('value');
    
    // If it exists, find the next available suffix
    if (snapshot.exists()) {
        while (true) {
            const newKey = `${baseKey}_${counter}`;
            const newSnapshot = await database.ref('users/' + newKey).once('value');
            if (!newSnapshot.exists()) {
                return newKey;
            }
            counter++;
        }
    }
    
    return uniqueKey;
}

// Get user details (IP, device info, etc.)
async function getUserDetails() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return {
            ip: data.ip,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        };
    } catch (error) {
        console.error('Error getting user details:', error);
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform
        };
    }
}

// Check if user exists in database
async function checkUserExists() {
    userKey = localStorage.getItem('userKey');
    if (userKey) {
        // User exists, get their data
        const snapshot = await database.ref('users/' + userKey).once('value');
        if (snapshot.exists()) {
            const userData = snapshot.val();
            userName = userData.name;
            document.getElementById('greetingText').textContent = `Hello ${userName}! 👋`;
            
            const now = new Date().toISOString();
            const updates = {
                lastVisit: now
            };
            
            // If visits array doesn't exist, create it with previous lastVisit
            if (!userData.visits) {
                updates.visits = [userData.firstVisit || now];
            }
            
            // Add current visit to visits array
            updates.visits = [...(userData.visits || []), now];
            
            // Update user data
            await database.ref('users/' + userKey).update(updates);
            
            return true;
        }
    }
    return false;
}

// Save new user to database
async function saveNewUser(name) {
    const sanitized = sanitizeUsername(name);
    userKey = await getUniqueUsernameKey(sanitized);
    localStorage.setItem('userKey', userKey);
    userName = name;
    
    const userDetails = await getUserDetails();
    const now = new Date().toISOString();
    
    const userData = {
        name: name,
        ...userDetails,
        firstVisit: now,
        lastVisit: now,
        visits: [now] // Initialize visits array with first visit
    };
    
    await database.ref('users/' + userKey).set(userData);
    document.getElementById('greetingText').textContent = `Hello ${userName}! 👋`;
}

// Dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    const icon = document.querySelector('#darkModeToggle i');
    if (isDarkMode) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Initialize dark mode from localStorage
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#darkModeToggle i');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

// Load JSON data
async function loadStudyData() {
    try {
        const response = await fetch('data.json');
        if (response.ok) {
            studyData = await response.json();
            console.log('Data loaded from external JSON file');
            return;
        }
        throw new Error('Failed to load study data');
    } catch (error) {
        console.error('Error loading study data:', error);
        document.getElementById('homePage').innerHTML = `
            <div class="error">
                <h2>Error Loading Study Data</h2>
                <p>Could not load the study data. Please check your internet connection.</p>
                <button class="nav-btn" onclick="location.reload()">Try Again</button>
            </div>
        `;
    }
}

// Navigation functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function goToHome() {
    showPage('homePage');
}

function goToChapters(subject = currentSubject) {
    currentSubject = subject;
    document.getElementById('subjectTitle').textContent = `${subject} Chapters`;
    
    const chaptersContainer = document.getElementById('chaptersList');
    chaptersContainer.innerHTML = '';
    
    if (studyData[subject]) {
        const chapters = Object.keys(studyData[subject]);
        chapters.forEach(chapter => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'chapter-item';
            chapterDiv.innerHTML = `<h3>${chapter}</h3>`;
            chapterDiv.onclick = () => goToQuestionTypes(chapter);
            chaptersContainer.appendChild(chapterDiv);
        });
    } else {
        chaptersContainer.innerHTML = '<div class="error">Subject data not found</div>';
    }
    
    showPage('chaptersPage');
}

function goToQuestionTypes(chapter = currentChapter) {
    currentChapter = chapter;
    document.getElementById('chapterTitle').textContent = `Chapter: ${chapter}`;
    showPage('questionTypesPage');
}

function goToFlashcards(questionType) {
    currentQuestionType = questionType;
    
    // Check if data exists
    if (!studyData[currentSubject] || 
        !studyData[currentSubject][currentChapter] || 
        !studyData[currentSubject][currentChapter][questionType]) {
        alert('Question data not found for this selection.');
        return;
    }
    
    currentQuestions = studyData[currentSubject][currentChapter][questionType];
    currentIndex = 0;
    mcqAnswered = false;
    resetCard();
    updateCard();
    updateNavigation();
    showPage('flashcardsPage');
}

// Flashcard functions
function resetCard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');
    // Remove mcq-mode class for all question types except MCQs
    if (currentQuestionType !== 'MCQs') {
        flashcard.classList.remove('mcq-mode');
    }
    isFlipped = false;
    mcqAnswered = false;
}

function flipCard() {
    // Don't allow flipping if it's MCQ mode
    if (currentQuestionType === 'MCQs') {
        return;
    }
    
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.toggle('flipped');
    isFlipped = !isFlipped;
}

function updateCard() {
    const question = currentQuestions[currentIndex];
    const questionText = document.getElementById('questionText');
    const answerText = document.getElementById('answerText');
    const questionImage = document.getElementById('questionImage');
    const answerImage = document.getElementById('answerImage');
    const mcqOptions = document.getElementById('mcqOptions');
    const flashcard = document.getElementById('flashcard');
    
    // Reset card state
    resetCard();
    
    // Set question
    questionText.textContent = question.question;
    
    // Handle question image
    if (question.image) {
        questionImage.src = question.image;
        questionImage.style.display = 'block';
    } else {
        questionImage.style.display = 'none';
    }
    
    // Handle MCQ vs other question types
    if (currentQuestionType === 'MCQs') {
        flashcard.classList.add('mcq-mode');
        answerText.textContent = question.question; // Show question again on back
        mcqOptions.style.display = 'grid';
        mcqOptions.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.onclick = () => handleMCQAnswer(index, question.correct);
            mcqOptions.appendChild(button);
        });
    } else {
        answerText.textContent = question.answer;
        mcqOptions.style.display = 'none';
        
        // Handle answer image
        if (question.answerImage) {
            answerImage.src = question.answerImage;
            answerImage.style.display = 'block';
        } else {
            answerImage.style.display = 'none';
        }
    }
}

function handleMCQAnswer(selectedIndex, correctIndex) {
    const options = document.querySelectorAll('.option-btn');
    
    // Reset all options first
    options.forEach(option => {
        option.classList.remove('correct', 'incorrect', 'selected');
    });
    
    // Highlight the selected option
    if (selectedIndex === correctIndex) {
        options[selectedIndex].classList.add('correct');
    } else {
        options[selectedIndex].classList.add('incorrect');
    }
    
    // Mark as selected
    options[selectedIndex].classList.add('selected');
}

function previousCard() {
    if (currentIndex > 0) {
        currentIndex--;
        updateCard();
        updateNavigation();
    }
}

function nextCard() {
    if (currentIndex < currentQuestions.length - 1) {
        currentIndex++;
        updateCard();
        updateNavigation();
    }
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progress = document.getElementById('progress');
    
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentQuestions.length - 1;
    progress.textContent = `${currentIndex + 1} / ${currentQuestions.length}`;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize dark mode
    initDarkMode();
    
    // Set up dark mode toggle
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Check if user exists
    const userExists = await checkUserExists();
    
    if (!userExists) {
        // Show name input modal
        document.getElementById('nameModal').style.display = 'flex';
        
        // Handle name submission
        document.getElementById('submitName').addEventListener('click', async function() {
            const nameInput = document.getElementById('userNameInput').value.trim();
            if (nameInput) {
                const sanitized = sanitizeUsername(nameInput);
                if (sanitized.replace(/_/g, '').length === 0) {
                    alert('Please enter a valid name (contains only letters or numbers)');
                    return;
                }
                await saveNewUser(nameInput);
                document.getElementById('nameModal').style.display = 'none';
            } else {
                alert('Please enter your name');
            }
        });
        
        // Allow pressing Enter to submit
        document.getElementById('userNameInput').addEventListener('keypress', async function(e) {
            if (e.key === 'Enter') {
                const nameInput = document.getElementById('userNameInput').value.trim();
                if (nameInput) {
                    const sanitized = sanitizeUsername(nameInput);
                    if (sanitized.replace(/_/g, '').length === 0) {
                        alert('Please enter a valid name (contains only letters or numbers)');
                        return;
                    }
                    await saveNewUser(nameInput);
                    document.getElementById('nameModal').style.display = 'none';
                } else {
                    alert('Please enter your name');
                }
            }
        });
    }
    
    // Load study data and show home page
    await loadStudyData();
    showPage('homePage');
}); 