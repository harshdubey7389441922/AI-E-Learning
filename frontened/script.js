/***********************
  AUTH CHECK ON LOAD
************************/
window.onload = () => {
  const token = localStorage.getItem("token");
  token ? showApp() : showAuth();
};

function showApp() {
  document.getElementById("authBox").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("logoutBtn").style.display = "block";

  // Set user info
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  document.getElementById("userName").innerText = user.name || "User";
  document.getElementById("userEmail").innerText = user.email || "";
}


function showAuth() {
  authBox.style.display = "block";
  mainApp.style.display = "none";
  logoutBtn.style.display = "none";
}

function logout() {
  localStorage.removeItem("token");
  showAuth();
}

/***********************
  THEME TOGGLE
************************/
const body = document.body;
const toggleBtn = document.getElementById("themeToggle");

const savedTheme = localStorage.getItem("theme") || "dark";
body.classList.add(savedTheme);
toggleBtn.innerText = savedTheme === "dark" ? "🌙" : "🌞";

toggleBtn.onclick = () => {
  body.classList.toggle("dark");
  body.classList.toggle("light");
  const theme = body.classList.contains("dark") ? "dark" : "light";
  toggleBtn.innerText = theme === "dark" ? "🌙" : "🌞";
  localStorage.setItem("theme", theme);
};

/***********************
  AI SEARCH
************************/
let lastAnswer = "", lastTopic = "";

async function askAI() {
  const q = question.value.trim();
  if (!q) return alert("Enter topic");

  answerCard.classList.remove("hidden");
  answer.innerText = "✨ Generating...";

  const res = await fetch("https://ai-e-learning-6nqn.onrender.com/ask-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ question: q })
  });

  if (res.status === 401) return logout();

  const data = await res.json();
  lastAnswer = data.answer;
  lastTopic = q;
  answer.innerText = data.answer;
}

function closeAnswer() {
  answerCard.classList.add("hidden");
}

/***********************
  PDF
************************/
async function downloadPDF() {
  if (!lastAnswer) return alert("Search topic first");

  const res = await fetch("https://ai-e-learning-6nqn.onrender.com/download-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ topic: lastTopic, content: lastAnswer })
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${lastTopic}.pdf`;
  a.click();
}

/***********************
  CHATBOT
************************/
const chatbot = document.querySelector(".chatbot");
const chatHeader = document.querySelector(".chat-header");
const chatMessages = document.getElementById("chatMessages");

let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
chatHistory.forEach(m => showMessage(m.role, m.content));

function toggleChat() {
  chatbot.classList.toggle("minimized");
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  showMessage("user", text);
  chatHistory.push({ role: "user", content: text });
  chatInput.value = "";

  const thinking = showMessage("assistant", "Thinking... 🤖");

  try {
    const res = await fetch("https://ai-e-learning-6nqn.onrender.com/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ messages: chatHistory })
    });

    const data = await res.json();
    thinking.remove();
    showMessage("assistant", data.reply);
    chatHistory.push({ role: "assistant", content: data.reply });
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  } catch {
    thinking.innerText = "❌ Error";
  }
}

function showMessage(role, text) {
  const div = document.createElement("div");
  div.className = "message " + (role === "user" ? "user" : "bot");
  div.innerText = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function clearChat(e) {
  e.stopPropagation();
  chatHistory = [];
  localStorage.removeItem("chatHistory");
  chatMessages.innerHTML = "";
}

/***********************
  CHATBOT DRAGGABLE
************************/
let isDragging = false, offsetX = 0, offsetY = 0;

chatHeader.addEventListener("mousedown", e => {
  isDragging = true;
  offsetX = e.clientX - chatbot.offsetLeft;
  offsetY = e.clientY - chatbot.offsetTop;
});

document.addEventListener("mousemove", e => {
  if (!isDragging) return;

  chatbot.style.left = e.clientX - offsetX + "px";
  chatbot.style.top = e.clientY - offsetY + "px";
  chatbot.style.right = "auto";
  chatbot.style.bottom = "auto";
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});


/***********************
  QUIZ
************************/
let quizData = [];

async function generateQuiz() {
  const topic = document.getElementById("quizTopic").value.trim();
  const difficulty = document.getElementById("difficulty").value;
  const count = parseInt(document.getElementById("questionCount").innerText, 10);

  if (!topic) return alert("Enter topic");
  if (!count || count < 1) return alert("Invalid number of questions");

  const res = await fetch("https://ai-e-learning-6nqn.onrender.com/generate-quiz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({
      topic,
      difficulty,
      count
    })
  });

  const data = await res.json();
  quizData = data.quiz;
  renderQuiz();
}

function changeCount(delta) {
  const countSpan = document.getElementById("questionCount");
  let current = parseInt(countSpan.innerText, 10);

  current += delta;

  if (current < 1) current = 1;
  if (current > 20) current = 20;

  countSpan.innerText = current;
}



function renderQuiz() {
  quizContainer.innerHTML = "";

  quizData.forEach((q, i) => {
    quizContainer.innerHTML += `
      <div class="question">
        <h4>${i + 1}. ${q.question}</h4>
        ${q.options.map(o => `
          <div class="option-row">
            <input type="radio" name="q${i}" value="${o.key}">
            <label>${o.key}. ${o.text}</label>
          </div>`).join("")}
      </div>`;
  });

  submitQuizBtn.style.display = "block";
}

function submitQuiz() {
  let score = 0;
  let weak = {};

  quizData.forEach((q, i) => {
    document.querySelectorAll(`input[name="q${i}"]`).forEach(opt => {
      const label = opt.nextElementSibling;
      if (opt.value === q.correct) label.classList.add("correct");
      if (opt.checked && opt.value !== q.correct) {
        label.classList.add("wrong");
        weak[q.concept] = true;
      }
      if (opt.checked && opt.value === q.correct) score++;
      opt.disabled = true;
    });
  });

  const weakTopics = Object.keys(weak);

  quizResult.innerHTML = `
    <div class="result-card">
      <h3>Score: ${score}/${quizData.length}</h3>
      <p><b>Weak Areas:</b> ${weakTopics.join(", ") || "None 🎉"}</p>
      ${weakTopics.length ? `
        <h4>📚 Recommended Courses</h4>
        <ul>
          ${weakTopics.map(t =>
            `<li><a href="https://www.coursera.org/search?query=${t}" target="_blank">${t} course</a></li>`
          ).join("")}
        </ul>` : ""}
    </div>`;
}
function closeQuiz() {
  // Clear quiz questions
  const quizContainer = document.getElementById("quizContainer");
  const quizResult = document.getElementById("quizResult");
  const submitBtn = document.getElementById("submitQuizBtn");

  quizContainer.innerHTML = "";
  quizResult.innerHTML = "";
  submitBtn.style.display = "none";

  // Clear quizData so old quiz doesn't stay in memory
  quizData = [];

  // Optional: clear topic input
  document.getElementById("quizTopic").value = "";
}


/***********************
  AUTH
************************/
let isLogin = true;

function toggleAuth() {
  isLogin = !isLogin;

  document.getElementById("authTitle").innerText =
    isLogin ? "Login" : "Sign Up";

  document.getElementById("authBtn").innerText =
    isLogin ? "Login" : "Create Account";

  document.getElementById("nameInput").style.display =
    isLogin ? "none" : "block";

  document.getElementById("authToggleText").innerHTML =
    isLogin
      ? `Don’t have an account? <span>Sign up</span>`
      : `Already have an account? <span>Login</span>`;
    
}

async function handleAuth() {
  const name = nameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;

  const url = isLogin
    ? "https://ai-e-learning-6nqn.onrender.com/login"
    : "https://ai-e-learning-6nqn.onrender.com/signup";

  const body = isLogin ? { email, password } : { name, email, password };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user)); // save user info
    showApp();
  } else {
    alert(data.error || data.message);
  }
}


function forgetPassword() {
  const email = prompt("Enter your email for password reset:");

  if (!email) {
    alert("Email is required!");
    return;
  }

  // Dummy flow (replace with backend API in real app)
  alert(`If ${email} exists, your password has been reset successfully!`);
}

const notesIcon = document.getElementById("notesIcon");
const notesPanel = document.getElementById("notesPanel");
const notesTextarea = document.getElementById("notesTextarea");

function toggleNotes() {
  notesPanel.classList.toggle("hidden");
  if (!notesPanel.classList.contains("hidden")) loadNotes();
}

function closeNotes() {
  notesPanel.classList.add("hidden");
}

// Load notes from server
async function loadNotes() {
  const res = await fetch("https://ai-e-learning-6nqn.onrender.com/notes", {
    headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
  });
  if (res.status === 401) return logout();
  const data = await res.json();
  notesTextarea.value = data.content || "";
}

// Save notes to server
async function saveNotes() {
  const content = notesTextarea.value;
  const res = await fetch("https://ai-e-learning-6nqn.onrender.com/notes", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (data.success) alert("Notes saved successfully ✅");
}

const micBtn = document.getElementById("micBtn");
let recognition;

if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const speech = event.results[0][0].transcript;
    document.getElementById("chatInput").value = speech;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    alert("Voice recognition error: " + event.error);
  };

  recognition.onend = () => {
    micBtn.innerText = "🎤"; // reset icon
  };
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice not supported in this browser";
}

function startVoice() {
  if (!recognition) return;

  micBtn.innerText = "🎙 Listening...";
  recognition.start();
}

/***********************
  TYPEWRITER EFFECT
************************/
const text = "📘 AI E-Learning Platform";
let i = 0;
const speed = 100;

function typeWriter() {
  if (i < text.length) {
    document.getElementById("typewriter").innerHTML += text.charAt(i);
    i++;
    setTimeout(typeWriter, speed);
  }
}

window.addEventListener("load", typeWriter);


let quizCount = 5;

function changeCount(value) {
  quizCount += value;
  if (quizCount < 5) quizCount = 5;
  if (quizCount > 20) quizCount = 20;
  document.getElementById("questionCount").innerText = quizCount;
}


function togglePassword() {
  const passInput = document.getElementById("passwordInput");
  const eye = document.querySelector(".toggle-eye");

  if (passInput.type === "password") {
    passInput.type = "text";
    eye.innerText = "🐵";
  } else {
    passInput.type = "password";
    eye.innerText = "🙈";
  }
}
