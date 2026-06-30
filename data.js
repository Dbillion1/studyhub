/* ════════════════════════════════════════════════════════════
   data.js — static content: subjects, quizzes, tips, tools,
   achievements, challenges, and the generated prompt library.
   ════════════════════════════════════════════════════════════ */

const SUBJECTS = {
  maths: { title: 'Mathematics', icon: '➕', topics: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Probability', 'Quadratic Equations', 'Coordinate Geometry', 'Surds & Indices', 'Number Theory', 'Calculus (A-Level)'] },
  english: { title: 'English', icon: '📝', topics: ['Poetry Analysis', 'Macbeth', 'A Christmas Carol', 'Language Techniques', 'Essay Writing', 'Reading Comprehension', 'Unseen Text', 'Creative Writing', 'Grammar', 'Punctuation'] },
  science: { title: 'Science', icon: '🔬', topics: ['Cell Biology', 'Atomic Structure', 'Forces & Motion', 'Genetics', 'Chemical Reactions', 'Electricity', 'Ecosystems', 'Waves', 'Organic Chemistry', 'Nuclear Physics'] },
  geography: { title: 'Geography', icon: '🌍', topics: ['Climate Change', 'Tectonic Hazards', 'Urban Issues', 'Ecosystems', 'Glaciation', 'River Landscapes', 'Development', 'Global Systems', 'Resource Management', 'Coastal Landscapes'] },
  history: { title: 'History', icon: '🏛️', topics: ['WW1 Causes', 'WW2 Events', 'Cold War', 'Nazi Germany', 'Weimar Republic', 'British Empire', 'Civil Rights', 'Industrial Revolution', 'Russian Revolution', 'Suffragettes'] },
  cs: { title: 'Computer Science', icon: '💻', topics: ['Algorithms', 'Data Structures', 'Boolean Logic', 'Networking', 'Cybersecurity', 'SQL Databases', 'Python Programming', 'Binary & Hexadecimal', 'Hardware', 'Operating Systems'] },
  french: { title: 'French', icon: '🇫🇷', topics: ['Present Tense', 'Past Tense (Passé Composé)', 'Future Tense', 'School & Education', 'Holidays', 'Family', 'Environment', 'Work & Career', 'Health', 'Towns & Transport'] },
  german: { title: 'German', icon: '🇩🇪', topics: ['Cases', 'Present Tense', 'Perfect Tense', 'School & Education', 'Holidays', 'Family', 'Environment', 'Work & Career', 'Conjunctions', 'Word Order'] }
};
const SUBJECT_KEYS = Object.keys(SUBJECTS);
const SUBJECT_COLORS = { maths: '#7c3aed', english: '#10b981', science: '#f97316', geography: '#ec4899', history: '#ef4444', cs: '#3b82f6', french: '#06b6d4', german: '#f59e0b' };
const subjLabel = k => SUBJECTS[k] ? (SUBJECTS[k].icon + ' ' + SUBJECTS[k].title) : k;
const subjName = k => SUBJECTS[k] ? SUBJECTS[k].title : k;

/* ---------- quiz bank (real questions per subject) ---------- */
const QUIZ_BANK = {
  maths: [
    { q: 'Solve: 2x² + 5x − 3 = 0', opts: ['x = 0.5 or x = −3', 'x = −0.5 or x = 3', 'x = 1 or x = −3', 'x = 2 or x = −1.5'], ans: 0 },
    { q: 'What is the value of π to 2 decimal places?', opts: ['3.12', '3.14', '3.16', '3.18'], ans: 1 },
    { q: 'Which of these is a prime number?', opts: ['9', '15', '21', '23'], ans: 3 },
    { q: 'If y = 2x + 3, what is y when x = 4?', opts: ['10', '11', '12', '14'], ans: 1 },
    { q: 'The gradient of the line y = 5x − 2 is:', opts: ['−2', '2', '5', '10'], ans: 2 }
  ],
  english: [
    { q: 'A metaphor is best described as:', opts: ['A direct comparison without "like" or "as"', 'A comparison using "like" or "as"', 'A deliberate exaggeration', 'A sound-imitating word'], ans: 0 },
    { q: 'Who wrote "Macbeth"?', opts: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'George Orwell'], ans: 1 },
    { q: '"The wind whispered" is an example of:', opts: ['Simile', 'Hyperbole', 'Personification', 'Onomatopoeia'], ans: 2 },
    { q: 'Which word is an adverb?', opts: ['Quick', 'Quickly', 'Quickness', 'Quicken'], ans: 1 },
    { q: 'In "A Christmas Carol", how many spirits visit Scrooge in total?', opts: ['2', '3', '4', '5'], ans: 2 }
  ],
  science: [
    { q: 'Which organelle is the "powerhouse of the cell"?', opts: ['Nucleus', 'Ribosome', 'Mitochondria', 'Vacuole'], ans: 2 },
    { q: 'The chemical symbol for sodium is:', opts: ['So', 'Na', 'Sd', 'S'], ans: 1 },
    { q: 'What is the unit of force?', opts: ['Joule', 'Watt', 'Newton', 'Pascal'], ans: 2 },
    { q: 'Osmosis is the movement of:', opts: ['Water across a partially permeable membrane', 'Salt into a cell', 'Oxygen through blood', 'Glucose in the gut'], ans: 0 },
    { q: 'How many protons does a carbon atom have?', opts: ['4', '6', '8', '12'], ans: 1 }
  ],
  geography: [
    { q: 'Earthquakes are mainly caused by:', opts: ['Wind erosion', 'Tectonic plate movement', 'Ocean currents', 'Deforestation'], ans: 1 },
    { q: 'A river deposits most of its load at the:', opts: ['Source', 'Mouth', 'Watershed', 'Tributary'], ans: 1 },
    { q: 'Which gas contributes most to human-caused global warming?', opts: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], ans: 2 },
    { q: 'At a constructive plate margin, plates:', opts: ['Move apart', 'Collide head-on', 'Slide past each other', 'Sink beneath one another'], ans: 0 },
    { q: 'The wearing away of rock by ice is called:', opts: ['Deposition', 'Glaciation', 'Evaporation', 'Condensation'], ans: 1 }
  ],
  history: [
    { q: 'World War II began in which year?', opts: ['1914', '1929', '1939', '1945'], ans: 2 },
    { q: 'The assassination that helped trigger WW1 took place in:', opts: ['Berlin', 'Sarajevo', 'Paris', 'London'], ans: 1 },
    { q: 'The treaty signed after WW1 was the Treaty of:', opts: ['Rome', 'Paris', 'Versailles', 'Vienna'], ans: 2 },
    { q: 'The Cold War was primarily between the USA and:', opts: ['Germany', 'The USSR', 'Japan', 'China'], ans: 1 },
    { q: 'Who led Nazi Germany?', opts: ['Joseph Stalin', 'Benito Mussolini', 'Adolf Hitler', 'Winston Churchill'], ans: 2 }
  ],
  cs: [
    { q: 'An algorithm is:', opts: ['A type of computer', 'A step-by-step set of instructions', 'A programming language', 'A storage device'], ans: 1 },
    { q: 'The binary number 1010 equals which decimal value?', opts: ['8', '10', '12', '20'], ans: 1 },
    { q: 'Which of these is NOT a programming language?', opts: ['Python', 'Java', 'HTML', 'Photoshop'], ans: 3 },
    { q: 'In Boolean logic, AND outputs true when:', opts: ['Either input is true', 'Both inputs are true', 'Both inputs are false', 'The inputs differ'], ans: 1 },
    { q: 'RAM is best described as:', opts: ['Permanent storage', 'Volatile working memory', 'A processor', 'A network device'], ans: 1 }
  ],
  french: [
    { q: '"I have" in French is:', opts: ["J'ai", 'Je suis', 'Tu as', 'Nous avons'], ans: 0 },
    { q: 'The French word for "school" is:', opts: ['maison', 'école', 'voiture', 'livre'], ans: 1 },
    { q: 'Which is the passé composé for "I ate" (manger)?', opts: ['je mange', "j'ai mangé", 'je mangeais', 'je mangerai'], ans: 1 },
    { q: '"Bonjour" means:', opts: ['Goodbye', 'Thank you', 'Hello', 'Please'], ans: 2 },
    { q: 'The plural form of "the" (les) is used for:', opts: ['Singular masculine', 'Singular feminine', 'Plural nouns', 'Vowel-starting nouns'], ans: 2 }
  ],
  german: [
    { q: '"Thank you" in German is:', opts: ['Bitte', 'Danke', 'Hallo', 'Tschüss'], ans: 1 },
    { q: 'The German word for "house" is:', opts: ['Hund', 'Haus', 'Hand', 'Herz'], ans: 1 },
    { q: 'Which case is used for the direct object?', opts: ['Nominative', 'Accusative', 'Dative', 'Genitive'], ans: 1 },
    { q: '"Ich heiße…" means:', opts: ['I live…', 'I am called…', 'I have…', 'I want…'], ans: 1 },
    { q: 'The nominative definite article for a masculine noun is:', opts: ['die', 'das', 'der', 'den'], ans: 2 }
  ]
};

/* ---------- daily tips (deterministic by date) ---------- */
const DAILY_TIPS = [
  'Spaced repetition beats cramming — review a topic 1 day, 3 days, then 7 days after learning it.',
  'Try the Pomodoro technique: 25 minutes focused study, then a 5-minute break.',
  'Teaching a topic out loud reveals exactly what you don\'t yet understand.',
  'Active recall — testing yourself — builds memory far better than re-reading notes.',
  'Start each session by writing down what you want to achieve in the next 30 minutes.',
  'Past papers are gold. Mark your own answers against the mark scheme to learn examiner thinking.',
  'Sleep consolidates memory. A good night\'s rest before an exam beats a late-night cram.',
  'Switch subjects between sessions (interleaving) to strengthen long-term recall.',
  'Turn your weakest topic into your first task of the day, when your focus is freshest.',
  'Summarise a topic in 3 bullet points from memory, then check what you missed.',
  'Drinking water and taking short walks genuinely improves concentration.',
  'Break big goals into tiny next actions — "revise the photosynthesis diagram" beats "do biology".',
  'Make flashcards as you learn, not the night before — your future self will thank you.',
  'Explain answers using "because" — understanding the why locks in the what.',
  'Study in the same conditions as your exam (silent, no phone) to train your focus.',
  'Colour-code by theme, not decoration — only highlight what truly matters.',
  'Re-do questions you got wrong a week later. Mistakes are the best study material.',
  'Dreading a task? Commit to just 10 minutes — starting is usually the hardest part.',
  'Mind maps are great for connecting ideas across a topic before an exam.',
  'Reward yourself after hitting a study goal — momentum is built on small wins.',
  'Read the question twice and underline the command word (explain, evaluate, describe).',
  'Don\'t multitask. Single-tasking one subject is faster than juggling three.',
  'Write a one-sentence summary at the end of every session to check you learned something.',
  'Use your phone\'s focus mode during study blocks to remove temptation.',
  'Quiz yourself before reading the chapter — it primes your brain to absorb more.',
  'Group similar exam questions together to spot the patterns examiners reuse.',
  'A tidy desk really does help. Clear the space, clear the mind.',
  'Practise timed essays so you know how long 8 marks "feels" and never run out of time.',
  'When stuck, look up just enough to get unstuck, then keep going — avoid the rabbit hole.',
  'Track your streak. Showing up daily, even for 15 minutes, compounds fast.',
  'Convert your notes into questions — every heading can become "What is…?" or "Why does…?".',
  'Before bed, skim tomorrow\'s topics for 5 minutes — your brain works on them overnight.'
];
function tipForToday() {
  const epochDays = Math.floor(Date.now() / 86400000);
  return DAILY_TIPS[epochDays % DAILY_TIPS.length];
}

/* ---------- AI tools directory ---------- */
const tools = [
  { name: 'Khan Academy', logo: '🎓', desc: 'Free world-class education. Interactive exercises and videos for every level.', tags: ['maths', 'research', 'productivity'], rating: 4.8, reviews: 12400, cat: 'maths', trend: true, url: 'https://www.khanacademy.org' },
  { name: 'Wolfram Alpha', logo: '🔢', desc: 'Computational intelligence for maths, science, and beyond.', tags: ['maths', 'research'], rating: 4.7, reviews: 8900, cat: 'maths', url: 'https://www.wolframalpha.com' },
  { name: 'Quizlet', logo: '🃏', desc: 'Create flashcards, study sets, and practice tests for any subject.', tags: ['revision', 'productivity'], rating: 4.6, reviews: 15000, cat: 'productivity', trend: true, url: 'https://quizlet.com' },
  { name: 'Grammarly', logo: '✍️', desc: 'AI writing assistant that checks grammar, clarity, and style.', tags: ['writing', 'productivity'], rating: 4.5, reviews: 22000, cat: 'writing', trend: true, url: 'https://www.grammarly.com' },
  { name: 'Photomath', logo: '📷', desc: 'Solve maths problems with your camera and step-by-step explanations.', tags: ['maths'], rating: 4.6, reviews: 9200, cat: 'maths', url: 'https://photomath.com' },
  { name: 'Duolingo', logo: '🦜', desc: 'Learn French, German, Spanish and 30+ languages with gamified lessons.', tags: ['language'], rating: 4.7, reviews: 18000, cat: 'language', url: 'https://www.duolingo.com' },
  { name: 'GitHub Copilot', logo: '💻', desc: 'AI-powered code completion and suggestions inside your editor.', tags: ['coding'], rating: 4.5, reviews: 11000, cat: 'coding', url: 'https://github.com/features/copilot' },
  { name: 'Perplexity', logo: '🔍', desc: 'AI search engine that gives cited, accurate answers.', tags: ['research'], rating: 4.4, reviews: 5600, cat: 'research', url: 'https://www.perplexity.ai' },
  { name: 'Notion AI', logo: '📄', desc: 'Take notes, organise ideas, and generate content with built-in AI.', tags: ['productivity', 'writing'], rating: 4.4, reviews: 7800, cat: 'productivity', url: 'https://www.notion.so/product/ai' },
  { name: 'DeepL', logo: '🌐', desc: 'A highly accurate translator for French, German, Spanish and more.', tags: ['language'], rating: 4.8, reviews: 14000, cat: 'language', url: 'https://www.deepl.com' },
  { name: 'Replit', logo: '⚡', desc: 'Code, collaborate, and deploy in any language in the browser.', tags: ['coding'], rating: 4.3, reviews: 6200, cat: 'coding', url: 'https://replit.com' },
  { name: 'Anki', logo: '🧠', desc: 'Spaced-repetition flashcards used by top medical students.', tags: ['revision', 'productivity'], rating: 4.5, reviews: 9100, cat: 'productivity', url: 'https://apps.ankiweb.net' }
];

/* ---------- leaderboard peers: only real local accounts are shown */
const SEED_PEERS = [];

/* ---------- achievements (unlocked from real progress) ---------- */
const ACHIEVEMENTS = [
  { id: 'first', icon: '🎒', name: 'First Steps', desc: 'Create your account', goal: 1, progress: d => 1, test: d => true },
  { id: 'profile', icon: '✅', name: 'Ready to Learn', desc: 'Complete your study profile', goal: 1, progress: d => d.profile && d.profile.onboarded ? 1 : 0, test: d => d.profile && d.profile.onboarded },
  { id: 'quiz1', icon: '📝', name: 'Quiz Starter', desc: 'Complete your first quiz', goal: 1, progress: d => d.quizScores.length, test: d => d.quizScores.length >= 1 },
  { id: 'quiz5', icon: '🎯', name: 'Practice Builder', desc: 'Complete 5 quizzes', goal: 5, progress: d => d.quizScores.length, test: d => d.quizScores.length >= 5 },
  { id: 'bullseye', icon: '💯', name: 'Perfect Score', desc: 'Score 100% on a quiz', goal: 100, progress: d => Math.max(0, ...(d.quizScores || [0])), test: d => d.quizScores.some(s => s >= 100) },
  { id: 'cards5', icon: '🃏', name: 'Card Creator', desc: 'Create 5 flashcards', goal: 5, progress: d => d.flashcards.length, test: d => d.flashcards.length >= 5 },
  { id: 'cards25', icon: '🧠', name: 'Memory Architect', desc: 'Create 25 flashcards', goal: 25, progress: d => d.flashcards.length, test: d => d.flashcards.length >= 25 },
  { id: 'reviews50', icon: '📚', name: 'Recall Champion', desc: 'Review 50 flashcards', goal: 50, progress: d => totalReviews(d), test: d => totalReviews(d) >= 50 },
  { id: 'ai10', icon: '🤖', name: 'Curious Learner', desc: 'Ask the tutor 10 questions', goal: 10, progress: d => aiQuestionsTotal(d), test: d => aiQuestionsTotal(d) >= 10 },
  { id: 'ai50', icon: '💬', name: 'Deep Questioner', desc: 'Ask the tutor 50 questions', goal: 50, progress: d => aiQuestionsTotal(d), test: d => aiQuestionsTotal(d) >= 50 },
  { id: 'planner', icon: '📅', name: 'Planner', desc: 'Complete a study session', goal: 1, progress: d => d.sessions.filter(s => s.done).length, test: d => d.sessions.some(s => s.done) },
  { id: 'study300', icon: '⏱️', name: 'Five-Hour Focus', desc: 'Log 5 hours of study', goal: 300, progress: d => d.studyMins || 0, test: d => (d.studyMins || 0) >= 300 },
  { id: 'social', icon: '👋', name: 'Joined In', desc: 'Make a community post', goal: 1, progress: d => communityPostsByMe(), test: d => communityPostsByMe() >= 1 },
  { id: 'streak3', icon: '⚡', name: 'Warming Up', desc: 'Build a 3-day streak', goal: 3, progress: d => currentStreak(), test: d => currentStreak() >= 3 },
  { id: 'streak7', icon: '🔥', name: 'On Fire', desc: 'Build a 7-day streak', goal: 7, progress: d => currentStreak(), test: d => currentStreak() >= 7 },
  { id: 'level5', icon: '🏆', name: 'Level 5 Scholar', desc: 'Reach Level 5', goal: 5, progress: d => levelFor(d.xp), test: d => levelFor(d.xp) >= 5 },
  { id: 'level10', icon: '🚀', name: 'Level 10 Master', desc: 'Reach Level 10', goal: 10, progress: d => levelFor(d.xp), test: d => levelFor(d.xp) >= 10 }
];

/* ════════════════════════════════════════════════════════════
   Prompt library — generated to 200+ high-quality prompts
   across homework, revision, exam, writing, coding, research,
   productivity, study planner and AI business.
   ════════════════════════════════════════════════════════════ */
function buildPromptLibrary() {
  const list = [];
  let id = 1;
  const add = (title, cat, text, uses) => list.push({ id: id++, title, cat, text, uses: uses || (300 + ((id * 137) % 3200)) });
  const subs = SUBJECT_KEYS.map(k => SUBJECTS[k].title);

  subs.forEach(s => {
    add(`${s}: explain a concept simply`, 'homework', `You are an expert ${s} tutor for a GCSE student. Explain [TOPIC] in simple language with a real-world example, then check my understanding with 2 short questions.`);
    add(`${s}: step-by-step homework help`, 'homework', `I'm a GCSE ${s} student stuck on this homework question: [QUESTION]. Walk me through it step by step, explaining the reasoning at each step. Don't just give the answer — help me understand it.`);
    add(`${s}: check and improve my answer`, 'homework', `Here is my ${s} answer to [QUESTION]:\n[MY ANSWER]\nMark it as an examiner would, point out what's missing, and show me how to improve it.`);
    add(`${s}: turn my notes into Q&A`, 'homework', `Turn these ${s} notes into 8 question-and-answer pairs I can use to test myself:\n[PASTE NOTES]`);
  });
  subs.forEach(s => {
    add(`${s}: 10 flashcards`, 'revision', `Create 10 GCSE ${s} flashcards on [TOPIC]. Format each as FRONT: [question/term] and BACK: [concise answer]. Focus on points most likely to appear in exams.`);
    add(`${s}: one-page summary`, 'revision', `Summarise the GCSE ${s} topic [TOPIC] on a single page: key definitions, the 5 most important points, one worked example, and 3 common misconceptions.`);
    add(`${s}: memory hooks`, 'revision', `Give me mnemonics and memory tricks to remember [TOPIC] in ${s} at GCSE level.`);
    add(`${s}: rapid-fire quiz`, 'revision', `Quiz me on GCSE ${s} [TOPIC] with 10 rapid-fire questions, one at a time. Wait for my answer before revealing the next, and tell me if I'm right or wrong.`);
  });
  subs.forEach(s => {
    add(`${s}: model exam answer`, 'exam', `For this GCSE ${s} exam question: [QUESTION]\nShow (1) what the examiner is looking for, (2) the key points to include, (3) a full model answer, and (4) common mistakes to avoid.`);
    add(`${s}: mark scheme breakdown`, 'exam', `Explain how marks are awarded for this ${s} question worth [N] marks: [QUESTION]. Then write an answer that would score full marks.`);
    add(`${s}: predicted topics & plan`, 'exam', `Based on the GCSE ${s} specification, list the highest-value topics to revise for [EXAM BOARD], and suggest a focused one-week revision order.`);
  });
  subs.forEach(s => {
    add(`${s}: essay plan`, 'writing', `Help me plan a [WORD COUNT]-word ${s} essay on [TOPIC]. Give an introduction with a clear thesis, 3 body paragraphs with topic sentences and evidence, and a strong conclusion. I'm at GCSE level.`);
    add(`${s}: improve my paragraph`, 'writing', `Improve this ${s} paragraph for clarity, structure and exam vocabulary, keeping my voice:\n[PASTE PARAGRAPH]`);
    add(`${s}: stronger openings`, 'writing', `Give me 3 different strong opening sentences for a ${s} essay on [TOPIC], each using a different technique.`);
  });

  const coding = [
    ['Debug my Python code', `I'm a GCSE Computer Science student. My Python code has a bug:\n[PASTE CODE]\nFind the bug(s), explain what's wrong in simple terms, show the corrected code, and explain the fix.`],
    ['Explain this code line by line', `Explain what this code does, line by line, as if I'm new to programming:\n[PASTE CODE]`],
    ['Trace a program', `Trace through this program and show the value of each variable at every step:\n[PASTE CODE]\nInput: [INPUT]`],
    ['Pseudocode to Python', `Convert this pseudocode into working, well-commented Python:\n[PASTE PSEUDOCODE]`],
    ['Write Python from scratch', `Write a beginner-friendly Python program that [TASK]. Comment every line and explain the logic afterwards.`],
    ['Explain a sorting/search algorithm', `Explain the [bubble sort / binary search / linear search] algorithm with a simple analogy, a worked example, and its time complexity for GCSE.`],
    ['SQL query help', `Write an SQL query to [TASK] from a table called [TABLE] with columns [COLUMNS]. Explain each clause.`],
    ['Boolean logic explained', `Explain AND, OR and NOT gates with truth tables and a real-world example a GCSE student would understand.`],
    ['Flowchart from a description', `Turn this description into a clear flowchart (described in text/ASCII): [DESCRIPTION].`],
    ['Kind code review', `Review my code like a kind mentor. Point out 3 things I did well and 3 specific improvements:\n[PASTE CODE]`],
    ['Convert between number bases', `Show me, step by step, how to convert [NUMBER] from [base] to [base]. Then give me 3 practice questions.`],
    ['Explain an error message', `I got this error: [PASTE ERROR]. Explain in plain English what it means and the usual ways to fix it.`],
    ['Suggest a beginner project', `Suggest a small coding project to practise [SKILL], then outline the steps to build it for a beginner.`],
    ['Refactor for readability', `Refactor this code to be cleaner and easier to read, explaining each change:\n[PASTE CODE]`],
    ['Data structures explained', `Explain the difference between an array, a list and a dictionary with simple Python examples.`],
    ['Network terms made simple', `Explain LAN, WAN, IP address, router and packet using a simple analogy for GCSE CS.`],
    ['Cybersecurity basics', `Explain phishing, malware, and a brute-force attack, with one prevention tip each, at GCSE level.`],
    ['Comment my code', `Add clear, beginner-friendly comments to this code without changing how it works:\n[PASTE CODE]`],
    ['Write test cases', `Write a set of test cases (normal, boundary and erroneous) for a program that [TASK].`],
    ['Explain functions', `Explain what a function is, why we use them, and how parameters and return values work, with a Python example.`],
    ['Loops vs recursion', `Explain the difference between a loop and recursion using the same example solved both ways in Python.`],
    ['Design a database', `Help me design a simple relational database for [SCENARIO]: tables, fields, primary keys and relationships.`],
    ['HTML/CSS starter', `Give me clean starter HTML and CSS for a [TYPE] page, with comments explaining each part.`],
    ['Compare two solutions', `Compare two ways to solve [PROBLEM] and explain which is more efficient and why.`]
  ];
  coding.forEach(p => add(p[0], 'coding', p[1]));

  const research = [
    ['Summarise an article', `Summarise this article in 5 bullet points, then give me the single most important takeaway:\n[PASTE TEXT]`],
    ['Find both sides', `Give me the strongest arguments for AND against [TOPIC], then a balanced one-paragraph conclusion.`],
    ['Explain a study simply', `Explain this research/study to a 15-year-old: what they did, what they found, and why it matters:\n[PASTE OR DESCRIBE]`],
    ['Find reliable sources', `Suggest the types of reliable sources I should use to research [TOPIC], and how to tell if a source is trustworthy.`],
    ['Compare two things', `Compare [A] and [B] across [criteria] in a clear table, then summarise the key differences.`],
    ['Build a research plan', `Help me plan research for a project on [TOPIC]: key questions, subtopics, and an order to tackle them.`],
    ['Fact-check a claim', `Help me think critically about this claim: "[CLAIM]". What evidence would support or challenge it?`],
    ['Build a glossary', `Create a glossary of the 12 key terms I need to understand [TOPIC], each with a one-line definition.`],
    ['Timeline of events', `Create a clear timeline of the key events in [TOPIC], with one sentence on the significance of each.`],
    ['Note template from a video', `I watched a video on [TOPIC]. Give me a structured note template (headings + prompts) to capture the key ideas.`],
    ['Map cause and effect', `Map out the main causes and effects of [EVENT/TOPIC] in a clear, structured way.`],
    ['Explain a statistic', `Explain what this statistic really means and what it does NOT tell us: [STATISTIC].`],
    ['Primary vs secondary sources', `Explain the difference between primary and secondary sources with examples relevant to [SUBJECT].`],
    ['Sharpen a research question', `Is this a good research question? "[QUESTION]" — tell me how to make it sharper and more answerable.`],
    ['Prepare a counter-argument', `I believe [VIEW]. Give me the strongest counter-argument so I can prepare a response.`],
    ['Summarise to a word count', `Summarise the following to exactly [N] words, keeping the key meaning:\n[PASTE TEXT]`]
  ];
  research.forEach(p => add(p[0], 'research', p[1]));

  const productivity = [
    ['Beat procrastination', `I keep putting off [TASK]. Give me 5 practical, science-backed ways to actually get started today.`],
    ['Run a weekly review', `Help me run a weekly review: ask me about what went well, what didn't, and what to focus on next week.`],
    ['Design a focus routine', `Design a 2-hour focused study routine using the Pomodoro technique, including break activities.`],
    ['Prioritise my tasks', `Here is my to-do list:\n[LIST]\nHelp me prioritise it by urgency vs importance, and tell me what to do first.`],
    ['Build a study habit', `Help me build a daily revision habit. Suggest a tiny starting habit, a trigger, and a reward.`],
    ['Cut distractions', `Give me a realistic plan to study with fewer phone and social media distractions.`],
    ['Schedule by energy', `Suggest how to schedule hard vs easy subjects around my natural energy levels during the day.`],
    ['Beat overwhelm', `I feel overwhelmed by how much I have to revise. Help me break it into a calm, manageable plan.`],
    ['Morning routine', `Design a simple morning routine that sets me up for a productive study day.`],
    ['Be my focus coach', `Act as a focus coach for the next 25 minutes: give me one task and check in at the end.`],
    ['Track my progress', `Suggest a simple, motivating way to track my revision progress each day.`],
    ['Get into deep focus', `What should I do in the 5 minutes before a study session to get into deep focus quickly?`],
    ['Quick break ideas', `Give me 8 refreshing 5-minute break ideas that won't pull me into a long distraction.`],
    ['Make a goal specific', `Help me turn my vague goal "[GOAL]" into a specific, measurable plan with deadlines.`],
    ['Stop perfectionism', `I get stuck making notes perfect. Give me a faster, "good enough" note-taking approach.`],
    ['End-of-day shutdown', `Design a 5-minute end-of-study shutdown routine so I can switch off and rest.`]
  ];
  productivity.forEach(p => add(p[0], 'productivity', p[1]));

  const planner = [
    ['2-week revision plan', `Create a 2-week GCSE revision plan. My subjects: [SUBJECTS]. My weakest: [WEAK]. I can study [HOURS] hours per day. Balance subjects and include rest.`],
    ['Plan around exam dates', `My exams are: [SUBJECT — DATE], [SUBJECT — DATE]. Build a revision timetable working backwards from each date.`],
    ['Plan today', `Build a realistic study schedule for today between [START] and [END], with breaks, for these tasks: [TASKS].`],
    ['Catch-up plan', `I'm behind in [SUBJECT]. Make a focused catch-up plan to cover [TOPICS] in [DAYS] days.`],
    ['Balanced weekly timetable', `Create a balanced weekly revision timetable for [SUBJECTS], spreading topics evenly with one rest day.`],
    ['Last-minute plan', `I have [N] days until my [SUBJECT] exam and haven't started. Give me an emergency but realistic plan.`],
    ['Topic checklist', `Turn the [SUBJECT] specification into a tick-box checklist of topics so I can track what's done.`],
    ['Interleave subjects', `Help me interleave [SUBJECTS] across the week so I'm not doing the same subject two days running.`],
    ['Revision + wellbeing', `Plan a study week that protects my sleep, includes exercise, and still covers [SUBJECTS].`],
    ['Set session goals', `Before I start studying [TOPIC], help me set 3 clear goals for this single session.`],
    ['Weekend deep dive', `Plan a weekend deep-dive on my weakest topic [TOPIC], with sessions, breaks and a final self-test.`],
    ['Spaced repetition schedule', `Build a spaced-repetition review schedule for these topics I just learned: [TOPICS].`],
    ['Estimate and order tasks', `How long should each of these tasks realistically take, and how should I order them? [TASKS]`],
    ['Exam-week routine', `Design a calm daily routine for exam week that balances last revision with rest and good food.`]
  ];
  planner.forEach(p => add(p[0], 'planner', p[1]));

  const business = [
    ['Validate an idea', `I have a business idea: [IDEA]. Ask me 5 sharp questions to test whether it solves a real problem.`],
    ['Name my project', `Suggest 10 memorable names for a [TYPE] project about [THEME], with a one-line reason for each.`],
    ['Write an elevator pitch', `Help me write a 30-second elevator pitch for [IDEA] aimed at [AUDIENCE].`],
    ['Plan market research', `What should I research before starting [IDEA]? List the key questions and where to find answers.`],
    ['One-page business plan', `Draft a one-page plan for [IDEA]: problem, solution, audience, how it makes money, first 3 steps.`],
    ['Student side-hustle ideas', `Suggest 8 realistic side-hustle ideas for a student with skills in [SKILLS] and [HOURS] hours a week.`],
    ['Think through pricing', `Help me think through pricing for [PRODUCT/SERVICE]. What factors matter and what are sensible options?`],
    ['Social content plan', `Create a 2-week content plan to promote [PROJECT] on [PLATFORM], with post ideas and a posting rhythm.`],
    ['Build a customer persona', `Build a detailed customer persona for [PRODUCT]: who they are, goals, frustrations, and where to reach them.`],
    ['Cold outreach message', `Write a short, friendly outreach message to [TYPE OF PERSON] about [GOAL]. Keep it human, not salesy.`],
    ['Scan competitors', `Help me analyse competitors for [IDEA]: what to look at, and how to find a gap I can fill.`],
    ['Landing page copy', `Write clear landing-page copy for [PRODUCT]: a headline, subheadline, 3 benefits, and a call to action.`],
    ['Define an MVP', `Help me define the smallest version of [IDEA] I could build first to test it. What's in, what's out?`],
    ['Define a brand voice', `Define a brand voice for [PROJECT] aimed at [AUDIENCE]: 3 adjectives, do's and don'ts, and an example sentence.`],
    ['Outline a pitch deck', `Outline a 10-slide pitch deck for [IDEA], with the one key message for each slide.`],
    ['Get useful feedback', `Give me 6 questions to ask early users of [PRODUCT] to get honest, useful feedback.`],
    ['Path to first customer', `For [IDEA], map the fastest realistic path from today to a first paying customer.`],
    ['Check the risks', `What are the main risks of starting [IDEA] as a student, and how could I reduce each one?`]
  ];
  business.forEach(p => add(p[0], 'business', p[1]));

  const extras = [
    ['Make a study playlist plan', 'productivity', `Suggest what kind of music or sounds help focus for different tasks (reading, problem-solving, memorising), and why.`],
    ['Exam-day checklist', 'exam', `Give me a calm exam-day checklist: what to bring, what to eat, and a 3-minute routine to settle nerves before I start.`],
    ['Handle exam stress', 'productivity', `I'm anxious about my exams. Give me practical, healthy ways to manage stress while still revising effectively.`],
    ['Revise with no motivation', 'revision', `I have zero motivation to revise today. Give me the smallest possible first step and a gentle plan to build momentum.`],
    ['Explain my mistake', 'homework', `I got this question wrong: [QUESTION]. My answer was [MY ANSWER]. Explain exactly why it's wrong and what the right thinking is.`],
    ['Make a revision poster', 'revision', `Design (in text) a one-page revision poster for [TOPIC]: the layout, the key facts to include, and a memorable visual idea.`],
    ['Quick confidence check', 'exam', `Ask me 5 mixed questions on [SUBJECT] to gauge how ready I am, then tell me what to focus on next.`],
    ['Plan a group study session', 'planner', `Help me plan a productive 90-minute group study session on [TOPIC] for [N] people, with clear roles and activities.`]
  ];
  extras.forEach(p => add(p[0], p[1], p[2]));

  return list;
}
const PROMPTS = buildPromptLibrary();

/* ════════════════════════════════════════════════════════════
   GCSE content structure (Phase 8)
   GENERIC, exam-board-neutral study scaffolding only. This is NOT
   aligned to any specific exam board and deliberately avoids
   board-specific claims. Sample cards use widely-accepted facts and
   are clearly marked as samples in the UI.
   ════════════════════════════════════════════════════════════ */
const CONTENT_NOTE = 'General GCSE revision: generic practice material, not aligned to any specific exam board. Always check your own exam board specification (for example AQA, Edexcel, OCR, WJEC) for exact content and wording.';

const GCSE_CONTENT = {
  maths: {
    focus: 'Most GCSE maths papers test number, algebra, ratio and proportion, geometry, probability and statistics.',
    moves: ['Practise both with and without a calculator.', 'Always show your working - method marks add up.', 'Redo questions you got wrong a week later.'],
    samples: [
      { front: 'What is the quadratic formula?', back: 'x = (-b ± √(b² - 4ac)) / 2a, for ax² + bx + c = 0.' },
      { front: 'Area of a circle?', back: 'A = πr².' },
      { front: 'Pythagoras\u2019 theorem?', back: 'a² + b² = c² for a right-angled triangle.' }
    ]
  },
  english: {
    focus: 'In GCSE English most marks come from how well you analyse and structure, not only what you know.',
    moves: ['Always link a quotation to its effect on the reader.', 'Plan for a few minutes before writing an essay.', 'Learn a small set of flexible quotations really well.'],
    samples: [
      { front: 'What is a metaphor?', back: 'A direct comparison saying one thing is another, without "like" or "as".' },
      { front: 'What is personification?', back: 'Giving human qualities to something non-human.' },
      { front: 'What does PEE stand for?', back: 'Point, Evidence, Explanation - a paragraph structure (sometimes PEEL with Link).' }
    ]
  },
  science: {
    focus: 'Across biology, chemistry and physics, examiners reward precise definitions and correct use of key words and units.',
    moves: ['Learn the unit for every quantity (for example force in newtons).', 'Know the required practicals and their variables.', 'Label diagrams from memory.'],
    samples: [
      { front: 'What is the unit of force?', back: 'The newton (N).' },
      { front: 'Which organelle is the "powerhouse of the cell"?', back: 'The mitochondria.' },
      { front: 'What is osmosis?', back: 'The movement of water across a partially permeable membrane, from higher to lower water concentration.' }
    ]
  },
  geography: {
    focus: 'GCSE geography rewards named examples and case studies you can both describe and explain.',
    moves: ['Learn one or two case studies per topic in depth.', 'Practise describing patterns from maps and graphs.', 'Use cause-and-effect connectives like "this leads to".'],
    samples: [
      { front: 'What causes most earthquakes?', back: 'Movement at tectonic plate boundaries.' },
      { front: 'What happens at a constructive plate margin?', back: 'Plates move apart and new crust forms.' },
      { front: 'Where does a river deposit most of its load?', back: 'Near its mouth, where the river slows down.' }
    ]
  },
  history: {
    focus: 'GCSE history is about supported judgement: accurate facts plus explanation of their significance.',
    moves: ['Memorise key dates and a few precise facts per topic.', 'Practise the "how far do you agree" structure.', 'For sources, weigh content, origin and purpose.'],
    samples: [
      { front: 'In which year did the Second World War begin in Europe?', back: '1939.' },
      { front: 'Which treaty was signed after the First World War?', back: 'The Treaty of Versailles (1919).' },
      { front: 'The Cold War was mainly between which two powers?', back: 'The USA and the USSR.' }
    ]
  },
  cs: {
    focus: 'GCSE computer science mixes theory of how computers work with computational thinking and some programming.',
    moves: ['Practise tracing code by hand.', 'Learn definitions precisely (algorithm, variable, RAM).', 'Convert between binary, denary and hex until it is automatic.'],
    samples: [
      { front: 'What is an algorithm?', back: 'A step-by-step set of instructions to solve a problem.' },
      { front: 'What does RAM do?', back: 'It is volatile working memory holding data and programs currently in use.' },
      { front: 'When is an AND gate true?', back: 'Only when both inputs are true.' }
    ]
  },
  french: {
    focus: 'GCSE French rewards accurate verbs, a range of tenses, and opinions backed by reasons.',
    moves: ['Master the present, past (passé composé) and future tenses.', 'Learn opinion phrases plus "parce que" reasons.', 'Do a little listening practice often.'],
    samples: [
      { front: '"I have" in French?', back: "J'ai (from avoir)." },
      { front: '"School" in French?', back: 'une école.' },
      { front: '"Hello" in French?', back: 'Bonjour.' }
    ]
  },
  german: {
    focus: 'GCSE German rewards correct cases, word order, and a range of tenses.',
    moves: ['Learn the case tables (nominative, accusative, dative).', 'Remember the verb-second rule in main clauses.', 'Build opinion phrases with reasons.'],
    samples: [
      { front: '"Thank you" in German?', back: 'Danke.' },
      { front: 'What is the accusative case used for?', back: 'The direct object.' },
      { front: '"I am called..." in German?', back: 'Ich heiße...' }
    ]
  }
};
