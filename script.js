// Global State
let appData = JSON.parse(localStorage.getItem('matcherData')) || {};
let gamePool = [];      
let activeFive = [];    
let selectedCn = null;  
let selectedEn = null;  
let mistakePool = [];

// 1. Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
    }
    if (screenId === 'screen-landing') renderTopicList();
}

// 2. Save Topic (Bulk Paste Logic)
function saveTopic() {
    const nameInput = document.getElementById('topic-name-input');
    const bulkInput = document.getElementById('bulk-input');
    
    const name = nameInput.value.trim();
    const bulkText = bulkInput.value.trim();

    if (!name || !bulkText) return alert("Please enter a Topic Name and paste some words.");

    const words = bulkText.split('\n').map(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            return {
                en: parts[0].trim(),
                cn: parts[1].trim(),
                py: parts[2] ? parts[2].trim() : "" 
            };
        }
        return null;
    }).filter(w => w !== null);

    if (words.length === 0) return alert("Format error. Use: English, Chinese, Pinyin");

    appData[name] = { wordList: words };
    localStorage.setItem('matcherData', JSON.stringify(appData));
    
    // Reset inputs
    nameInput.value = "";
    bulkInput.value = "";
    showScreen('screen-landing');
}

// 3. Delete Topic
function deleteTopic(name) {
    if (confirm(`Delete "${name}"?`)) {
        delete appData[name];
        localStorage.setItem('matcherData', JSON.stringify(appData));
        renderTopicList();
    }
}

// 4. Main Menu List
function renderTopicList() {
    const list = document.getElementById('topic-list');
    if (!list) return;
    list.innerHTML = "";
    
    Object.keys(appData).forEach(name => {
        const row = document.createElement('div');
        row.style.display = "flex";
        row.style.gap = "10px";
        row.style.marginBottom = "10px";
        row.style.alignItems = "center";
        
        const btn = document.createElement('button');
        btn.className = "topic-btn";
        btn.style.flex = "1";
        btn.innerText = name;
        btn.onclick = () => startGame(name);
        
        const delBtn = document.createElement('button');
        delBtn.innerText = "🗑️";
        delBtn.style.padding = "10px";
        delBtn.style.cursor = "pointer";
        delBtn.style.background = "#ffeded";
        delBtn.style.border = "1px solid #ffcccc";
        delBtn.style.borderRadius = "5px";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteTopic(name);
        };

        row.appendChild(btn);
        row.appendChild(delBtn);
        list.appendChild(row);
    });
}

// 5. Game Engine
function startGame(name) {
    // Mobile Audio Wakeup
    const wakeup = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(wakeup);

    const topic = appData[name];
    gamePool = topic.wordList ? [...topic.wordList] : [];
    mistakePool = [];
    
    document.getElementById('current-topic-title').innerText = name;
    showScreen('screen-game');
    loadNextFive();
}

function loadNextFive() {
    activeFive = gamePool.slice(0, 5);
    document.getElementById('words-remaining').innerText = gamePool.length;
    renderBoard();
}

function renderBoard() {
    const cnCol = document.getElementById('column-cn');
    const enCol = document.getElementById('column-en');
    if (!cnCol || !enCol) return;
    
    cnCol.innerHTML = ""; 
    enCol.innerHTML = "";

    const shuffledCn = [...activeFive].sort(() => Math.random() - 0.5);
    const shuffledEn = [...activeFive].sort(() => Math.random() - 0.5);

    shuffledCn.forEach(word => {
        const btn = document.createElement('div');
        btn.className = "match-btn";
        btn.innerHTML = `<span class="cn-text">${word.cn}</span><br><small class="py-text">${word.py}</small>`;
        btn.onclick = () => handleSelect(word, btn, 'cn');
        cnCol.appendChild(btn);
    });

    shuffledEn.forEach(word => {
        const btn = document.createElement('div');
        btn.className = "match-btn";
        btn.innerText = word.en;
        btn.onclick = () => handleSelect(word, btn, 'en');
        enCol.appendChild(btn);
    });
}

function handleSelect(wordObj, btn, type) {
    const muteEnglish = document.getElementById('mute-english-game').checked;

    if (type === 'cn') {
        selectedCn = { word: wordObj, el: btn };
        speak(wordObj.cn, 'zh-CN');
        highlight('column-cn', btn);
    } else {
        selectedEn = { word: wordObj, el: btn };
        if (!muteEnglish) speak(wordObj.en, 'en-US');
        highlight('column-en', btn);
    }

    if (selectedCn && selectedEn) {
        if (selectedCn.word.en === selectedEn.word.en) {
            gamePool = gamePool.filter(w => w.en !== selectedCn.word.en);
            selectedCn.el.classList.add('correct');
            selectedEn.el.classList.add('correct');
            resetSelection(true);
        } else {
            selectedCn.el.classList.add('wrong');
            selectedEn.el.classList.add('wrong');
            
            if (!mistakePool.find(w => w.en === selectedCn.word.en)) {
                mistakePool.push(selectedCn.word);
            }
            
            gamePool = gamePool.filter(w => w.en !== selectedCn.word.en);
            gamePool.push(selectedCn.word); 
            resetSelection(false);
        }
    }
}

function resetSelection(isMatch) {
    setTimeout(() => {
        if (isMatch) {
            if (gamePool.length === 0) {
                showEndMenu();
            } else if (document.querySelectorAll('.correct').length / 2 === activeFive.length) {
                loadNextFive();
            }
        }
        selectedCn = null;
        selectedEn = null;
        document.querySelectorAll('.match-btn').forEach(b => b.classList.remove('selected', 'wrong'));
    }, 600);
}

function showEndMenu() {
    if (mistakePool.length > 0) {
        if (confirm(`Finished! You had ${mistakePool.length} mistakes. Replay them?`)) {
            gamePool = [...mistakePool];
            mistakePool = [];
            loadNextFive();
            return;
        }
    }
    showScreen('screen-landing');
}

function speak(text, lang) {
    window.speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(text);
    ut.rate = 1.2;
    const voices = window.speechSynthesis.getVoices();
    if (lang === 'zh-CN') {
        const zh = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'));
        if (zh) ut.voice = zh;
    }
    ut.lang = lang;
    window.speechSynthesis.speak(ut);
}

function highlight(colId, btn) {
    document.getElementById(colId).querySelectorAll('.match-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

// 6. Initializing with safety check
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
        
        // Final safety for appData
        if (typeof appData !== 'object' || appData === null) {
            appData = {};
        }

        renderTopicList();
        console.log("App Ready");
    } catch (e) {
        console.error("Boot error:", e);
    }
});