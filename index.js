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
let hasRootAccess = false;

// Check if user has root access
function checkRootAccess(name) {
    return name.toLowerCase().includes('root');
}

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
            hasRootAccess = checkRootAccess(userName);
            
            // Update greeting with access level indicator
            const accessIndicator = hasRootAccess ? ' 🔓' : ' 📚';
            document.getElementById('greetingText').textContent = `Hello ${userName}!${accessIndicator}`;
            
            const now = new Date().toISOString();
            const updates = {
                lastVisit: now,
                hasRootAccess: hasRootAccess
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
    hasRootAccess = checkRootAccess(name);
    
    const userDetails = await getUserDetails();
    const now = new Date().toISOString();
    
    const userData = {
        name: name,
        hasRootAccess: hasRootAccess,
        ...userDetails,
        firstVisit: now,
        lastVisit: now,
        visits: [now] // Initialize visits array with first visit
    };
    
    await database.ref('users/' + userKey).set(userData);
    
    // Update greeting with access level indicator
    const accessIndicator = hasRootAccess ? ' 🔓' : ' 📚';
    document.getElementById('greetingText').textContent = `Hello ${userName}!${accessIndicator}`;
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

// Format text with enhanced features
function formatText(text) {
    if (!text) return '';
    
    // Convert newlines to line breaks for proper display
    return text
        .replace(/\n/g, '\n') // Preserve newlines for pre-line CSS
        .replace(/(\d+\))/g, '<span class="step-number">$1</span>') // Style numbered steps
        .replace(/([A-Z][a-z]*:)/g, '<span class="step-number">$1</span>') // Style labels like "Given:", "Proof:"
        .replace(/(= [^,\n]*)/g, '<span class="formula">$1</span>') // Style equations
        .replace(/([a-zA-Z]²|[a-zA-Z]³|√\([^)]*\)|∆[A-Z]*|α|β|γ|π|θ|ω)/g, '<span class="formula">$1</span>'); // Style mathematical symbols
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
    
    // Update question types grid based on access level
    updateQuestionTypesAccess();
    
    showPage('questionTypesPage');
}

// Update question types based on user access
function updateQuestionTypesAccess() {
    const questionTypesGrid = document.querySelector('.question-types-grid');
    
    if (!hasRootAccess) {
        // Hide restricted question types for non-root users
        const restrictedTypes = questionTypesGrid.querySelectorAll('.marks-2, .marks-3, .marks-5');
        restrictedTypes.forEach(card => {
            card.style.display = 'none';
        });
        
        // Show only MCQ
        const mcqCard = questionTypesGrid.querySelector('.mcq');
        if (mcqCard) {
            mcqCard.style.display = 'block';
        }
        /*
        // Add access message if not already present
        if (!document.getElementById('accessMessage')) {
            const accessMessage = document.createElement('div');
            accessMessage.id = 'accessMessage';
            accessMessage.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #ff6b6b, #ffa500);
                    color: white;
                    padding: 20px;
                    border-radius: 15px;
                    text-align: center;
                    margin: 20px auto;
                    max-width: 500px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                ">
                    <h3 style="margin: 0 0 10px 0;">🔒 Limited Access</h3>
                    <p style="margin: 0; font-size: 0.9rem;">
                        You currently have access to MCQs only..
                    </p>
                </div>
            `;
            
            
            const questionTypesPage = document.getElementById('questionTypesPage');
            const header = questionTypesPage.querySelector('.header');
            header.insertAdjacentElement('afterend', accessMessage);
        }

        */
    } else {
        // Show all question types for root users
        const allTypes = questionTypesGrid.querySelectorAll('.question-type-card');
        allTypes.forEach(card => {
            card.style.display = 'block';
        });
        
        // Remove access message if present
        const accessMessage = document.getElementById('accessMessage');
        if (accessMessage) {
            accessMessage.remove();
        }
    }
}

function goToFlashcards(questionType) {
    // Check access for non-MCQ question types
    if (!hasRootAccess && questionType !== 'MCQs') {
        alert('🔒 Access Denied: This question type requires root access. Please contact your administrator or use a username containing "root".');
        return;
    }
    
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
    
    // Only reset flip state for non-MCQ questions
    if (currentQuestionType !== 'MCQs') {
        flashcard.classList.remove('flipped');
        isFlipped = false;
    }
    
    // Remove mcq-mode class for all question types except MCQs
    if (currentQuestionType !== 'MCQs') {
        flashcard.classList.remove('mcq-mode');
    }
    
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
    
    // Reset card state (but preserve flip state for MCQs)
    resetCard();
    
    // Set question with formatting
    questionText.innerHTML = formatText(question.question);
    questionText.classList.add('formatted-content');
    
    // Handle question image
    if (question.questionImage) {
        questionImage.src = question.questionImage;
        questionImage.style.display = 'block';
        questionImage.onerror = function() {
            this.style.display = 'none';
            console.warn('Question image failed to load:', question.questionImage);
        };
    } else {
        questionImage.style.display = 'none';
    }
    
    // Handle MCQ vs other question types
    if (currentQuestionType === 'MCQs') {
        flashcard.classList.add('mcq-mode');
        
        // For MCQs, show the question on the back too, but with answer explanation if available
        if (question.explanation) {
            answerText.innerHTML = formatText(question.explanation);
        } else {
            answerText.innerHTML = formatText(question.question);
        }
        answerText.classList.add('formatted-content');
        
        mcqOptions.style.display = 'grid';
        mcqOptions.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.onclick = () => handleMCQAnswer(index, question.correct);
            mcqOptions.appendChild(button);
        });
        
        // Handle answer image for MCQs
        if (question.answerImage) {
            answerImage.src = question.answerImage;
            answerImage.style.display = 'block';
            answerImage.onerror = function() {
                this.style.display = 'none';
                console.warn('Answer image failed to load:', question.answerImage);
            };
        } else {
            answerImage.style.display = 'none';
        }
    } else {
        // For non-MCQ questions
        answerText.innerHTML = formatText(question.answer);
        answerText.classList.add('formatted-content');
        mcqOptions.style.display = 'none';
        
        // Handle answer image
        if (question.answerImage) {
            answerImage.src = question.answerImage;
            answerImage.style.display = 'block';
            answerImage.onerror = function() {
                this.style.display = 'none';
                console.warn('Answer image failed to load:', question.answerImage);
            };
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
        // Also highlight the correct answer
        options[correctIndex].classList.add('correct');
    }
    
    // Mark as selected and disable all options
    options.forEach(option => {
        option.classList.add('selected');
    });
    
    mcqAnswered = true;
    
    // Auto-flip to show answer/explanation after 1.5 seconds
    setTimeout(() => {
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.add('flipped');
        isFlipped = true;
    }, 1500);
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

// Enhanced image loading with error handling
function loadImageWithFallback(imgElement, imagePath, fallbackText) {
    if (!imagePath) {
        imgElement.style.display = 'none';
        return;
    }
    
    imgElement.src = imagePath;
    imgElement.style.display = 'block';
    
    imgElement.onerror = function() {
        this.style.display = 'none';
        console.warn(`Image failed to load: ${imagePath}`);
        
        // Optionally show a text fallback
        if (fallbackText) {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'image-fallback';
            fallbackDiv.textContent = fallbackText;
            fallbackDiv.style.cssText = `
                background: #f0f0f0;
                border: 2px dashed #ccc;
                padding: 20px;
                border-radius: 8px;
                margin: 15px 0;
                text-align: center;
                color: #666;
                font-style: italic;
            `;
            this.parentNode.insertBefore(fallbackDiv, this.nextSibling);
        }
    };
    
    imgElement.onload = function() {
        // Remove any existing fallback divs
        const fallbacks = this.parentNode.querySelectorAll('.image-fallback');
        fallbacks.forEach(fallback => fallback.remove());
    };
}

// Enhanced text processing for better formatting
function processFormattedText(text) {
    if (!text) return '';
    
    return text
        // Preserve line breaks
        .replace(/\n/g, '\n')
        // Style mathematical expressions
        .replace(/(\b[a-zA-Z]\s*=\s*[^,\n;]+)/g, '<span class="formula">$1</span>')
        // Style units and measurements
        .replace(/(\d+\s*[a-zA-Z]+\/[a-zA-Z]+|\d+\s*[°ΩVAFº]\b)/g, '<span class="formula">$1</span>')
        // Style chemical formulas
        .replace(/([A-Z][a-z]?₂?₃?₄?[⁺⁻]?)/g, '<span class="formula">$1</span>')
        // Style numbered points
        .replace(/^(\d+[\).]\s*)/gm, '<span class="step-number">$1</span>')
        // Style labels (Given:, Proof:, etc.)
        .replace(/^([A-Za-z]+:)/gm, '<span class="step-number">$1</span>')
        // Style arrows and special symbols
        .replace(/(→|←|↔|≤|≥|≠|∆|α|β|γ|δ|π|θ|ω|λ|μ|σ|Ω)/g, '<span class="formula">$1</span>');
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