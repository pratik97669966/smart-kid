import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// --- EXPOSE FIREBASE FUNCTIONS GLOBALLY ---
window.getAuth = getAuth;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.signOut = signOut;

// Realtime Database Functions
window.ref = ref;
window.set = set;
window.get = get;
window.update = update;

// --- USER-PROVIDED CONFIG (PLACEHOLDERS) ---
// Configuration provided by the user
const firebaseConfig = {
    apiKey: "AIzaSyCaJX0lmumC-6J-iTHVB_PRe50Ww8oWp_g",
    authDomain: "smart-kid-balgram.firebaseapp.com",
    databaseURL: "https://smart-kid-balgram-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-kid-balgram",
    storageBucket: "smart-kid-balgram.firebasestorage.app",
    messagingSenderId: "340279199689",
    appId: "1:340279199689:web:8d45a29b1ea87f3869ca18",
    measurementId: "G-W402LPG44J"
};

// Use environment variables if available, otherwise use defaults
window.initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// Use the project ID as a fallback app ID
window.appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId || 'default-smart-kid-app';

if (firebaseConfig) {
    window.app = initializeApp(firebaseConfig);
    window.auth = getAuth(window.app);
    window.db = getDatabase(window.app);
    window.googleProvider = new GoogleAuthProvider();

    // 1. Initial Authentication Logic
    onAuthStateChanged(window.auth, async (user) => {
        const splash = document.getElementById('splash');
        const mainApp = document.getElementById('main-app-container');

        if (user) {
            window.userId = user.uid;
            await checkOrCreateUserProfile(user);
        } else {
            try {
                // Try to sign in with custom token if provided
                if (window.initialAuthToken) {
                    await signInWithCustomToken(window.auth, window.initialAuthToken);
                    // NOTE: Audio unlock must happen on a user gesture,
                    // which is now handled by a global click listener in initApp()
                }
            } catch (error) {
                console.error("Firebase Auth Custom Token Error (Proceeding to Login Screen):", error);
            }
        }

        // IMPROVED: Smoothly fade out splash then reveal app.
        if (splash) {
            // Add class to trigger CSS opacity transition
            splash.classList.add('splash-hidden');

            // After CSS transition completes, hide the splash element and show main app
            const FADE_MS = 500; // should match .splash-hidden transition duration
            setTimeout(() => {
                if (splash) splash.classList.add('hidden'); // remove from layout flow
                if (mainApp) mainApp.classList.remove('hidden');
                // Call the main app initialization function
                if (typeof window.initApp === 'function') {
                    window.initApp();
                }
            }, FADE_MS + 40); // slight safety offset
        } else {
            if (mainApp) mainApp.classList.remove('hidden');
            if (typeof window.initApp === 'function') {
                window.initApp();
            }
        }
    });

} else {
    console.error("Firebase configuration not found.");
}


// --- GLOBAL STATE AND CONFIGURATION ---
const API_URL_TRIVIA = 'https://opentdb.com/api.php';

let currentView = 'dashboard';
let viewHistory = []; // Store history for back navigation
let currentUser = null;
let userProfile = null;
let quizSession = null; // Holds current or last completed quiz session data
let currentLanguage = 'mr';
let isAudioUnlocked = false; // --- NEW: Flag to track audio context status ---
let isAudioEnabled = true; // --- NEW: Global audio toggle ---

// UPDATED: Replaced single boolean with an object
let premiumStatus = {
    isWeeklyPaid: false,
    isScholarshipPaid: false,
    isNavodayaPaid: false
};

// NEW: Store current exam context
let currentExamType = null;
let currentSubject = null;

// Subject Definitions: Added a 'standards' array to control visibility
const SUBJECTS_DATA = [
    // Standard: 5th-7th focus on basics and GK
    { name: 'General Science', emoji: '🔬', color: 'bg-green-500', categoryId: 17, standards: [5, 6, 7, 8, 9, 10] },
    { name: 'Basic Math', emoji: '➕', color: 'bg-red-500', categoryId: 19, standards: [5, 6, 7] },
    { name: 'Geography', emoji: '🌍', color: 'bg-amber-500', categoryId: 22, standards: [5, 6, 7, 8] },
    { name: 'General Knowledge', emoji: '💡', color: 'bg-purple-500', categoryId: 9, standards: [5, 6, 7, 8, 9, 10] },

    // Standard: 8th-10th focus on history, advanced science/math
    { name: 'Advanced Math', emoji: '📐', color: 'bg-red-700', categoryId: 19, standards: [8, 9, 10] },
    { name: 'History (India)', emoji: '🏛️', color: 'bg-blue-500', categoryId: 23, standards: [8, 9, 10] },
    { name: 'Computers', emoji: '💻', color: 'bg-cyan-500', categoryId: 18, standards: [8, 9, 10] },
    { name: 'Sports', emoji: '⚽', color: 'bg-pink-500', categoryId: 21, standards: [5, 6, 7, 8, 9, 10] },
];

// NEW: Data for Practice Modes
const PRACTICE_DATA = {
    numbers: Array.from({ length: 100 }, (_, i) => String(i + 1)), // Ensure strings for TTS
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    mr: ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः', 'ऋ', 'ऌ', 'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'ळ', 'क्ष', 'ज्ञ'],
    hi: ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'अं', 'अः', 'ऋ', 'क', 'ख', 'ग', 'घ', 'ङ', 'च', 'छ', 'ज', 'झ', 'ञ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'क्ष', 'त्र', 'ज्ञ']
};
let currentPracticeIndex = 0;
let currentPracticeType = null; // 'numbers', 'alphabet', 'math'
let currentMathProblem = null; // --- NEW: Store current math problem ---

// NEW: Language map for Text-to-Speech
const TTS_LANG_MAP = {
    en: 'en-US',
    mr: 'mr-IN',
    hi: 'hi-IN'
};


const TRIVIA_CATEGORIES = SUBJECTS_DATA.reduce((acc, s) => {
    acc[s.name] = s.categoryId;
    return acc;
}, {});

const DIFFICULTIES = {
    'easy': { label: { en: 'Easy', mr: 'सोपे', hi: 'आसान' }, emoji: '👶', color: 'bg-emerald-500' },
    'medium': { label: { en: 'Medium', mr: 'मध्यम', hi: 'मध्यम' }, emoji: '🧑', color: 'bg-yellow-500' },
    'hard': { label: { en: 'Hard', mr: 'कठीण', hi: 'कठिन' }, emoji: '🧠', color: 'bg-red-500' }
};

// Localization Texts (Expanded)
const TEXTS = {
    'login-welcome': { en: 'Welcome to Gamat Shala!', mr: 'गंमत शाळेमध्ये आपले स्वागत आहे.!', hi: 'गंमत शाला में आपका स्वागत है!' },
    'login-tagline': { en: 'Learn like you play a game!', mr: 'खेळासारखे शिका!', hi: 'खेल की तरह सीखें!' },
    'google-sign-in-text': { en: 'Sign in with Google', mr: 'गुगलने साइन इन करा', hi: 'Google से साइन इन करें' },
    'setup-title': { en: 'Profile Setup', mr: 'प्रोफाइल सेटअप', hi: 'प्रोफ़ाइल सेट करें' },
    'setup-tagline': { en: 'Tell us about yourself to tailor your content.', mr: 'सामग्री जुळवण्यासाठी आपल्याबद्दल सांगा.', hi: 'सामग्री अनुकूलित करने के लिए अपने बारे में बताएं।' },
    'label-age': { en: 'Age (वय)', mr: 'वय (Age)', hi: 'आयु (Age)' },
    'label-standard': { en: 'Standard (इयत्ता)', mr: 'इयत्ता (Standard)', hi: 'कक्षा (Standard)' },
    'label-medium': { en: 'Medium (माध्यम)', mr: 'माध्यम (Medium)', hi: 'माध्यम (Medium)' },
    'label-school': { en: 'School Name (शाळेचे नाव)', mr: 'शाळेचे नाव (School Name)', hi: 'विद्यालय का नाम (School Name)' },
    'save-profile-text': { en: 'Save Profile & Start', mr: 'प्रोफाइल जतन करा आणि सुरू करा', hi: 'प्रोफ़ाइल सहेजें और शुरू करें' },
    'nav-dashboard-text': { en: 'Dashboard', mr: 'डॅशबोर्ड', hi: 'डैशबोर्ड' },
    'nav-leaderboard-text': { en: 'Leaderboard', mr: 'लीडरबोर्ड', hi: 'लीडरबोर्ड' },
    'nav-history-text': { en: 'History', mr: 'इतिहास', hi: 'इतिहास' },
    'nav-profile-text': { en: 'Profile', mr: 'प्रोफाइल', hi: 'प्रोफ़ाइल' },
    'welcome-greeting': { en: 'Hello, Scholar!', mr: 'नमस्ते, विद्वाना!', hi: 'नमस्ते, विद्वान!' },

    // NEW/UPDATED Texts
    'exam-type-heading': { en: 'Select Exam Type', mr: 'परीक्षेचा प्रकार निवडा', hi: 'परीक्षा का प्रकार चुनें' },
    'exam-regular': { en: 'Regular Quiz', mr: 'नियमित क्विझ', hi: 'नियमित प्रश्नोत्तरी' },
    'exam-scholarship': { en: 'Scholarship Exam', mr: 'शिष्यवृत्ती परीक्षा', hi: 'छात्रवृत्ति परीक्षा' },
    'exam-navodaya': { en: 'Navodaya Exam', mr: 'नवोदय परीक्षा', hi: 'नवोदय परीक्षा' },
    'exam-practice-numbers': { en: 'Practice 123', mr: 'सराव १२३', hi: 'अभ्यास १२३' },
    'exam-practice-alphabet': { en: 'Practice ABC', mr: 'सराव अक', hi: 'अभ्यास कखग' },
    'exam-practice-math': { en: 'Math Lab', mr: 'गणित लॅब', hi: 'गणित प्रयोगशाला' }, // --- NEW ---

    'premium-locked': { en: 'Premium 🔒', mr: 'प्रीमियम 🔒', hi: 'प्रीमियम 🔒' },
    'subject-selection-title': { en: 'Select Subject', mr: 'विषय निवडा', hi: 'विषय चुनें' },
    'paper-selection-title': { en: 'Select Question Paper', mr: 'प्रश्नपत्रिका निवडा', hi: 'प्रश्न पत्र चुनें' },
    'no-subjects-found': { en: 'No subjects found for your standard in this category.', mr: 'या वर्गात तुमच्या इयत्तेसाठी कोणतेही विषय आढळले नाहीत.', hi: 'इस श्रेणी में आपकी कक्षा के लिए कोई विषय नहीं मिला।' },
    'no-papers-found': { en: 'No papers found for this subject.', mr: 'या विषयासाठी कोणतेही पेपर आढळले नाहीत.', hi: 'इस विषय के लिए कोई पेपर नहीं मिला।' },
    'subjects-heading': { en: 'Choose Your Subject:', mr: 'तुमचा विषय निवडा:', hi: 'अपना विषय चुनें:' }, // Kept for regular quiz

    'stage-selection-title': { en: 'Select Difficulty', mr: 'कठीण पातळी निवडा', hi: 'कठिनाई स्तर चुनें' },
    'stage-selection-subtitle': { en: 'Higher difficulty means higher score points!', mr: 'जास्त कठिण म्हणजे जास्त गुण!', hi: 'अधिक कठिनाई का अर्थ है अधिक अंक!' },
    'next-btn-text': { en: 'Next Question', mr: 'पुढचा प्रश्न', hi: 'अगला प्रश्न' },
    'result-title-success': { en: 'Fantastic Job!', mr: 'अप्रतिम काम!', hi: 'शानदार काम!' },
    'result-title-fail': { en: 'Good Effort!', mr: 'चांगला प्रयत्न!', hi: 'अच्छा प्रयास!' },
    'result-tagline': { en: 'You earned {score} points!', mr: 'तुम्ही {score} गुण मिळवले!', hi: 'आपने {score} अंक अर्जित किए!' },
    'result-details': { en: 'Solved: {solved}/{total} | Correct: {correct}', mr: 'सोडवले: {solved}/{total} | बरोबर: {correct}', hi: 'हल किए गए: {solved}/{total} | सही: {correct}' },
    'review-btn-text': { en: 'Review Answers', mr: 'उत्तरांचे पुनरावलोकन करा', hi: 'उत्तरों की समीक्षा करें' },
    'dashboard-btn-text': { en: 'Go to Dashboard', mr: 'डॅशबोर्डवर जा', hi: 'डैशबोर्ड पर जाएं' },
    'close-review-text': { en: 'Back to Results', mr: 'निकालांवर परत', hi: 'परिणामों पर वापस' },
    'back-to-history-text': { en: 'Back to History', mr: 'इतिहासावर परत', hi: 'इतिहास पर वापस' },
    'profile-page-title': { en: 'Your Profile', mr: 'तुमची प्रोफाइल', hi: 'आपकी प्रोफ़ाइल' },
    'sign-out-text': { en: 'Sign Out', mr: 'साइन आउट करा', hi: 'साइन आउट करें' },

    // Weekly Test Texts
    'test-card-title': { en: 'Weekly Scholar Test', mr: 'साप्ताहिक स्कॉलर चाचणी', hi: 'साप्ताहिक स्कॉलर टेस्ट' },
    'test-card-status-inactive': { en: 'Next test: Sunday!', mr: 'पुढची चाचणी: रविवार!', hi: 'अगला टेस्ट: रविवार!' },
    'test-card-status-active': { en: 'Test is Live! Click to Start.', mr: 'चाचणी लाईव्ह आहे! सुरू करण्यासाठी क्लिक करा.', hi: 'टेस्ट लाइव है! शुरू करने के लिए क्लिक करें.' },
    'test-card-status-paid': { en: 'Weekly Test: UNLOCKED! ✅', mr: 'साप्ताहिक चाचणी: अनलॉक झाली! ✅', hi: 'साप्ताहिक टेस्ट: अनलॉक! ✅' },
    'test-card-status-pay': { en: 'Unlock the Weekly Test!', mr: 'साप्ताहिक चाचणी अनलॉक करा!', hi: 'साप्ताहिक टेस्ट अनलॉक करें!' },
    'test-card-btn-start': { en: 'START TEST', mr: 'चाचणी सुरू करा', hi: 'टेस्ट शुरू करें' },
    'test-card-btn-pay': { en: 'UNLOCK NOW', mr: 'आता अनलॉक करा', hi: 'अभी अनलॉक करें' },

    'leaderboard-title': { en: 'Global Top Scorers 🏆', mr: 'जागतिक टॉप स्कोअरर्स 🏆', hi: 'वैश्विक टॉप स्कोरर 🏆' },
    'history-title': { en: 'My Quiz History 📜', mr: 'माझा क्विझ इतिहास 📜', hi: 'मेरा क्विज़ इतिहास 📜' },
    'history-loading': { en: 'Loading history...', mr: 'इतिहास लोड होत आहे...', hi: 'इतिहास लोड हो रहा है...' },
    'leaderboard-loading': { en: 'Loading leaderboard...', mr: 'लीडरबोर्ड लोड होत आहे...', hi: 'लीडरबोर्ड लोड हो रहा है...' },
    'question-loading': { en: 'Fetching Questions...', mr: 'प्रश्न आणले जात आहेत...', hi: 'प्रश्न प्राप्त किए जा रहे हैं...' },
    'question-generating-error': { en: 'Could not fetch questions. Try again.', mr: 'प्रश्न मिळू शकले नाही. पुन्हा प्रयत्न करा.', hi: 'प्रश्न प्राप्त नहीं हो सके। पुनः प्रयास करें.' },

    // UPDATED Modal Texts for specific payments
    'modal-pay-weekly-title': { en: 'Unlock Weekly Test', mr: 'साप्ताहिक चाचणी अनलॉक करा', hi: 'साप्ताहिक टेस्ट अनलॉक करें' },
    'modal-pay-weekly-message': { en: 'Confirm payment of ₹9.00 (One-time fee) to unlock <b>ALL</b> future Weekly Tests permanently. (Razorpay Simulation)', mr: '<b>सर्व</b> भविष्यातील साप्ताहिक चाचण्या कायमस्वरूपी अनलॉक करण्यासाठी ₹९.०० (एक-वेळ शुल्क) पेमेंटची पुष्टी करा. (Razorpay अनुकरण)', hi: '<b>सभी</b> भावी साप्ताहिक टेस्ट को स्थायी रूप से अनलॉक करने के लिए ₹९.०० (एक बार का शुल्क) भुगतान की पुष्टि करें। (Razorpay सिमुलेशन)' },

    'modal-pay-scholarship-title': { en: 'Unlock Scholarship Exams', mr: 'शिष्यवृत्ती परीक्षा अनलॉक करा', hi: 'छात्रवृत्ति परीक्षा अनलॉक करें' },
    'modal-pay-scholarship-message': { en: 'Confirm payment of ₹9.00 (One-time fee) to unlock <b>ALL</b> Scholarship Exams permanently. (Razorpay Simulation)', mr: '<b>सर्व</b> शिष्यवृत्ती परीक्षा कायमस्वरूपी अनलॉक करण्यासाठी ₹९.०० (एक-वेळ शुल्क) पेमेंटची पुष्टी करा. (Razorpay अनुकरण)', hi: '<b>सभी</b> छात्रवृत्ति परीक्षाओं को स्थायी रूप से अनलॉक करने के लिए ₹९.०० (एक बार का शुल्क) भुगतान की पुष्टि करें। (Razorpay सिमुलेशन)' },

    'modal-pay-navodaya-title': { en: 'Unlock Navodaya Exams', mr: 'नवोदय परीक्षा अनलॉक करा', hi: 'नवोदय परीक्षा अनलॉक करें' },
    'modal-pay-navodaya-message': { en: 'Confirm payment of ₹9.00 (One-time fee) to unlock <b>ALL</b> Navodaya Exams permanently. (Razorpay Simulation)', mr: '<b>सर्व</b> नवोदय परीक्षा कायमस्वरूपी अनलॉक करण्यासाठी ₹९.०० (एक-वेळ शुल्क) पेमेंटची पुष्टी करा. (Razorpay अनुकरण)', hi: '<b>सभी</b> नवोदय परीक्षाओं को स्थायी रूप से अनलॉक करने के लिए ₹९.०० (एक बार का शुल्क) भुगतान की पुष्टि करें। (Razorpay सिमुलेशन)' },

    'review-explanation-text': { en: 'Correct Answer Explanation', mr: 'योग्य उत्तराचे स्पष्टीकरण', hi: 'सही उत्तर का स्पष्टीकरण' },

    // UPDATED Profile Status Texts
    'profile-weekly-paid': { en: 'Weekly Tests: UNLOCKED 🎉', mr: 'साप्ताहिक चाचण्या: अनलॉक 🎉', hi: 'साप्ताहिक टेस्ट: अनलॉक 🎉' },
    'profile-weekly-unpaid': { en: 'Weekly Tests: LOCKED 🔒', mr: 'साप्ताहिक चाचण्या: लॉक 🔒', hi: 'साप्ताहिक टेस्ट: लॉक 🔒' },
    'profile-scholarship-paid': { en: 'Scholarship Exams: UNLOCKED 🎉', mr: 'शिष्यवृत्ती परीक्षा: अनलॉक 🎉', hi: 'छात्रवृत्ति परीक्षा: अनलॉक 🎉' },
    'profile-scholarship-unpaid': { en: 'Scholarship Exams: LOCKED 🔒', mr: 'शिष्यवृत्ती परीक्षा: लॉक 🔒', hi: 'छात्रवृत्ति परीक्षा: लॉक 🔒' },
    'profile-navodaya-paid': { en: 'Navodaya Exams: UNLOCKED 🎉', mr: 'नवोदय परीक्षा: अनलॉक 🎉', hi: 'नवोदय परीक्षा: अनलॉक 🎉' },
    'profile-navodaya-unpaid': { en: 'Navodaya Exams: LOCKED 🔒', mr: 'नवोदय परीक्षा: लॉक 🔒', hi: 'नवोदय परीक्षा: लॉक 🔒' },

    'translation-note': { en: '(Question translated from English, content might be imprecise.)', mr: '(प्रश्न इंग्रजीतून अनुवादित, सामग्री अचूक नसू शकते.)', hi: '(प्रश्न अंग्रेजी से अनूदित, सामग्री अपriष्कृत हो सकती है।)' },

    // NEW: Practice View Texts
    'practice-number-title': { en: 'Practice Numbers', mr: 'सराव १२३', hi: 'अभ्यास १२३' },
    'practice-alphabet-title': { en: 'Practice Alphabet', mr: 'सराव अक', hi: 'अभ्यास कखग' },
    'practice-number-speak-text': { en: 'Listen', mr: 'ऐका', hi: 'सुनो' },
    'practice-alphabet-speak-text': { en: 'Listen', mr: 'ऐका', hi: 'सुनो' },
    'practice-number-nav-text': { en: 'Practice 1-100', mr: 'सराव १-१००', hi: 'अभ्यास १-१००' },
    'practice-alphabet-nav-text': { en: 'Practice Alphabet', mr: 'सराव वर्णमाला', hi: 'अभ्यास वर्णमाला' },

    // --- NEW: Math Lab Texts ---
    'practice-math-title': { en: 'Math Lab', mr: 'गणित लॅब', hi: 'गणित प्रयोगशाला' },
    'practice-math-speak-text': { en: 'Listen', mr: 'ऐका', hi: 'सुनो' },
    'audio-settings-title': { en: 'Audio Settings', mr: 'ऑडिओ सेटिंग्ज', hi: 'ऑडियो सेटिंग्स' },
    'enable-sound-effects': { en: 'Enable Sound Effects', mr: 'ध्वनी प्रभाव सक्षम करा', hi: 'ध्वनि प्रभाव सक्षम करें' },

    // --- NEW: Math Operator Texts for TTS ---
    'op-plus': { en: 'plus', mr: 'अधिक', hi: 'जमा' },
    'op-minus': { en: 'minus', mr: 'वजा', hi: 'घटा' },
    'op-times': { en: 'times', mr: 'गुणिले', hi: 'गुणा' },
    'op-divided-by': { en: 'divided by', mr: 'भागिले', hi: 'भाग' },

};

// --- AUDIO & UTILITY FUNCTIONS ---

// NEW: Global audio unlock function
const unlockAudio = async () => {
    if (isAudioUnlocked) return;
    try {
        await Tone.start();
        if (ttsSynth && !ttsSynth.speaking) {
            // Speak a silent utterance to unlock the synth
            const unlockSpeech = new SpeechSynthesisUtterance(' ');
            unlockSpeech.volume = 0;
            ttsSynth.speak(unlockSpeech);
        }
        isAudioUnlocked = true;
        console.log("Audio contexts unlocked.");
        // Remove the listener after it has succeeded
        document.body.removeEventListener('click', unlockAudio);
        document.body.removeEventListener('touchstart', unlockAudio);
    } catch (e) {
        console.warn("Audio context unlock failed (will try again on next interaction):", e);
    }
};

// Simple text simulation for localization (Open Trivia is English-only)
const simulateTranslation = (text) => {
    if (currentLanguage === 'en') return text;
    const baseText = text.length > 50 ? text.substring(0, 50) + '...' : text;
    if (currentLanguage === 'mr') {
        return `${baseText}`;
    } else if (currentLanguage === 'hi') {
        return `${baseText}`;
    }
    return text;
};

const decodeHtml = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

const L = (key) => TEXTS[key]?.[currentLanguage] || TEXTS[key]?.['en'] || key;

const localizeElements = () => {
    const elements = [
        'login-welcome', 'login-tagline', 'google-sign-in-text', 'setup-title', 'setup-tagline',
        'label-age', 'label-standard', 'label-medium', 'label-school', 'save-profile-text',
        'nav-dashboard-text', 'nav-leaderboard-text', 'nav-history-text', 'nav-profile-text',
        'exam-type-heading', 'stage-selection-title', 'stage-selection-subtitle',
        'subject-selection-title', 'paper-selection-title',
        'next-btn-text', 'review-btn-text', 'dashboard-btn-text',
        'profile-page-title', 'sign-out-text', 'leaderboard-title', 'history-title',
        'leaderboard-loading', 'history-loading', 'question-loading', 'translation-note',
        'practice-number-title', 'practice-alphabet-title',
        'practice-number-speak-text', 'practice-alphabet-speak-text',
        'practice-number-nav-text', 'practice-alphabet-nav-text',
        'practice-math-title', 'practice-math-speak-text', // --- NEW ---
        'audio-settings-title', 'enable-sound-effects' // --- NEW ---
    ];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = L(id);
    });

    if (userProfile) {
        document.getElementById('welcome-greeting').textContent = L('welcome-greeting');
        updateProfileUI();

        if (currentView === 'quiz-result' && quizSession) renderResultView();
        if (currentView === 'review' && quizSession) renderReviewView();
        if (currentView === 'dashboard') renderDashboard();
        if (currentView === 'practice-alphabet') {
            // Update nav text based on language
            document.getElementById('practice-alphabet-nav-text').textContent = L('practice-alphabet-nav-text');
        }
    }
};
// Tone.js Sound System
const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 },
}).toDestination();

const playSound = (type) => {
    if (!isAudioUnlocked || !isAudioEnabled) return; // --- MODIFIED: Check global toggle ---
    try {
        switch (type) {
            case 'correct':
                synth.triggerAttackRelease(['C5', 'E5', 'G5'], '8n');
                break;
            case 'wrong':
                synth.triggerAttackRelease('C4', '4n');
                break;
            case 'level_up':
                synth.triggerAttackRelease(['C5', 'G5', 'C6'], '2n', '+0.1');
                break;
        }
    } catch (e) {
        console.warn("Tone.js error:", e);
    }
};

// NEW: Text-to-Speech (TTS) Function
const ttsSynth = window.speechSynthesis;
const speak = (text, lang) => {
    if (!isAudioUnlocked || !isAudioEnabled) return; // --- MODIFIED: Check global toggle ---
    if (ttsSynth.speaking) {
        ttsSynth.cancel();
    }
    if (text !== '') {
        try {
            const utterThis = new SpeechSynthesisUtterance(text);
            utterThis.lang = lang || TTS_LANG_MAP[currentLanguage] || 'en-US';
            utterThis.rate = 0.8;
            utterThis.pitch = 1;
            ttsSynth.speak(utterThis);
        } catch (e) {
            console.error("Speech Synthesis Error:", e);
            showModal("Audio Error", "Could not play audio. Please ensure your browser supports speech synthesis.", false);
        }
    }
};

// NEW: Helper function for practice mode audio
const speakCurrentPracticeItem = () => {
    if (currentView !== 'practice-number' && currentView !== 'practice-alphabet') {
        return;
    }

    let item;
    if (currentPracticeType === 'numbers') {
        item = PRACTICE_DATA.numbers[currentPracticeIndex];
    } else {
        const data = PRACTICE_DATA[currentLanguage] || PRACTICE_DATA.en;
        item = data[currentPracticeIndex];
    }

    speak(item, TTS_LANG_MAP[currentLanguage]);
};

// Fetch with exponential backoff for rate limiting
const backoffFetch = async (url, options, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) { // Too Many Requests
                throw new Error("Rate limit exceeded");
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // 1s, 2s, 4s + jitter
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// --- FIREBASE AND AUTHENTICATION LOGIC ---

const signInWithGoogle = async () => {
    try {
        // Audio unlock is now handled by the global 'unlockAudio' function
        // on the first click, so we don't need it here.
        await window.signInWithPopup(window.auth, window.googleProvider);
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
            showModal('Error', error.message, false);
        }
    }
};

const signOutUser = async () => {
    try {
        await window.signOut(window.auth);
        location.reload(); // Easiest way to reset state
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
};

const checkOrCreateUserProfile = async (user) => {
    const userRef = ref(window.db, `artifacts/${window.appId}/users/${user.uid}/profile`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        userProfile = snapshot.val();
        let needsUpdate = false;

        // --- Migration logic for new payment booleans ---
        if (typeof userProfile.isWeeklyPaid === 'undefined') {
            // Check old boolean 'isTestPaid' for migration
            userProfile.isWeeklyPaid = userProfile.isTestPaid || false;
            needsUpdate = true;
        }
        if (typeof userProfile.isScholarshipPaid === 'undefined') {
            userProfile.isScholarshipPaid = userProfile.isTestPaid || false; // Migrate old users
            needsUpdate = true;
        }
        if (typeof userProfile.isNavodayaPaid === 'undefined') {
            userProfile.isNavodayaPaid = userProfile.isTestPaid || false; // Migrate old users
            needsUpdate = true;
        }

        if (needsUpdate) {
            // Clean up old 'isTestPaid' field if it exists
            const updates = {
                isWeeklyPaid: userProfile.isWeeklyPaid,
                isScholarshipPaid: userProfile.isScholarshipPaid,
                isNavodayaPaid: userProfile.isNavodayaPaid,
                isTestPaid: null // Remove the old field
            };
            await update(userRef, updates);
        }
        // --- End Migration ---

        // Check for core profile info
        if (!userProfile.standard || !userProfile.medium || !userProfile.schoolName) {
            currentUser = user;
            // Pre-fill form with existing data
            if (userProfile.age) document.getElementById('user-age').value = userProfile.age;
            if (userProfile.standard) document.getElementById('user-standard').value = userProfile.standard;
            if (userProfile.medium) document.getElementById('user-medium').value = userProfile.medium;
            if (userProfile.schoolName) document.getElementById('user-school').value = userProfile.schoolName;
            renderView('profile-setup');
        } else {
            currentUser = user;
            // Populate global premium status
            premiumStatus.isWeeklyPaid = userProfile.isWeeklyPaid;
            premiumStatus.isScholarshipPaid = userProfile.isScholarshipPaid;
            premiumStatus.isNavodayaPaid = userProfile.isNavodayaPaid;
            renderView('dashboard');
        }
    } else {
        currentUser = user;
        renderView('profile-setup');
    }
    updateProfileUI();
    checkWeeklyTestStatus();
};

const saveProfile = async (event) => {
    event.preventDefault();
    const age = document.getElementById('user-age').value;
    const standard = document.getElementById('user-standard').value;
    const medium = document.getElementById('user-medium').value;
    const schoolName = document.getElementById('user-school').value; // Get new value

    if (!age || !standard || !medium || !schoolName) return;

    const newProfile = {
        name: currentUser.displayName || 'Gamat Shala User',
        email: currentUser.email || 'N/A',
        photoURL: currentUser.photoURL || 'https://placehold.co/64x64/8b5cf6/ffffff?text=P',
        age: parseInt(age),
        standard: standard,
        medium: medium,
        schoolName: schoolName, // Save new value
        score: userProfile?.score || 0,
        // Initialize new payment fields
        isWeeklyPaid: userProfile?.isWeeklyPaid || false,
        isScholarshipPaid: userProfile?.isScholarshipPaid || false,
        isNavodayaPaid: userProfile?.isNavodayaPaid || false,
        lastUpdated: Date.now()
    };

    const profileRef = ref(window.db, `artifacts/${window.appId}/users/${currentUser.uid}/profile`);
    await set(profileRef, newProfile);
    userProfile = newProfile;

    // Update global state
    premiumStatus.isWeeklyPaid = userProfile.isWeeklyPaid;
    premiumStatus.isScholarshipPaid = userProfile.isScholarshipPaid;
    premiumStatus.isNavodayaPaid = userProfile.isNavodayaPaid;

    viewHistory = [];
    renderView('dashboard');
};

const updateProfileUI = () => {
    if (userProfile) {
        document.getElementById('dashboard-user-name').textContent = userProfile.name;
        document.getElementById('dashboard-profile-img').src = userProfile.photoURL;
        document.getElementById('dashboard-user-score').textContent = userProfile.score || 0;

        document.getElementById('profile-page-img').src = userProfile.photoURL;
        document.getElementById('profile-user-name').textContent = userProfile.name;
        document.getElementById('profile-user-id').textContent = `User ID: ${window.userId}`;

        // Display new School Name
        document.getElementById('profile-school').innerHTML = `<span class="font-semibold">${L('label-school')}:</span> ${userProfile.schoolName || 'N/A'}`;
        document.getElementById('profile-standard').innerHTML = `<span class="font-semibold">${L('label-standard')}:</span> ${userProfile.standard}th`;
        document.getElementById('profile-medium').innerHTML = `<span class="font-semibold">${L('label-medium')}:</span> ${userProfile.medium}`;

        // Update all three premium statuses
        const weeklyStatusEl = document.getElementById('profile-weekly-status');
        const scholarshipStatusEl = document.getElementById('profile-scholarship-status');
        const navodayaStatusEl = document.getElementById('profile-navodaya-status');

        weeklyStatusEl.textContent = userProfile.isWeeklyPaid ? L('profile-weekly-paid') : L('profile-weekly-unpaid');
        weeklyStatusEl.className = `text-sm text-center font-medium ${userProfile.isWeeklyPaid ? 'text-emerald-600' : 'text-red-600'}`;

        scholarshipStatusEl.textContent = userProfile.isScholarshipPaid ? L('profile-scholarship-paid') : L('profile-scholarship-unpaid');
        scholarshipStatusEl.className = `text-sm text-center font-medium ${userProfile.isScholarshipPaid ? 'text-emerald-600' : 'text-red-600'}`;

        navodayaStatusEl.textContent = userProfile.isNavodayaPaid ? L('profile-navodaya-paid') : L('profile-navodaya-unpaid');
        navodayaStatusEl.className = `text-sm text-center font-medium ${userProfile.isNavodayaPaid ? 'text-emerald-600' : 'text-red-600'}`;

        // --- NEW: Update Audio Toggle ---
        const audioToggle = document.getElementById('audio-toggle');
        audioToggle.setAttribute('aria-checked', isAudioEnabled);

    }
};

const saveQuizHistory = async (session) => {
    if (!window.userId) {
        console.error("saveQuizHistory: No user ID. Cannot save.");
        return;
    }
    try {
        const historyRef = ref(window.db, `artifacts/${window.appId}/users/${window.userId}/history/${Date.now()}`);
        await set(historyRef, session);

        const newScore = (userProfile.score || 0) + session.score;
        const userScoreRef = ref(window.db, `artifacts/${window.appId}/users/${window.userId}/profile`);
        await update(userScoreRef, { score: newScore });

        userProfile.score = newScore;
        updateProfileUI();
    } catch (error) {
        console.error("Firebase saveQuizHistory Error:", error);
        showModal('Save Error', 'Could not save your quiz result. Please check your internet connection.', false);
    }
};

// --- OPEN TRIVIA API & TRANSLATION LOGIC ---

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const fetchQuizQuestions = async (subject, difficulty, count = 10) => {
    const categoryId = TRIVIA_CATEGORIES[subject] || 9;
    const diffParam = difficulty === 'hard' ? 'hard' : difficulty === 'medium' ? 'medium' : 'easy';
    const url = `${API_URL_TRIVIA}?amount=${count}&category=${categoryId}&difficulty=${diffParam}&type=multiple`;

    const questionContainer = document.getElementById('quiz-question-text');
    const optionsContainer = document.getElementById('quiz-options-container');

    questionContainer.innerHTML = `<div class="flex items-center justify-center space-x-2"><div class="loader" style="border-top-color: var(--primary);"></div><p class="text-gray-500">${L('question-loading')}</p></div>`;
    optionsContainer.innerHTML = '';

    try {
        const responseData = await backoffFetch(url);
        if (responseData.response_code !== 0) {
            throw new Error(`Trivia API Error Code: ${responseData.response_code}`);
        }
        const questions = responseData.results.map(q => {
            const incorrect = q.incorrect_answers.map(decodeHtml);
            const correct = decodeHtml(q.correct_answer);
            let allOptions = [...incorrect, correct];
            allOptions = shuffleArray(allOptions); // Shuffle options
            const correctIndex = allOptions.findIndex(opt => opt === correct);

            // --- SCORING CHANGE: All questions are worth 1 point ---
            let scoreValue = 1;
            // --- END SCORING CHANGE ---

            const q_en = decodeHtml(q.question);
            const expl_en = `The correct answer is "${correct}" (Topic: ${q.category}).`;
            const opts_en = allOptions;

            return {
                question_en: q_en,
                question_mr: simulateTranslation(q_en),
                question_hi: simulateTranslation(q_en),
                options_en: opts_en,
                options_mr: opts_en.map(simulateTranslation),
                options_hi: opts_en.map(simulateTranslation),
                correct_answer_index: correctIndex,
                explanation_en: expl_en,
                explanation_mr: simulateTranslation(expl_en),
                explanation_hi: simulateTranslation(expl_en),
                attempted: false,
                userAnswer: -1,
                scoreValue: scoreValue // Set score to 1
            };
        });
        return questions;
    } catch (error) {
        console.error("Trivia API Fetch Error:", error);
        questionContainer.textContent = L('question-generating-error');
        showModal('API Error', L('question-generating-error'), false);
        return null;
    }
};


// --- GAME LOGIC ---

// (OTDB)
const startQuiz = async (subject, difficulty, isTest = false) => {
    currentExamType = 'regular';
    currentSubject = subject;

    const questionData = await fetchQuizQuestions(subject, difficulty, isTest ? 15 : 10);
    if (!questionData || questionData.length === 0) {
        goBack();
        return;
    }
    quizSession = {
        subject: subject,
        difficulty: difficulty,
        questions: questionData,
        currentQIndex: 0,
        score: 0,
        correctCount: 0,
        isTest: isTest,
        startTime: Date.now(),
        duration: 0,
    };

    renderView('quiz');
    renderQuestion();
    startQuizTimer();
};

// (FIREBASE)
const startFirebaseQuiz = (questions, examType, subjectName, paperTitle) => {
    currentExamType = examType;
    currentSubject = subjectName;

    // Ensure questions are in a valid array format
    const questionsArray = Array.isArray(questions) ? questions : Object.values(questions || {});

    if (!questionsArray || questionsArray.length === 0) {
        showModal("Error", "This paper seems to be empty.", false);
        goBack();
        return;
    }

    quizSession = {
        subject: `${subjectName} - ${paperTitle}`,
        difficulty: examType,
        // --- SCORING CHANGE: Override scoreValue to 1 for all Firebase questions ---
        questions: questionsArray.map(q => ({ ...q, scoreValue: 1, attempted: false, userAnswer: -1 })),
        // --- END SCORING CHANGE ---
        currentQIndex: 0,
        score: 0,
        correctCount: 0,
        isTest: true, // All Firebase quizzes are considered 'tests'
        startTime: Date.now(),
        duration: 0,
    };

    renderView('quiz');
    renderQuestion();
    startQuizTimer();
};


let quizTimerInterval = null;
const startQuizTimer = () => {
    const timerElement = document.getElementById('quiz-timer');
    let totalSeconds = 0;
    clearInterval(quizTimerInterval);
    timerElement.textContent = '00:00';
    quizTimerInterval = setInterval(() => {
        totalSeconds++;
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
};

const stopQuizTimer = () => {
    clearInterval(quizTimerInterval);
    const timerText = document.getElementById('quiz-timer').textContent;
    const parts = timerText.split(':').map(Number);
    if (quizSession) {
        quizSession.duration = parts[0] * 60 + parts[1];
    }
};

const renderQuestion = () => {
    if (!quizSession) return;
    const q = quizSession.questions[quizSession.currentQIndex];
    const currentQ = quizSession.currentQIndex + 1;
    const totalQ = quizSession.questions.length;

    document.getElementById('quiz-status').textContent = `Q ${currentQ}/${totalQ}`;
    document.getElementById('quiz-timer').classList.remove('hidden');

    const questionKey = `question_${currentLanguage}`;
    const optionsKey = `options_${currentLanguage}`;

    // Fallback logic: Use 'en' if the current language's data is missing
    const questionText = q[questionKey] || q.question_en;
    const options = q[optionsKey] || q.options_en;

    // Final fallback for safety
    if (!options || !Array.isArray(options)) {
        console.error("Invalid options data for question:", q);
        showModal("Quiz Error", "Failed to load question options. Skipping.", false);
        nextQuestion(); // Skip this broken question
        return;
    }

    document.getElementById('quiz-question-text').textContent = questionText;
    document.getElementById('quiz-next-btn').classList.add('hidden');
    document.getElementById('quiz-next-btn').disabled = true;

    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';
    optionsContainer.classList.remove('pointer-events-none');

    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = `w-full text-left p-4 bg-white rounded-xl shadow-lg border-2 border-gray-200 transition duration-150 hover:border-violet-500 hover:shadow-xl focus:outline-none option-btn`;
        button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        button.dataset.index = index;
        button.onclick = () => selectOption(index);
        optionsContainer.appendChild(button);
    });
};

const selectOption = (selectedIndex) => {
    if (!quizSession || quizSession.questions[quizSession.currentQIndex].userAnswer !== -1) return;

    const q = quizSession.questions[quizSession.currentQIndex];
    const isCorrect = selectedIndex === q.correct_answer_index;

    q.attempted = true;
    q.userAnswer = selectedIndex;

    document.getElementById('quiz-options-container').classList.add('pointer-events-none');

    const optionButtons = document.querySelectorAll('#quiz-options-container .option-btn');
    optionButtons.forEach(btn => {
        const index = parseInt(btn.dataset.index);
        btn.classList.remove('hover:border-violet-500', 'hover:shadow-xl');
        if (index === q.correct_answer_index) {
            btn.classList.add('bg-emerald-100', 'border-emerald-500', 'correct-animation');
        } else if (index === selectedIndex) {
            btn.classList.add('bg-red-100', 'border-red-500', 'wrong-animation');
        } else {
            btn.classList.add('opacity-50');
        }
    });

    if (isCorrect) {
        quizSession.correctCount++;
        // --- SCORING CHANGE: Use 1 as fallback ---
        quizSession.score += (q.scoreValue || 1);
        // --- END SCORING CHANGE ---
        playSound('correct');
    } else {
        playSound('wrong');
    }

    document.getElementById('quiz-next-btn').classList.remove('hidden');
    document.getElementById('quiz-next-btn').disabled = false;
};

const nextQuestion = async () => {
    if (!quizSession) return;
    if (quizSession.currentQIndex < quizSession.questions.length - 1) {
        quizSession.currentQIndex++;
        renderQuestion();
    } else {
        stopQuizTimer();
        await endQuiz();
    }
};

const endQuiz = async () => {
    playSound('level_up');
    await saveQuizHistory(quizSession);
    renderView('quiz-result');
    renderResultView();
};

const renderResultView = () => {
    if (!quizSession || !quizSession.questions) {
        console.error("renderResultView called, but quizSession is empty.");
        const titleElement = document.getElementById('result-title');
        if (titleElement) titleElement.textContent = "Error";
        const taglineElement = document.getElementById('result-tagline');
        if (taglineElement) taglineElement.textContent = "Could not load quiz data.";
        return;
    }

    const titleElement = document.getElementById('result-title');
    const scoreRing = document.getElementById('result-score-ring');
    const scoreElement = document.getElementById('result-score');
    const taglineElement = document.getElementById('result-tagline');
    const detailsElement = document.getElementById('result-details');

    const score = quizSession.score;
    const totalQ = quizSession.questions.length;
    const correctQ = quizSession.correctCount;

    scoreRing.className = 'mx-auto w-32 h-32 flex items-center justify-center rounded-full border-8 shadow-xl';
    scoreElement.className = 'text-4xl font-bold';

    if (correctQ / totalQ > 0.7) {
        titleElement.textContent = L('result-title-success');
        scoreRing.classList.add('border-emerald-500', 'bg-green-100');
        scoreElement.classList.add('text-emerald-500');
    } else {
        titleElement.textContent = L('result-title-fail');
        scoreRing.classList.add('border-red-500', 'bg-red-100');
        scoreElement.classList.add('text-red-500');
    }

    scoreElement.textContent = score;
    taglineElement.textContent = L('result-tagline').replace('{score}', score);
    detailsElement.textContent = L('result-details')
        .replace('{solved}', totalQ)
        .replace('{total}', totalQ)
        .replace('{correct}', correctQ);
};

const openReviewScreen = (session, sourceView) => {
    quizSession = session;
    renderView('review', true); // Pass true to indicate it's a sub-view

    if (sourceView === 'history') {
        document.getElementById('close-review-btn').onclick = () => renderView('history');
        document.getElementById('close-review-text').textContent = L('back-to-history-text');
    } else {
        document.getElementById('close-review-btn').onclick = () => renderView('quiz-result');
        document.getElementById('close-review-text').textContent = L('close-review-text');
    }
};

const renderReviewView = () => {
    if (!quizSession || !quizSession.questions) {
        renderView('dashboard');
        return;
    }
    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = '';
    document.getElementById('review-title').textContent = `${L('review-btn-text')} - ${quizSession.subject}`;

    const questionsArray = Array.isArray(quizSession.questions) ? quizSession.questions : Object.values(quizSession.questions || {});

    questionsArray.forEach((q, index) => {
        const isCorrect = q.userAnswer === q.correct_answer_index;
        const questionKey = `question_${currentLanguage}`;
        const explanationKey = `explanation_${currentLanguage}`;
        const optionsKey = `options_${currentLanguage}`;

        const qText = q[questionKey] || q.question_en;
        const explanationText = q[explanationKey] || q.explanation_en || "No explanation provided.";
        const options = q[optionsKey] || q.options_en;

        const card = document.createElement('div');
        card.className = `p-4 rounded-xl shadow-lg border-l-4 ${isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'} space-y-3`;
        let html = `<p class="font-bold text-lg">${index + 1}. ${qText}</p>`;

        if (options && Array.isArray(options)) {
            options.forEach((opt, optIndex) => {
                const isUser = optIndex === q.userAnswer;
                const isCorrectOption = optIndex === q.correct_answer_index;
                let colorClass = 'text-gray-700';
                if (isCorrectOption) {
                    colorClass = 'font-bold text-emerald-600';
                } else if (isUser && !isCorrect) {
                    colorClass = 'font-bold text-red-600 line-through';
                }
                html += `<p class="ml-4 text-sm ${colorClass}">${String.fromCharCode(65 + optIndex)}. ${opt} ${isCorrectOption ? ' (Correct Answer)' : ''} ${isUser && !isCorrect ? ' (Your Answer)' : ''}</p>`;
            });
        } else {
            html += `<p class="ml-4 text-sm text-red-500">Error: Options not found.</p>`;
        }


        html += `<div class="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                                    <p class="font-semibold text-violet-600">${L('review-explanation-text')}:</p>
                                    <p class="text-sm text-gray-800">${explanationText}</p>
                                </div>`;
        card.innerHTML = html;
        reviewList.appendChild(card);
    });
};


// --- UI/VIEW MANAGEMENT & BACK LOGIC ---

const hideAllViews = () => {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.replace('text-violet-500', 'text-gray-500'));
    document.getElementById('quiz-timer').classList.add('hidden');
    document.getElementById('header-title').textContent = '';
};

// isSubView parameter prevents pushing to history (e.g., review from result)
const renderView = (viewName, isSubView = false) => {
    if (!currentUser && viewName !== 'login' && viewName !== 'profile-setup') {
        viewName = 'login';
    }

    // --- History Management ---
    // Only push to history if it's a new view, not a sub-view, and not a main tab
    if (viewName !== currentView && !isSubView && !['dashboard', 'leaderboard', 'history', 'profile', 'login', 'profile-setup'].includes(viewName)) {
        if (viewHistory.length === 0 || viewHistory[viewHistory.length - 1] !== currentView) {
            viewHistory.push(currentView);
        }
    }
    // Reset history if navigating to a main tab
    if (['dashboard', 'leaderboard', 'history', 'profile'].includes(viewName)) {
        viewHistory = [];
    }
    // --- End History Management ---

    hideAllViews();
    currentView = viewName;

    const viewElement = document.getElementById(`${viewName}-view`);
    if (viewElement) viewElement.classList.remove('hidden');

    const activeNavBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (activeNavBtn) activeNavBtn.classList.replace('text-gray-500', 'text-violet-500');

    const showNav = ['dashboard', 'leaderboard', 'history', 'profile'].includes(viewName);
    const bottomNav = document.getElementById('bottom-nav');
    bottomNav.classList.toggle('hidden', !showNav);

    const backBtn = document.getElementById('header-back-btn');
    // Show if history exists OR on result/review OR on practice screens
    const showBackBtn = viewHistory.length > 0 || ['quiz-result', 'review', 'practice-number', 'practice-alphabet', 'practice-math'].includes(viewName);
    backBtn.classList.toggle('hidden', !showBackBtn);


    // --- View-Specific Logic ---
    switch (viewName) {
        case 'dashboard':
            document.getElementById('header-title').textContent = 'Gamat Shala';
            renderDashboard();
            break;
        case 'quiz-result':
            document.getElementById('header-title').textContent = 'Quiz Result';
            // renderResultView() is called by endQuiz()
            break;
        case 'leaderboard':
            document.getElementById('header-title').textContent = L('leaderboard-title');
            renderLeaderboard();
            break;
        case 'history':
            document.getElementById('header-title').textContent = L('history-title');
            renderHistory();
            break;
        case 'profile':
            document.getElementById('header-title').textContent = L('profile-page-title');
            updateProfileUI();
            break;
        case 'subject-selection':
            document.getElementById('header-title').textContent = L('subject-selection-title');
            break;
        case 'paper-selection':
            document.getElementById('header-title').textContent = L('paper-selection-title');
            break;
        case 'stage-selection':
            document.getElementById('header-title').textContent = L('stage-selection-title');
            break;
        case 'quiz':
            document.getElementById('header-title').textContent = quizSession?.subject || 'Quiz';
            break;
        case 'review':
            document.getElementById('header-title').textContent = 'Review';
            renderReviewView();
            break;
        // NEW: Practice View Cases
        case 'practice-number':
            document.getElementById('header-title').textContent = L('practice-number-title');
            break;
        case 'practice-alphabet':
            document.getElementById('header-title').textContent = L('practice-alphabet-title');
            document.getElementById('practice-alphabet-nav-text').textContent = L('practice-alphabet-nav-text');
            break;
        case 'practice-math': // --- NEW ---
            document.getElementById('header-title').textContent = L('practice-math-title');
            break;
    }
    console.log("Current View:", currentView, "History:", viewHistory);
};

const goBack = () => {
    // Special case: from quiz or result, always go to dashboard and clear session
    if (currentView === 'quiz' || currentView === 'quiz-result' || currentView === 'review') {
        quizSession = null;
        viewHistory = []; // Clear history stack
        renderView('dashboard');
        return;
    }
    // NEW: Special case for practice modes
    if (currentView === 'practice-number' || currentView === 'practice-alphabet' || currentView === 'practice-math') {
        currentPracticeType = null;
        currentPracticeIndex = 0;
        currentMathProblem = null;
        viewHistory = []; // Clear history stack
        renderView('dashboard');
        return;
    }

    let previousView = viewHistory.pop();
    if (previousView) {
        renderView(previousView);
    } else {
        if (currentUser) {
            renderView('dashboard');
        } else {
            renderView('login');
        }
    }
};

// --- SUBJECT FILTERING LOGIC ---
const getStandardSubjects = (standard) => {
    if (!standard) return SUBJECTS_DATA;
    const std = parseInt(standard);
    return SUBJECTS_DATA.filter(subject => subject.standards.includes(std));
};

// --- DASHBOARD RENDERING (NEW) ---
const renderDashboard = () => {
    if (!userProfile) return;
    checkWeeklyTestStatus();
    renderExamTypeGrid();
};

const renderExamTypeGrid = () => {
    const gridContainer = document.getElementById('exam-type-grid');
    gridContainer.innerHTML = '';

    const examTypes = [
        { id: 'regular', name: L('exam-regular'), emoji: '📚', color: 'bg-blue-500', isPremium: false },
        { id: 'scholarship', name: L('exam-scholarship'), emoji: '🎓', color: 'bg-green-500', isPremium: true, premiumKey: 'isScholarshipPaid' },
        { id: 'navodaya', name: L('exam-navodaya'), emoji: '🏫', color: 'bg-orange-500', isPremium: true, premiumKey: 'isNavodayaPaid' },
        // NEW: Practice Modes
        { id: 'practice-numbers', name: L('exam-practice-numbers'), emoji: '🔢', color: 'bg-teal-500', isPremium: false },
        { id: 'practice-alphabet', name: L('exam-practice-alphabet'), emoji: '🔡', color: 'bg-pink-500', isPremium: false },
        { id: 'practice-math', name: L('exam-practice-math'), emoji: '🧮', color: 'bg-indigo-500', isPremium: false }, // --- NEW ---
    ];

    examTypes.forEach((exam) => {
        const card = document.createElement('button');
        // Check the specific premium key
        const isLocked = exam.isPremium && !premiumStatus[exam.premiumKey];

        card.className = `p-4 h-32 ${exam.color} ${isLocked ? 'opacity-70' : ''} text-white rounded-xl shadow-lg flex flex-col items-center justify-center space-y-2 font-bold transition duration-300 transform ${isLocked ? 'cursor-not-allowed' : 'hover:scale-[1.03] exam-card'}`;
        card.innerHTML = `
            <span class="text-4xl">${exam.emoji}</span>
            <span class="text-sm font-semibold text-center">${exam.name}</span>
            ${isLocked ? `<span class="text-xs font-bold text-yellow-300">${L('premium-locked')}</span>` : ''}
        `;

        if (isLocked) {
            // Pass the exam type ('scholarship' or 'navodaya') to the payment modal
            card.onclick = () => showPaymentModal(exam.id, () => renderSubjectSelection(exam.id)); // Pay then proceed
        } else if (exam.id === 'practice-numbers') {
            card.onclick = () => startPractice('numbers');
        } else if (exam.id === 'practice-alphabet') {
            card.onclick = () => startPractice('alphabet');
        } else if (exam.id === 'practice-math') { // --- NEW ---
            card.onclick = () => startPractice('math');
        } else {
            card.onclick = () => renderSubjectSelection(exam.id);
        }

        gridContainer.appendChild(card);
    });
};

// --- NEW: Practice Mode Logic ---
const startPractice = (type) => {
    currentPracticeType = type;
    currentPracticeIndex = 0;
    if (type === 'numbers') {
        renderView('practice-number');
        updatePracticeDisplay();
        speakCurrentPracticeItem(); // --- AUTO-PLAY ---
    } else if (type === 'alphabet') {
        renderView('practice-alphabet');
        updatePracticeDisplay();
        speakCurrentPracticeItem(); // --- AUTO-PLAY ---
    } else if (type === 'math') { // --- NEW ---
        renderView('practice-math');
        generateMathProblem();
        renderMathProblem();
        speakMathProblem(); // --- AUTO-PLAY ---
    }
};

const updatePracticeDisplay = () => {
    let data, item, viewId, navId;

    if (currentPracticeType === 'numbers') {
        data = PRACTICE_DATA.numbers;
        viewId = 'practice-number-text';
        navId = 'practice-number-nav-text';
    } else {
        data = PRACTICE_DATA[currentLanguage] || PRACTICE_DATA.en;
        viewId = 'practice-alphabet-text';
        navId = 'practice-alphabet-nav-text';
    }

    item = data[currentPracticeIndex];
    document.getElementById(viewId).textContent = item;
    document.getElementById(navId).textContent = `${L(navId)} (${currentPracticeIndex + 1}/${data.length})`;
};

const navigatePractice = (direction) => {
    let data = (currentPracticeType === 'numbers') ? PRACTICE_DATA.numbers : (PRACTICE_DATA[currentLanguage] || PRACTICE_DATA.en);

    if (direction === 'next') {
        currentPracticeIndex++;
    } else {
        currentPracticeIndex--;
    }

    // Bounds checking
    if (currentPracticeIndex >= data.length) {
        currentPracticeIndex = 0;
    }
    if (currentPracticeIndex < 0) {
        currentPracticeIndex = data.length - 1;
    }
    updatePracticeDisplay();
    speakCurrentPracticeItem(); // --- AUTO-PLAY ---
};

// --- NEW: Math Lab Functions ---

// Helper to get random integer
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateMathProblem = () => {
    const operators = ['+', '-', '*', '/'];
    const op = operators[randInt(0, 3)];
    let num1 = randInt(1, 99);
    let num2 = randInt(1, 99);
    let problemText, ttsTextKey, correctAnswer;

    switch (op) {
        case '+':
            num1 = randInt(1, 99);
            num2 = randInt(1, 99);
            correctAnswer = num1 + num2;
            problemText = `${num1} + ${num2} = ?`;
            ttsTextKey = 'op-plus';
            break;
        case '-':
            // Ensure result is not negative
            num1 = randInt(10, 99);
            num2 = randInt(1, num1); // num2 is smaller or equal
            correctAnswer = num1 - num2;
            problemText = `${num1} - ${num2} = ?`;
            ttsTextKey = 'op-minus';
            break;
        case '*':
            num1 = randInt(1, 12); // Keep multiplication manageable
            num2 = randInt(1, 12);
            correctAnswer = num1 * num2;
            problemText = `${num1} × ${num2} = ?`;
            ttsTextKey = 'op-times';
            break;
        case '/':
            // Ensure clean division
            num2 = randInt(2, 10); // Divisor
            let multiplier = randInt(2, 10);
            num1 = num2 * multiplier; // Dividend
            correctAnswer = num1 / num2;
            problemText = `${num1} ÷ ${num2} = ?`;
            ttsTextKey = 'op-divided-by';
            break;
    }

    // Generate 2 wrong options
    let options = [correctAnswer];
    while (options.length < 3) {
        let wrongAnswer = correctAnswer + randInt(-10, 10);
        // Ensure wrong answer is not 0, not negative, and not already in options
        if (wrongAnswer !== correctAnswer && wrongAnswer >= 0 && !options.includes(wrongAnswer)) {
            options.push(wrongAnswer);
        }
        // Break loop if it's struggling (e.g., correct answer is 1)
        if (options.length == 1 && correctAnswer <= 1) {
            options.push(correctAnswer + 1, correctAnswer + 2);
        }
    }

    currentMathProblem = {
        problemText: problemText,
        ttsText: `${num1} ${L(ttsTextKey)} ${num2}`,
        correctAnswer: correctAnswer,
        options: shuffleArray(options)
    };
};

const renderMathProblem = () => {
    if (!currentMathProblem) return;

    document.getElementById('practice-math-problem').textContent = currentMathProblem.problemText;
    const optionsContainer = document.getElementById('practice-math-options');
    optionsContainer.innerHTML = '';

    currentMathProblem.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'math-option-btn';
        button.textContent = option;
        button.onclick = () => selectMathOption(button, option);
        optionsContainer.appendChild(button);
    });
};

const selectMathOption = (buttonElement, selectedAnswer) => {
    if (!currentMathProblem) return;

    const isCorrect = (selectedAnswer === currentMathProblem.correctAnswer);

    if (isCorrect) {
        playSound('correct');
        buttonElement.classList.add('correct');
        // Disable all buttons
        document.querySelectorAll('.math-option-btn').forEach(btn => btn.disabled = true);

        // Wait, then show next problem
        setTimeout(() => {
            generateMathProblem();
            renderMathProblem();
            speakMathProblem(); // --- AUTO-PLAY ---
        }, 1000);

    } else {
        playSound('wrong');
        buttonElement.classList.add('wrong');
        buttonElement.disabled = true; // Disable only the wrong one
    }
};

const speakMathProblem = () => {
    if (currentMathProblem) {
        speak(currentMathProblem.ttsText, TTS_LANG_MAP[currentLanguage]);
    }
};


// --- END: Math Lab Functions ---


// --- NEW: Subject Selection ---
const renderSubjectSelection = async (examType) => {
    currentExamType = examType;
    renderView('subject-selection');
    const list = document.getElementById('subject-list');
    list.innerHTML = `<p class="text-center text-gray-500">${L('history-loading')}</p>`; // Re-use loading text
    document.getElementById('subject-selection-title').textContent = L('subject-selection-title');

    let subjects = [];

    if (examType === 'regular') {
        subjects = getStandardSubjects(userProfile.standard).map(s => ({
            id: s.name,
            name: s.name,
            emoji: s.emoji,
            color: s.color,
        }));
    } else {
        // Fetch from Firebase
        const fbSubjects = await fetchFirebaseSubjects(examType, userProfile.standard);
        subjects = fbSubjects.map(s => ({
            id: s,
            name: s, // "Math", "Science"
            emoji: '📝', // Default emoji for FB subjects
            color: 'bg-violet-500'
        }));
    }

    list.innerHTML = ''; // Clear loading
    if (subjects.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500">${L('no-subjects-found')}</p>`;
        return;
    }

    subjects.forEach((subject) => {
        const card = document.createElement('button');
        card.className = `w-full p-5 ${subject.color} text-white rounded-xl shadow-xl flex items-center justify-between transition duration-300 transform hover:scale-[1.03] subject-card`;
        card.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="text-3xl">${subject.emoji}</div>
                <p class="text-xl font-bold">${subject.name}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        `;

        if (examType === 'regular') {
            card.onclick = () => renderDifficultySelection(subject.id);
        } else {
            card.onclick = () => renderPaperSelection(examType, subject.id);
        }
        list.appendChild(card);
    });
};

// --- NEW: Fetch Firebase Subjects ---
const fetchFirebaseSubjects = async (examType, standard) => {
    try {
        const subjectsRef = ref(window.db, `artifacts/${window.appId}/exam_data/${examType}/${standard}`);
        const snapshot = await get(subjectsRef);
        if (snapshot.exists()) {
            return Object.keys(snapshot.val()); // Returns ["Math", "Science", "English"]
        }
        return [];
    } catch (error) {
        console.error("Fetch Firebase Subjects Error:", error);
        showModal("Error", "Could not load subjects from database.", false);
        return [];
    }
};

// --- NEW: Paper Selection ---
const renderPaperSelection = async (examType, subjectName) => {
    currentSubject = subjectName;
    renderView('paper-selection');
    const list = document.getElementById('paper-list');
    list.innerHTML = `<p class="text-center text-gray-500">${L('history-loading')}</p>`;
    document.getElementById('paper-selection-title').textContent = `${L('paper-selection-title')} - ${subjectName}`;

    const papers = await fetchFirebasePapers(examType, userProfile.standard, subjectName);
    list.innerHTML = ''; // Clear loading

    const paperKeys = Object.keys(papers);

    if (paperKeys.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500">${L('no-papers-found')}</p>`;
        return;
    }

    paperKeys.forEach(paperKey => {
        const paper = papers[paperKey];
        const card = document.createElement('button');
        card.className = `w-full p-5 bg-gray-700 text-white rounded-xl shadow-xl flex items-center justify-between transition duration-300 transform hover:scale-[1.03] paper-card`;
        card.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="text-3xl">📄</div>
                <p class="text-xl font-bold">${paper.title}</p>
            </div>
            <span class="font-semibold text-sm border border-white px-3 py-1 rounded-full">Start</span>
        `;
        card.onclick = () => startFirebaseQuiz(paper.questions, examType, subjectName, paper.title);
        list.appendChild(card);
    });
};

// --- NEW: Fetch Firebase Papers ---
const fetchFirebasePapers = async (examType, standard, subjectName) => {
    try {
        const papersRef = ref(window.db, `artifacts/${window.appId}/exam_data/${examType}/${standard}/${subjectName}/papers`);
        const snapshot = await get(papersRef);
        if (!snapshot.exists()) {
            return {};
        }

        const papersData = snapshot.val();
        // Convert questions objects to arrays if they aren't already
        Object.keys(papersData).forEach(paperKey => {
            const paper = papersData[paperKey];
            if (paper.questions && typeof paper.questions === 'object' && !Array.isArray(paper.questions)) {
                paper.questions = Object.values(paper.questions);
            }
        });
        return papersData;

    } catch (error) {
        console.error("Fetch Firebase Papers Error:", error);
        showModal("Error", "Could not load papers from database.", false);
        return {};
    }
};


// --- (Regular) Difficulty Selection ---
const renderDifficultySelection = (subject) => {
    currentSubject = subject; // Keep track of subject
    renderView('stage-selection');
    const list = document.getElementById('stage-list');
    list.innerHTML = '';
    document.getElementById('stage-selection-title').textContent = `${L('stage-selection-title')} - ${subject}`;
    document.getElementById('stage-selection-subtitle').textContent = L('stage-selection-subtitle');

    Object.keys(DIFFICULTIES).forEach(difficultyKey => {
        const diff = DIFFICULTIES[difficultyKey];
        const card = document.createElement('button');
        card.className = `w-full p-5 ${diff.color} text-white rounded-xl shadow-xl flex items-center justify-between transition duration-300 transform hover:scale-[1.03] stage-card`;
        card.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="text-3xl">${diff.emoji}</div>
                <div>
                        <p class="text-xl font-bold">${diff.label[currentLanguage]}</p>
                        <p class="font-semibold text-sm opacity-90">${subject}</p>
                </div>
            </div>
            <span class="font-semibold text-sm border border-white px-3 py-1 rounded-full">Score: 1pt</span>
            `;
        card.onclick = () => startQuiz(subject, difficultyKey, false); // This is the OTDB quiz
        list.appendChild(card);
    });
};

// --- WEEKLY TEST LOGIC (Updated Payment) ---
const checkWeeklyTestStatus = () => {
    const testCard = document.getElementById('weekly-test-card');
    if (!testCard) return;
    const isSunday = true; // Mocked for demo (new Date().getDay() === 0)
    const isTestEnabledByAdmin = isSunday;

    testCard.classList.add('hidden');
    let isWeeklyTestAvailable = false; // Local scope

    const cardBtn = document.getElementById('test-card-btn');
    document.getElementById('test-card-title').textContent = L('test-card-title');
    testCard.className = 'p-4 rounded-2xl shadow-lg border-4 transform transition duration-300 hover:scale-[1.02] cursor-pointer';

    if (isTestEnabledByAdmin) {
        isWeeklyTestAvailable = true;
        testCard.classList.remove('hidden');
        testCard.classList.add('bg-yellow-400', 'border-yellow-600');

        // Check the specific boolean from global state
        if (premiumStatus.isWeeklyPaid) {
            document.getElementById('test-card-status').textContent = L('test-card-status-paid');
            document.getElementById('test-card-status').className = 'text-sm text-yellow-700';
            cardBtn.textContent = L('test-card-btn-start');
            testCard.onclick = () => startQuiz('Weekly Test (Premium)', 'hard', true); // Uses OTDB
        } else {
            document.getElementById('test-card-status').textContent = L('test-card-status-pay');
            document.getElementById('test-card-status').className = 'text-sm text-red-700 font-semibold';
            cardBtn.textContent = L('test-card-btn-pay');
            // Pass 'weekly' as the exam type
            testCard.onclick = () => showPaymentModal('weekly', () => {
                // On successful payment, auto-start the weekly test
                startQuiz('Weekly Test (Premium)', 'hard', true);
            });
        }
    } else {
        testCard.classList.remove('hidden');
        testCard.classList.add('bg-gray-400', 'border-gray-600', 'cursor-not-allowed');
        document.getElementById('test-card-status').textContent = L('test-card-status-inactive');
        document.getElementById('test-card-status').className = 'text-sm text-gray-700';
        cardBtn.textContent = 'CLOSED';
        testCard.onclick = null;
    }
};

// --- REFACTORED PAYMENT MODAL ---
const showPaymentModal = (examType, onConfirmCallback = () => { }) => {
    // Determine which texts and db key to use
    let titleKey = '';
    let messageKey = '';
    let dbKey = '';

    if (examType === 'weekly') {
        titleKey = 'modal-pay-weekly-title';
        messageKey = 'modal-pay-weekly-message';
        dbKey = 'isWeeklyPaid';
    } else if (examType === 'scholarship') {
        titleKey = 'modal-pay-scholarship-title';
        messageKey = 'modal-pay-scholarship-message';
        dbKey = 'isScholarshipPaid';
    } else if (examType === 'navodaya') {
        titleKey = 'modal-pay-navodaya-title';
        messageKey = 'modal-pay-navodaya-message';
        dbKey = 'isNavodayaPaid';
    } else {
        console.error("Unknown examType for payment modal:", examType);
        return;
    }

    showModal(
        L(titleKey),
        L(messageKey),
        true,
        () => { // onConfirm
            const modal = document.getElementById('global-modal');
            modal.classList.add('hidden');
            showModal('Processing Payment...', 'Simulating transaction for ₹9.00 via Razorpay... Please wait.', false);

            setTimeout(async () => {
                const userRef = ref(window.db, `artifacts/${window.appId}/users/${window.userId}/profile`);

                // Update the specific boolean in Firebase
                let updates = {};
                updates[dbKey] = true;
                await update(userRef, updates);

                // Update local state
                premiumStatus[dbKey] = true;
                userProfile[dbKey] = true;

                document.getElementById('global-modal').classList.add('hidden');
                showModal('Success! 🎉', 'Payment successful. This content is now unlocked permanently!', false);

                // Update UI
                checkWeeklyTestStatus(); // Refreshes weekly card
                renderDashboard(); // Re-render dashboard to unlock cards
                updateProfileUI(); // Updates profile page

                // Execute the callback (e.g., proceed to subject selection)
                onConfirmCallback();
            }, 2000);
        }
    );
};

// --- LEADERBOARD & HISTORY RENDERING ---
const renderLeaderboard = async () => {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = `<p class="text-center text-gray-500">${L('leaderboard-loading')}</p>`;
    const usersRef = ref(window.db, `artifacts/${window.appId}/users`);
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
        list.innerHTML = `<p class="text-center text-gray-500">No scores yet.</p>`;
        return;
    }
    const userData = snapshot.val();
    let leaderboard = [];
    for (const uid in userData) {
        if (userData[uid].profile) {
            leaderboard.push({
                uid: uid,
                ...userData[uid].profile
            });
        }
    }
    leaderboard.sort((a, b) => (b.score || 0) - (a.score || 0));
    list.innerHTML = '';

    // Check for premium status to show badge
    const hasPremium = (user) => user.isWeeklyPaid || user.isScholarshipPaid || user.isNavodayaPaid;

    leaderboard.slice(0, 10).forEach((user, index) => {
        const rank = index + 1;
        const rankColor = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-700' : 'text-gray-600';
        const card = document.createElement('div');
        // Show a yellow border if user has *any* premium access
        card.className = `p-3 bg-white rounded-xl shadow-lg flex items-center justify-between transition duration-150 transform hover:scale-[1.01] border-b-2 ${hasPremium(user) ? 'border-yellow-400' : 'border-violet-200'}`;

        // --- LEADERBOARD CHANGE: Show School Name ---
        card.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-xl font-extrabold w-8 text-center ${rankColor}">#${rank}</span>
                <img src="${user.photoURL}" class="w-10 h-10 rounded-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/40x40/8b5cf6/ffffff?text=P';" alt="Profile">
                <div>
                    <p class="font-bold text-gray-800 truncate max-w-[150px]">${user.name} ${hasPremium(user) ? '⭐' : ''}</p>
                    <p class="text-xs text-gray-500">${user.schoolName || 'School Not Set'}</p>
                </div>
            </div>
            <span class="text-2xl font-bold text-violet-600">${user.score || 0}</span>
            `;
        // --- END LEADERBOARD CHANGE ---
        list.appendChild(card);
    });
};

const renderHistory = async () => {
    const list = document.getElementById('history-list');
    list.innerHTML = `<p class="text-center text-gray-500">${L('history-loading')}</p>`;
    const historyRef = ref(window.db, `artifacts/${window.appId}/users/${window.userId}/history`);
    const snapshot = await get(historyRef);
    if (!snapshot.exists()) {
        list.innerHTML = `<p class="text-center text-gray-500">No history available.</p>`;
        return;
    }
    const historyData = snapshot.val();
    let historyList = [];
    for (const key in historyData) {
        historyList.push(historyData[key]);
    }
    historyList.sort((a, b) => b.startTime - a.startTime);
    list.innerHTML = '';
    historyList.forEach(session => {
        const date = new Date(session.startTime).toLocaleDateString(currentLanguage === 'mr' ? 'mr-IN' : currentLanguage === 'hi' ? 'hi-IN' : 'en-US');

        // Ensure questions is an array for length check
        const questionsArray = Array.isArray(session.questions) ? session.questions : Object.values(session.questions || {});
        const totalQuestions = questionsArray.length;
        if (totalQuestions === 0) return; // Don't render broken history items

        const colorClass = session.correctCount > (totalQuestions / 2) ? 'bg-emerald-50' : 'bg-red-50';
        const statusEmoji = session.correctCount > (totalQuestions / 2) ? '🥳' : '✍️';
        const card = document.createElement('div');
        card.className = `p-4 ${colorClass} rounded-xl shadow-lg space-y-2 border-l-4 border-violet-500 cursor-pointer transition duration-200 hover:shadow-xl`;
        card.onclick = () => openReviewScreen(session, 'history');
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <p class="text-lg font-bold text-gray-800">${session.subject} (${session.difficulty.toUpperCase()})</p>
                <span class="text-sm text-gray-500">${date}</span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="font-semibold text-violet-600">Score: ${session.score} ${statusEmoji}</span>
                <span class="font-semibold text-gray-700">Correct: ${session.correctCount}/${totalQuestions}</span>
            </div>
            `;
        list.appendChild(card);
    });
};

// --- GLOBAL MODAL SYSTEM ---
const showModal = (title, message, isConfirm = false, onConfirm = () => { }) => {
    const modal = document.getElementById('global-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (isConfirm) {
        confirmBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent = 'Cancel';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.classList.replace('bg-violet-500', 'bg-emerald-500');
        confirmBtn.classList.replace('hover:bg-violet-600', 'hover:bg-emerald-600');
    } else {
        confirmBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent = 'Close';
    }
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    confirmBtn.onclick = () => {
        modal.classList.add('hidden');
        onConfirm();
        confirmBtn.classList.replace('bg-emerald-500', 'bg-violet-500');
        confirmBtn.classList.replace('hover:bg-emerald-600', 'hover:bg-violet-600');
    };
    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
        confirmBtn.classList.replace('bg-emerald-500', 'bg-violet-500');
        confirmBtn.classList.replace('hover:bg-emerald-600', 'hover:bg-violet-600');
    };
    modal.classList.remove('hidden');
};

// --- INITIALIZATION AND EVENT LISTENERS ---
window.initApp = () => {
    // --- NEW: Load Audio Setting ---
    isAudioEnabled = localStorage.getItem('smartkid_audio') === 'false' ? false : true;

    const savedLang = localStorage.getItem('smartkid_lang');
    if (savedLang) {
        currentLanguage = savedLang;
    }
    document.getElementById('lang-select').value = currentLanguage;
    localizeElements();

    // --- NEW: Add listeners to unlock audio on first interaction ---
    document.body.addEventListener('click', unlockAudio, { once: false });
    document.body.addEventListener('touchstart', unlockAudio, { once: false });
    // 'once: false' is implicit, but good to be clear.
    // The `unlockAudio` function itself will remove the listener.

    // Hook the improved Google sign-in button
    const googleBtn = document.getElementById('google-sign-in-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            if (typeof signInWithGoogle === 'function') {
                signInWithGoogle();
            }
        });
    }

    document.getElementById('profile-setup-form').addEventListener('submit', saveProfile);
    document.getElementById('quiz-next-btn').addEventListener('click', nextQuestion);
    document.getElementById('header-back-btn').addEventListener('click', goBack);

    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
        quizSession = null;
        renderView('dashboard');
    });
    document.getElementById('review-answers-btn').addEventListener('click', () => {
        if (quizSession) {
            openReviewScreen(quizSession, 'quiz-result');
        } else {
            renderView('dashboard');
        }
    });
    document.getElementById('sign-out-btn').addEventListener('click', signOutUser);

    // --- NEW: Audio Toggle Listener ---
    document.getElementById('audio-toggle').addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        localStorage.setItem('smartkid_audio', isAudioEnabled);
        const audioToggle = document.getElementById('audio-toggle');
        audioToggle.setAttribute('aria-checked', isAudioEnabled);
    });

    document.getElementById('lang-select').addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        localStorage.setItem('smartkid_lang', currentLanguage);
        localizeElements();
        // If in a practice view, update the display immediately
        if (currentView === 'practice-alphabet') {
            currentPracticeIndex = 0; // Reset index on lang change
            updatePracticeDisplay();
            speakCurrentPracticeItem(); // --- AUTO-PLAY ---
        }
        // --- NEW: Also auto-play for numbers view ---
        if (currentView === 'practice-number') {
            updatePracticeDisplay(); // Update nav text
            speakCurrentPracticeItem(); // --- AUTO-PLAY ---
        }
        // --- NEW: Also auto-play for math view ---
        if (currentView === 'practice-math') {
            speakMathProblem(); // Re-speak problem in new language
        }
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            if (view === 'dashboard') {
                quizSession = null;
            }
            viewHistory = [];
            renderView(view);
        });
    });

    // --- UPDATED: Event Listeners for Practice Modes (using helper) ---
    // Numbers
    document.getElementById('practice-number-speak-btn').addEventListener('click', () => {
        speakCurrentPracticeItem();
    });
    document.getElementById('practice-number-prev-btn').addEventListener('click', () => navigatePractice('prev'));
    document.getElementById('practice-number-next-btn').addEventListener('click', () => navigatePractice('next'));

    // Alphabet
    document.getElementById('practice-alphabet-speak-btn').addEventListener('click', () => {
        speakCurrentPracticeItem();
    });
    document.getElementById('practice-alphabet-prev-btn').addEventListener('click', () => navigatePractice('prev'));
    document.getElementById('practice-alphabet-next-btn').addEventListener('click', () => navigatePractice('next'));

    // --- NEW: Math ---
    document.getElementById('practice-math-speak-btn').addEventListener('click', speakMathProblem);


    if (!currentUser) {
        renderView('login');
    }
};