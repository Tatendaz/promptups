// PromptUps front end: camera in, pose landmarks out, reps counted,
// all driven by start/stop events from the Claude Code hooks via SSE.
// Every frame is processed in this tab by MediaPipe (WASM/GPU). No uploads.

import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { coach } from "./coach.js";
import { EXERCISES, RepCounter, visibleAngle } from "./reps.js";

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("overlay");
const ctx = canvas.getContext("2d");
const els = {
  status: $("status-text"),
  cue: $("cue"),
  banner: $("banner"),
  bannerTitle: $("banner-title"),
  bannerSub: $("banner-sub"),
  repCount: $("rep-count"),
  boardLabel: $("board-label"),
  timer: $("set-timer"),
  cameraSelect: $("camera-select"),
  voiceBtn: $("voice-btn"),
  testBtn: $("test-btn"),
};

// ---------- state ----------
let landmarker = null;
let drawer = null;
let stream = null;
let currentExercise = "squats";
let counter = new RepCounter(EXERCISES[currentExercise]);
let session = null; // { reps, startedAt, token, test }
let sessionSeq = 0;
let muted = localStorage.getItem("promptups.muted") === "1";
let audioCtx = null;
let roastTimer = null;

const setMode = (mode) => (document.body.dataset.mode = mode);
const setStatus = (text) => (els.status.textContent = text);

// ---------- voice ----------
function speak(text, { interrupt = true } = {}) {
  if (muted || !("speechSynthesis" in window)) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.15;
  speechSynthesis.speak(u);
}

function chime(kind = "done") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === "attention" ? [523, 523] : [659, 988];
    const now = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.55);
    });
  } catch { /* no audio, no problem */ }
}

// ---------- session flow ----------
async function beginSession({ test = false } = {}) {
  if (session) return; // already mid-set: keep counting
  // Pin the exercise for the whole set, so every rep and the logged session
  // stay attached to one movement even if the picker changes later.
  session = { reps: 0, startedAt: Date.now(), token: ++sessionSeq, test, exercise: currentExercise };
  counter = new RepCounter(EXERCISES[currentExercise]);
  els.repCount.textContent = "0";
  els.boardLabel.textContent = "REPS THIS PROMPT";
  setMode("active");
  setStatus(test ? "test drive" : "claude is thinking — go");
  els.testBtn.textContent = "end test";
  speak(coach.pick("start"));
  clearTimeout(roastTimer);
  roastTimer = setTimeout(() => {
    if (session && session.reps === 0) speak(coach.pick("roast"));
  }, 25_000);
}

async function endSession(reason) {
  if (!session) {
    setMode("idle");
    setStatus("listening for prompts");
    return;
  }
  const done = session;
  session = null;
  clearTimeout(roastTimer);
  els.testBtn.textContent = "test drive";

  const attention = reason === "attention";
  setMode(attention ? "attention" : "done");
  setStatus(attention ? "claude needs you" : "claude's ready");
  els.bannerTitle.textContent = attention ? "CLAUDE NEEDS YOU" : "CLAUDE'S READY";
  const label = EXERCISES[done.exercise].label;
  els.bannerSub.textContent = `${done.reps} ${label} while it worked`;
  chime(attention ? "attention" : "done");

  if (!done.test && done.reps > 0) {
    fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        exercise: done.exercise,
        reps: done.reps,
        startedAt: new Date(done.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        reason,
      }),
    }).then((r) => r.json()).then(renderStats).catch(() => {});
  }

  const line = attention
    ? coach.pick("attention")
    : await coach.quip("done", done.reps, label);
  speak(attention ? line : `${done.reps} ${label}. ${line}`);

  // Fall back to idle unless another prompt already started a new set.
  const token = done.token;
  setTimeout(() => {
    if (!session && sessionSeq === token) {
      setMode("idle");
      setStatus("listening for prompts");
    }
  }, 8000);
}

function onRep() {
  if (!session) return;
  session.reps += 1;
  els.repCount.textContent = String(session.reps);
  els.repCount.classList.remove("pop");
  void els.repCount.offsetWidth; // retrigger the pop animation
  els.repCount.classList.add("pop");
  if (session.reps % 5 === 0) speak(`${session.reps}. ${coach.pick("milestone")}`);
  else speak(String(session.reps));
}

// timer tick
setInterval(() => {
  if (!session) return;
  const s = Math.floor((Date.now() - session.startedAt) / 1000);
  els.timer.textContent =
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}, 500);

// ---------- pose pipeline ----------
function frame(now) {
  if (landmarker && video.readyState >= 2 && video.videoWidth) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const result = landmarker.detectForVideo(video, now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lm = result.landmarks && result.landmarks[0];
    if (lm) {
      drawer.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
        color: session ? "#ff5c1c" : "#8f8c7c",
        lineWidth: 3,
      });
      drawer.drawLandmarks(lm, { color: "#ece7da", radius: 3 });
      const angle = visibleAngle(lm, EXERCISES[currentExercise]);
      if (angle === null) {
        els.cue.textContent = EXERCISES[currentExercise].cue;
        els.cue.classList.remove("hidden");
      } else {
        els.cue.classList.add("hidden");
        if (session && counter.feed(angle, now)) onRep();
      }
    } else {
      els.cue.textContent = "nobody in frame";
      els.cue.classList.remove("hidden");
    }
  }
  requestAnimationFrame(frame);
}

// ---------- camera ----------
async function startCamera(deviceId) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: "user", width: { ideal: 1280 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === "videoinput");
  els.cameraSelect.replaceChildren();
  cams.forEach((cam, i) => {
    const option = document.createElement("option");
    option.value = cam.deviceId;
    option.textContent = cam.label || `camera ${i + 1}`;
    els.cameraSelect.appendChild(option);
  });
  const saved = localStorage.getItem("promptups.camera");
  if (saved && cams.some((c) => c.deviceId === saved)) els.cameraSelect.value = saved;
}

// ---------- events from the hook bus ----------
function connectEvents() {
  const source = new EventSource("/events");
  source.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === "hello") {
      if (event.thinking) beginSession();
      else if (!session) setStatus("listening for prompts");
    }
    if (event.type === "start") beginSession();
    if (event.type === "stop" && (!session || !session.test)) endSession(event.reason);
  };
  source.onerror = () => setStatus("server offline — restart promptups");
}

// ---------- controls ----------
document.querySelectorAll(".exercise-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (session) return; // a set belongs to one exercise; switch between sets
    document.querySelectorAll(".exercise-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-checked", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-checked", "true");
    currentExercise = btn.dataset.exercise;
    counter = new RepCounter(EXERCISES[currentExercise]);
  });
});

els.cameraSelect.addEventListener("change", () => {
  localStorage.setItem("promptups.camera", els.cameraSelect.value);
  startCamera(els.cameraSelect.value).catch(() => {});
});

els.voiceBtn.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("promptups.muted", muted ? "1" : "0");
  els.voiceBtn.textContent = `voice: ${muted ? "off" : "on"}`;
  els.voiceBtn.classList.toggle("on", !muted);
});

els.testBtn.addEventListener("click", () => {
  if (session && session.test) endSession("done");
  else beginSession({ test: true });
});

// ---------- stats ----------
function renderStats(stats) {
  if (!stats) return;
  $("stat-today").textContent = stats.todayReps;
  $("stat-total").textContent = stats.totalReps;
  $("stat-best").textContent = stats.bestSet;
  $("stat-sessions").textContent = stats.sessions;
}

// ---------- boot ----------
(async function boot() {
  els.voiceBtn.textContent = `voice: ${muted ? "off" : "on"}`;
  els.voiceBtn.classList.toggle("on", !muted);
  setStatus("loading pose model…");

  fetch("/api/stats").then((r) => r.json()).then(renderStats).catch(() => {});

  try {
    const saved = localStorage.getItem("promptups.camera");
    try {
      await startCamera(saved || undefined);
    } catch (err) {
      if (!saved) throw err;
      localStorage.removeItem("promptups.camera"); // stale device id: fall back to default
      await startCamera(undefined);
    }
    await listCameras(); // labels only populate after permission
  } catch {
    els.cue.textContent = "camera blocked — allow access and reload";
    setStatus("no camera");
    return;
  }

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  drawer = new DrawingUtils(ctx);

  els.cue.textContent = "in frame? prompt claude and move";
  setStatus("listening for prompts");
  setMode("idle");
  connectEvents();
  requestAnimationFrame(frame);

  try {
    await navigator.wakeLock?.request("screen"); // keep the scoreboard awake mid-set
  } catch { /* fine without it */ }
})();
