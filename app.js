const DURATION_MS = 90 * 60 * 1000;
const PASS_PERCENTAGE = 50;
const TOPICS = {
  architecture: "IoT foundations & applications",
  hardware: "Sensors, hardware & programming",
  networking: "Networking & wireless",
  cloud: "MQTT, cloud & data",
  security: "Security, design & projects"
};
const PROGRESS_KEY = "iotLearningProgress";
const LAB_KEY = "iotLabChecklist";
const FLAGS_KEY = "iotQuestionFlags";
const $ = (id) => document.getElementById(id);
const screens = [$("start-screen"), $("exam-screen"), $("result-screen"), $("review-screen")];
let questions = [];
let answers = {};
let current = 0;
let studentName = "";
let endTime = 0;
let timerId;

function show(screen) {
  screens.forEach((item) => item.classList.toggle("hidden", item !== screen));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function topicFor(question) {
  const text = question.text.toLowerCase();
  if (/(mqtt|cloud|dashboard|data|api|json|timestamp|threshold|visualisation|web server|broker|topic)/.test(text)) return "cloud";
  if (/(security|password|credential|privacy|encrypt|authentication|vulnerabil|patch|availability|secure boot|least privilege)/.test(text)) return "security";
  if (/(wi-fi|wireless|bluetooth|ble|lora|nb-iot|rfid|network|ip address|mac address|router|gateway|i2c|spi|uart|protocol|latency|bandwidth|connectivity)/.test(text)) return "networking";
  if (/(sensor|arduino|raspberry|gpio|esp32|nodemcu|relay|motor|led|resistor|breadboard|microcontroller|actuator|dht|ldr|ultrasonic|voltage|current|circuit|firmware)/.test(text)) return "hardware";
  return "architecture";
}

function prepareQuestions(topic = "all", count = 100) {
  const source = topic === "all" ? QUESTION_BANK : QUESTION_BANK.filter((question) => topicFor(question) === topic);
  return shuffle(source).slice(0, count).map((question) => {
    const correctText = question.options[question.answer.charCodeAt(0) - 65];
    const options = shuffle(question.options);
    return { ...question, topic: topicFor(question), options, answer: String.fromCharCode(65 + options.indexOf(correctText)) };
  });
}

function getLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function setLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function renderLearningHub() {
  const progress = getLocal(PROGRESS_KEY, {});
  const target = $("topic-progress");
  target.replaceChildren();
  Object.entries(TOPICS).forEach(([key, label]) => {
    const score = progress[key] || { attempted: 0, correct: 0 };
    const percentage = score.attempted ? Math.round((score.correct / score.attempted) * 100) : 0;
    const row = document.createElement("div");
    const name = document.createElement("span"); name.textContent = label;
    const track = document.createElement("span"); track.className = "progress-track";
    const fill = document.createElement("i"); fill.style.width = `${percentage}%`; track.append(fill);
    const value = document.createElement("strong"); value.textContent = score.attempted ? `${percentage}%` : "—";
    row.append(name, track, value); target.append(row);
  });
  const lab = getLocal(LAB_KEY, {});
  document.querySelectorAll("#lab-checklist input").forEach((input) => { input.checked = Boolean(lab[input.dataset.lab]); });
  $("flagged-count").textContent = getLocal(FLAGS_KEY, []).length;
}

function saveProgress() {
  const progress = getLocal(PROGRESS_KEY, {});
  questions.forEach((question) => {
    const selected = answers[question.id];
    if (!selected) return;
    const currentProgress = progress[question.topic] || { attempted: 0, correct: 0 };
    currentProgress.attempted += 1;
    if (selected === question.answer) currentProgress.correct += 1;
    progress[question.topic] = currentProgress;
  });
  setLocal(PROGRESS_KEY, progress);
}

function explanationFor(question) {
  const answer = question.options[question.answer.charCodeAt(0) - 65];
  const prompts = {
    architecture: "Relate this idea to the complete path from a real-world problem through sensing, connectivity, processing and action.",
    hardware: "Review the purpose of each hardware component, safe wiring, suitable interfaces and the difference between sensing and actuation.",
    networking: "Choose connectivity by considering range, data rate, power use and the network environment.",
    cloud: "Think about how device messages are organised, stored, visualised and used for alerts or control.",
    security: "Good IoT design considers security, privacy, reliability and maintenance from the beginning."
  };
  return `Correct answer: ${answer}. ${prompts[question.topic]}`;
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map((item) => String(item).padStart(2, "0")).join(":");
}

function startTimer() {
  clearInterval(timerId);
  const update = () => {
    const remaining = endTime - Date.now();
    $("timer").textContent = formatTime(remaining);
    if (remaining <= 0) finish(true);
  };
  update();
  timerId = setInterval(update, 1000);
}

function renderGrid() {
  const grid = $("question-grid");
  grid.replaceChildren();
  questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = index + 1;
    button.title = `Question ${index + 1}`;
    if (answers[question.id]) button.classList.add("answered");
    if (index === current) button.classList.add("current");
    button.addEventListener("click", () => { current = index; renderQuestion(); });
    grid.append(button);
  });
  $("answered-count").textContent = `${Object.keys(answers).length} / ${questions.length} answered`;
}

function renderQuestion() {
  const question = questions[current];
  $("question-number").textContent = `Question ${current + 1} of ${questions.length}`;
  $("question-topic").textContent = TOPICS[question.topic];
  $("question-text").textContent = question.text;
  const fieldset = $("options");
  fieldset.replaceChildren();
  question.options.forEach((option, optionIndex) => {
    const letter = String.fromCharCode(65 + optionIndex);
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = letter;
    input.checked = answers[question.id] === letter;
    input.addEventListener("change", () => {
      answers[question.id] = letter;
      renderGrid();
      $("answer-status").textContent = "Answer saved";
      $("answer-status").style.color = "var(--green)";
    });
    const badge = document.createElement("span");
    badge.className = "option-letter";
    badge.textContent = letter;
    const text = document.createElement("span");
    text.textContent = option;
    label.append(input, badge, text);
    fieldset.append(label);
  });
  const status = answers[question.id] ? "Answer saved" : "Not answered";
  $("answer-status").textContent = status;
  $("answer-status").style.color = answers[question.id] ? "var(--green)" : "var(--amber)";
  $("next-btn").innerHTML = current === questions.length - 1 ? "Save answer" : "Save &amp; next <span aria-hidden=\"true\">→</span>";
  renderGrid();
}

function result() {
  let correct = 0;
  questions.forEach((question) => { if (answers[question.id] === question.answer) correct += 1; });
  const unanswered = questions.length - Object.keys(answers).length;
  return { correct, unanswered, wrong: questions.length - correct - unanswered, percentage: Math.round((correct / questions.length) * 100) };
}

function finish(fromTimer = false) {
  clearInterval(timerId);
  const scores = result();
  saveProgress();
  renderLearningHub();
  $("score-value").textContent = `${scores.percentage}%`;
  $("correct-count").textContent = scores.correct;
  $("wrong-count").textContent = scores.wrong;
  $("unanswered-count").textContent = scores.unanswered;
  const passed = scores.percentage >= PASS_PERCENTAGE;
  $("result-title").textContent = fromTimer ? "Time is up." : passed ? "Great work." : "Keep practising.";
  $("result-message").textContent = `${studentName}, you answered ${scores.correct} of ${questions.length} questions correctly. ${passed ? "You reached the 50% practice target." : "Review the answers and try again when you are ready."}`;
  show($("result-screen"));
}

function renderReview() {
  const list = $("review-list");
  list.replaceChildren();
  questions.forEach((question, index) => {
    const selected = answers[question.id];
    const item = document.createElement("article");
    item.className = `review-item ${selected === question.answer ? "correct" : ""}`;
    const heading = document.createElement("h2");
    heading.textContent = `Question ${index + 1}`;
    const prompt = document.createElement("p");
    prompt.textContent = question.text;
    const options = document.createElement("div");
    options.className = "review-options";
    question.options.forEach((option, optionIndex) => {
      const letter = String.fromCharCode(65 + optionIndex);
      const optionEl = document.createElement("div");
      optionEl.className = "review-option";
      if (letter === question.answer) optionEl.classList.add("answer");
      if (letter === selected && selected !== question.answer) optionEl.classList.add("selected-wrong");
      optionEl.textContent = `${letter}. ${option}${letter === question.answer ? " — Correct answer" : letter === selected ? " — Your answer" : ""}`;
      options.append(optionEl);
    });
    const explanation = document.createElement("p");
    explanation.className = "review-explanation";
    explanation.textContent = explanationFor(question);
    const flag = document.createElement("button");
    flag.type = "button";
    flag.className = "flag-btn";
    flag.textContent = "Flag as unclear or incorrect";
    flag.addEventListener("click", () => {
      const flags = getLocal(FLAGS_KEY, []);
      if (!flags.some((entry) => entry.id === question.id)) {
        flags.push({ id: question.id, topic: question.topic, question: question.text });
        setLocal(FLAGS_KEY, flags);
      }
      flag.textContent = "Flag saved locally";
      flag.disabled = true;
      renderLearningHub();
    });
    item.append(heading, prompt, options, explanation, flag);
    list.append(item);
  });
}

$("start-btn").addEventListener("click", () => {
  const name = $("student-name").value.trim();
  if (!name) { $("student-name").focus(); return; }
  studentName = name;
  const isTopicPractice = $("practice-mode").value === "topic";
  const selectedTopic = $("topic-select").value;
  questions = prepareQuestions(isTopicPractice ? selectedTopic : "all", isTopicPractice ? 20 : 100);
  if (!questions.length) return;
  answers = {};
  current = 0;
  endTime = Date.now() + (isTopicPractice ? 25 * 60 * 1000 : DURATION_MS);
  $("candidate-name").textContent = `Candidate: ${studentName}`;
  show($("exam-screen"));
  renderQuestion();
  startTimer();
});
$("next-btn").addEventListener("click", () => { if (current < questions.length - 1) { current += 1; renderQuestion(); } });
$("clear-btn").addEventListener("click", () => { delete answers[questions[current].id]; renderQuestion(); });
$("finish-btn").addEventListener("click", () => { if (confirm("Finish this practice exam and see your result?")) finish(); });
$("review-btn").addEventListener("click", () => { renderReview(); show($("review-screen")); });
$("back-btn").addEventListener("click", () => show($("result-screen")));
$("restart-btn").addEventListener("click", () => { clearInterval(timerId); $("student-name").value = studentName; show($("start-screen")); });
$("practice-mode").addEventListener("change", () => {
  const topicMode = $("practice-mode").value === "topic";
  $("topic-select").disabled = !topicMode;
  $("start-btn").innerHTML = topicMode ? "Begin topic practice <span aria-hidden=\"true\">→</span>" : "Begin practice exam <span aria-hidden=\"true\">→</span>";
});
document.querySelectorAll("#lab-checklist input").forEach((input) => input.addEventListener("change", () => {
  const lab = getLocal(LAB_KEY, {}); lab[input.dataset.lab] = input.checked; setLocal(LAB_KEY, lab);
}));
$("clear-flags-btn").addEventListener("click", () => { setLocal(FLAGS_KEY, []); renderLearningHub(); });
$("topic-select").disabled = true;
renderLearningHub();
