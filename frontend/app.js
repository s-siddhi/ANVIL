console.log("ANVIL SECURE SYSTEM ONLINE");

let currentUser = localStorage.getItem("anvil_user"); 

const authSection = document.getElementById('auth-section');
const dashboardContent = document.getElementById('dashboard-content');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

// --- LOGOUT LOGIC ---
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem("anvil_user");
    currentUser = null;
    logoutBtn.style.display = "none";
    dashboardContent.style.display = "none";
    authSection.style.display = "block";
    document.getElementById('auth-username').value = "";
    document.getElementById('auth-password').value = "";
});

// --- AUTHENTICATION LOGIC ---
document.getElementById('signup-btn').addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    if (!u || !p) return;
    
    try {
        const res = await fetch("https://anvil-backend-1ciy.onrender.com/api/signup", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        });
        if (res.ok) { 
            authError.style.color = "#e6e4d8"; 
            authError.textContent = "Account created. Please log in."; 
        } else { 
            const err = await res.json(); authError.style.color = "#ef4444"; authError.textContent = err.detail; 
        }
    } catch (e) { authError.textContent = "Cannot connect to server. Is Python running?"; }
});

document.getElementById('login-btn').addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    if (!u || !p) return;
    
    try {
        const res = await fetch("https://anvil-backend-1ciy.onrender.com/api/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        });
        if (res.ok) {
            currentUser = u;
            localStorage.setItem("anvil_user", currentUser);
            bootDashboard(); 
        } else { 
            authError.style.color = "#ef4444"; authError.textContent = "Invalid credentials. Access Denied."; 
        }
    } catch (e) { authError.textContent = "Cannot connect to server. Is Python running?"; }
});

// ==========================================
// BOOT SEQUENCE
// ==========================================
async function bootDashboard() {
    if (!currentUser) {
        authSection.style.display = "block";
        dashboardContent.style.display = "none";
        return;
    }

    try {
        const response = await fetch("https://anvil-backend-1ciy.onrender.com/api/dashboard", {
            headers: { "x-user": currentUser } 
        });

        if (response.status === 401) {
            localStorage.removeItem("anvil_user");
            currentUser = null;
            bootDashboard();
            return;
        }

        const db = await response.json();
        
        authSection.style.display = "none";
        dashboardContent.style.display = "grid";
        logoutBtn.style.display = "block"; // Show Logout button

        tasksList.innerHTML = ""; 
        db.tasks.forEach(task => renderTaskOnScreen(task.text, task.is_completed));

        totalCalories = db.nutrition.cals; totalProtein = db.nutrition.pro;
        targetCalories = db.nutrition.target_cals; targetProtein = db.nutrition.target_pro;

        totalCalsDisplay.textContent = totalCalories; totalProteinDisplay.textContent = totalProtein;
        targetCalsDisplay.textContent = targetCalories; targetProteinDisplay.textContent = targetProtein;

        historyData = db.history; matrixData = db.matrix;
        renderDailyMirror(); renderConsistencyMatrix();
    } catch (error) { 
        console.error("Failed to boot database:", error); 
        // Solves the blank screen glitch if Python is off
        authSection.style.display = "block";
        authError.style.color = "#ef4444"; 
        authError.textContent = "Cannot connect to server. Make sure Python is running.";
    }
}

// ==========================================
// SECTION 1: DAILY TASKS (WITH NEW SYNC SYSTEM)
// ==========================================
const taskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');

// NEW: Reads the screen and syncs it straight to Python
async function syncTasks() {
    const tasks = [];
    document.querySelectorAll('.task-row').forEach(row => {
        const text = row.querySelector('.task-text').textContent;
        const isCompleted = row.querySelector('input[type="checkbox"]').checked;
        tasks.push({ text: text, is_completed: isCompleted });
    });
    
    try {
        await fetch("https://anvil-backend-1ciy.onrender.com/api/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-user": currentUser },
            body: JSON.stringify(tasks)
        });
    } catch(e) { console.error("Sync failed", e); }
}

function renderTaskOnScreen(taskText, isCompleted) {
    const row = document.createElement('div');
    row.classList.add('task-row');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCompleted;
    checkbox.style.cursor = 'pointer';

    const label = document.createElement('span');
    label.textContent = taskText;
    label.classList.add('task-text'); 
    if (isCompleted) label.classList.add('completed');

    checkbox.addEventListener('change', function() {
        if (this.checked) { label.classList.add('completed'); } 
        else { label.classList.remove('completed'); }
        syncTasks(); // Instantly tell Python the box was checked/unchecked
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', function() { 
        row.remove(); 
        syncTasks(); // Instantly tell Python the task was deleted
    });

    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(deleteBtn);
    tasksList.appendChild(row);
}

addTaskBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (text !== "") { 
        renderTaskOnScreen(text, false); 
        syncTasks(); // Instantly save the new task to Python
        taskInput.value = ""; 
    }
});

taskInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        const text = taskInput.value.trim();
        if (text !== "") { 
            renderTaskOnScreen(text, false); 
            syncTasks();
            taskInput.value = ""; 
        }
    }
});

// ==========================================
// SECTION 2: NUTRITION TRACKER LOGIC
// ==========================================
let totalCalories = 0; let totalProtein = 0;
let targetCalories = 0; let targetProtein = 0; 

const caloriesInput = document.getElementById('calories-input');
const proteinInput = document.getElementById('protein-input');
const logMacrosBtn = document.getElementById('log-macros-btn');
const totalCalsDisplay = document.getElementById('total-cals');
const totalProteinDisplay = document.getElementById('total-protein');

const targetCalsInput = document.getElementById('set-target-cals');
const targetProteinInput = document.getElementById('set-target-protein');
const saveTargetsBtn = document.getElementById('save-targets-btn');
const targetCalsDisplay = document.getElementById('target-cals-display');
const targetProteinDisplay = document.getElementById('target-protein-display');

saveTargetsBtn.addEventListener('click', () => {
    targetCalories = Number(targetCalsInput.value) || 0;
    targetProtein = Number(targetProteinInput.value) || 0;
    targetCalsDisplay.textContent = targetCalories;
    targetProteinDisplay.textContent = targetProtein;
    targetCalsInput.value = ""; targetProteinInput.value = "";
});

logMacrosBtn.addEventListener('click', () => {
    const addedCalories = Number(caloriesInput.value) || 0;
    const addedProtein = Number(proteinInput.value) || 0;
    if (addedCalories === 0 && addedProtein === 0) return;

    totalCalories += addedCalories; totalProtein += addedProtein;
    totalCalsDisplay.textContent = totalCalories;
    totalProteinDisplay.textContent = totalProtein; 
    caloriesInput.value = ""; proteinInput.value = "";
});

// ==========================================
// SECTION 3 & 4: MIRROR & MATRIX LOGIC
// ==========================================
const historyList = document.getElementById('history-list');
const githubGrid = document.getElementById('github-grid');

let historyData = []; 
let matrixData = new Array(28).fill(0); 

function renderDailyMirror() {
    historyList.innerHTML = ""; 
    if (historyData.length === 0) {
        historyList.innerHTML = "<p style='color: #666666; font-size: 0.9rem; font-style: italic;'>No history logged yet. Execute today to build your ledger.</p>";
        return;
    }
    historyData.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('history-day');
        dayDiv.innerHTML = `<span class="history-date">${day.date}</span><span class="history-score">${day.score}</span>`;
        const ul = document.createElement('ul');
        ul.classList.add('history-items');
        day.tasks.forEach(task => {
            const li = document.createElement('li');
            li.classList.add('history-item'); 
            if(task.is_completed) li.classList.add('completed');
            else li.classList.add('failed');
            li.textContent = task.text;
            ul.appendChild(li);
        });
        historyList.appendChild(dayDiv);
        historyList.appendChild(ul);
    });
}

function renderConsistencyMatrix() {
    githubGrid.innerHTML = ""; 
    matrixData.forEach(level => {
        const square = document.createElement('div');
        square.classList.add('grid-square', `level-${level}`);
        githubGrid.appendChild(square);
    });
}

bootDashboard();