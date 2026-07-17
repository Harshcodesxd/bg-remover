import { removeBackground, preload } from "@imgly/background-removal";

// ==== DOM REFS ====
const dropzone        = document.getElementById("dropzone");
const dropzoneContent = document.getElementById("dropzoneContent");
const dropzoneLoading = document.getElementById("dropzoneLoading");
const fileInput       = document.getElementById("fileInput");
const loadingText     = document.getElementById("loadingText");
const loadingHint     = document.getElementById("loadingHint");
const progressFill    = document.getElementById("progressFill");
const progressBar     = document.getElementById("progressBar");
const resultArea      = document.getElementById("resultArea");
const originalPreview = document.getElementById("originalPreview");
const resultCanvas    = document.getElementById("resultCanvas");
const downloadBtn     = document.getElementById("downloadBtn");
const newImageBtn     = document.getElementById("newImageBtn");
const brushSize       = document.getElementById("brushSize");
const brushSizeVal    = document.getElementById("brushSizeVal");
const modeRestore     = document.getElementById("modeRestore");
const modeErase       = document.getElementById("modeErase");
const resetEditsBtn   = document.getElementById("resetEditsBtn");
const origDimEl       = document.getElementById("origDim");
const outDimEl        = document.getElementById("outDim");
const modelBtns       = document.querySelectorAll("[data-model]");
const resBtns         = document.querySelectorAll("[data-res]");
const hamburger       = document.getElementById("hamburger");
const navMenu         = document.getElementById("nav-menu");
const themeToggle     = document.getElementById("themeToggle");
const html            = document.documentElement;

// ==== STATE ====
let originalBlob = null;
let resultBlob   = null;
let originalUrl  = null;
let isProcessing = false;
let selectedModel = "isnet";
let selectedRes   = "original";
let originalImageElement = null;
let rawResultImage   = null;
let lastX = 0, lastY = 0;
let isDrawing = false;
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");


const RES_MAP = {
  "1080p":    { w: 1920, h: 1080 },
  "1440p":    { w: 2560, h: 1440 },
  "2160p":    { w: 3840, h: 2160 },
  "original": null,
};

// ==== THEME ====
function getPreferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  html.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function toggleTheme() {
  const current = html.getAttribute("data-theme") || getPreferredTheme();
  setTheme(current === "dark" ? "light" : "dark");
}

// Init theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  setTheme(savedTheme);
} else {
  html.removeAttribute("data-theme");
}
themeToggle.addEventListener("click", toggleTheme);

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem("theme")) {
    html.removeAttribute("data-theme");
  }
});

// ==== HAMBURGER MENU ====
hamburger.addEventListener("click", () => {
  const expanded = hamburger.getAttribute("aria-expanded") === "true";
  hamburger.setAttribute("aria-expanded", !expanded);
  navMenu.classList.toggle("open");
});

// Close nav on link click
navMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    hamburger.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("open");
  });
});

// Close nav on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navMenu.classList.contains("open")) {
    hamburger.setAttribute("aria-expanded", "false");
    navMenu.classList.remove("open");
    hamburger.focus();
  }
});

// ==== RADIO BUTTON KEYBOARD NAV ====
document.querySelectorAll('[role="radiogroup"]').forEach((group) => {
  const radios = group.querySelectorAll('[role="radio"]');
  group.addEventListener("keydown", (e) => {
    const current = group.querySelector('[aria-checked="true"]');
    let idx = Array.from(radios).indexOf(current);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      idx = (idx + 1) % radios.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      idx = (idx - 1 + radios.length) % radios.length;
    } else return;
    radios.forEach((r) => { r.setAttribute("aria-checked", "false"); r.tabIndex = -1; });
    radios[idx].setAttribute("aria-checked", "true");
    radios[idx].tabIndex = 0;
    radios[idx].focus();
    radios[idx].click();
  });
});

// ==== PRELOAD MODEL ====
preload({ model: "isnet_quint8" }).catch(() => {});

// ==== PARTICLES ====
const pCanvas = document.getElementById("particles");
if (pCanvas) {
  const pCtx = pCanvas.getContext("2d");
  let particles = [];
  let mouseX = -1000, mouseY = -1000;

  function resizeP() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; }
  window.addEventListener("resize", resizeP);
  resizeP();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * pCanvas.width;
      this.y = Math.random() * pCanvas.height;
      this.size = Math.random() * 2 + 1;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.speedX; this.y += this.speedY;
      const dx = mouseX - this.x, dy = mouseY - this.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) { const f = (200 - dist) / 200 * 0.02; this.x += dx * f; this.y += dy * f; }
      if (this.x < 0 || this.x > pCanvas.width || this.y < 0 || this.y > pCanvas.height) this.reset();
    }
    draw() {
      pCtx.beginPath(); pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(108,92,231,${this.opacity})`; pCtx.fill();
    }
  }
  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function anim() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    for (const p of particles) { p.update(); p.draw(); }
    for (let i = 0; i < particles.length; i++)
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 120) {
          pCtx.beginPath(); pCtx.moveTo(particles[i].x, particles[i].y); pCtx.lineTo(particles[j].x, particles[j].y);
          pCtx.strokeStyle = `rgba(108,92,231,${0.08*(1-dist/120)})`; pCtx.lineWidth = 0.5; pCtx.stroke();
        }
      }
    requestAnimationFrame(anim);
  }
  anim();
  document.addEventListener("mousemove", (e) => { mouseX = e.clientX; mouseY = e.clientY; });
}

// ==== DROPZONE ====
dropzone.addEventListener("mousemove", (e) => {
  const r = dropzone.getBoundingClientRect();
  dropzone.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
  dropzone.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
});

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });

fileInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); dropzone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// ==== SELECTORS ====
const modelNotes = {
  "isnet_quint8": "Fastest performance — ~20MB quantized model",
  "isnet_fp16":   "Balanced memory & speed — ~40MB float16 model",
  "isnet":        "Highest quality details — ~80MB full model",
};

const resNotes = {
  "1080p":    "Resize to fit inside 1920\u00D71080 (HD)",
  "1440p":    "Resize to fit inside 2560\u00D71440 (2K)",
  "2160p":    "Resize to fit inside 3840\u00D72160 (4K)",
  "original": "Keep original image dimensions",
};

modelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    modelBtns.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); b.tabIndex = -1; });
    btn.classList.add("active"); btn.setAttribute("aria-checked", "true"); btn.tabIndex = 0;
    selectedModel = btn.dataset.model;
    const noteEl = document.getElementById("qualityNote");
    if (noteEl) noteEl.textContent = modelNotes[selectedModel] || "";
  });
});
resBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    resBtns.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); b.tabIndex = -1; });
    btn.classList.add("active"); btn.setAttribute("aria-checked", "true"); btn.tabIndex = 0;
    selectedRes = btn.dataset.res;
    const noteEl = document.getElementById("resNote");
    if (noteEl) noteEl.textContent = resNotes[selectedRes] || "";
  });
});

// ==== FILE HANDLER ====
async function handleFile(file) {
  if (isProcessing) return;
  if (file.size > 50 * 1024 * 1024) { alert("Max 50MB."); return; }

  dropzoneContent.hidden = true;
  dropzoneLoading.hidden = false;
  resultArea.hidden = true;
  loadingText.textContent = "Loading image…";
  loadingHint.hidden = true;
  progressFill.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", "0");
  isProcessing = true;
  revokeUrls();

  originalBlob = file;
  originalUrl = URL.createObjectURL(file);
  originalPreview.src = originalUrl;

  const origImg = await blobToImage(file);
  originalImageElement = origImg;
  origDimEl.textContent = `(${origImg.width}\u00D7${origImg.height})`;

  try {
    await sleep(30);

    const config = {
      progress: (key, current, total) => {
        if (key === "download" && total > 0) {
          const pct = Math.min(Math.round((current / total) * 70) + 5, 75);
          progressFill.style.width = pct + "%";
          progressBar.setAttribute("aria-valuenow", pct);
          loadingText.textContent = "Downloading AI model\u2026";
        } else if (key === "compute") {
          const pct = Math.min(Math.round((current / (total || 1)) * 20) + 75, 95);
          progressFill.style.width = pct + "%";
          progressBar.setAttribute("aria-valuenow", pct);
          loadingText.textContent = "Processing image\u2026";
        }
      },
      model: selectedModel,
      output: { format: "image/png" },
    };

    const rawBlob = await removeBackground(file, config);
    progressFill.style.width = "75%";
    progressBar.setAttribute("aria-valuenow", "75");

    loadingText.textContent = "Upscaling\u2026";
    await sleep(20);
    resultBlob = await upscaleImage(rawBlob, selectedRes);

    const outImg = await blobToImage(resultBlob);
    rawResultImage = outImg;
    outDimEl.textContent = `(${outImg.width}\u00D7${outImg.height})`;

    // Configure the main canvas
    resultCanvas.width = outImg.width;
    resultCanvas.height = outImg.height;

    // Configure tempCanvas for Restore compositing
    tempCanvas.width = outImg.width;
    tempCanvas.height = outImg.height;

    // Draw initial background removed image
    const ctx = resultCanvas.getContext("2d");
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    ctx.drawImage(outImg, 0, 0);

    progressFill.style.width = "100%";
    progressBar.setAttribute("aria-valuenow", "100");
    loadingText.textContent = "Done!";

    await sleep(150);
    dropzoneLoading.hidden = true;
    dropzoneContent.hidden = false;
    resultArea.hidden = false;

    const dt = dropzoneContent.querySelector(".dropzone-text");
    if (dt) dt.innerHTML = "<strong>Drop another image</strong> or click to browse";
  } catch (err) {
    console.error("Failed:", err);
    loadingText.textContent = err.message || "Error. Try again.";
    progressFill.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
    dropzoneContent.hidden = false;
    dropzoneLoading.hidden = true;
  }
  isProcessing = false;
}

// ==== UPSCALE ====
async function upscaleImage(blob, resMode) {
  const img = await blobToImage(blob);
  let tw, th;
  const dim = RES_MAP[resMode];
  if (dim) {
    const scale = Math.min(dim.w / img.width, dim.h / img.height, 1);
    tw = Math.round(img.width * scale);
    th = Math.round(img.height * scale);
  } else {
    tw = img.width; th = img.height;
  }
  const c = document.createElement("canvas");
  c.width = tw; c.height = th;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, tw, th);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Decode failed")); };
    img.src = url;
  });
}

// ==== DOWNLOAD ====
downloadBtn.addEventListener("click", () => {
  if (!rawResultImage) return;
  resultCanvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `removed-bg-${selectedRes}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
});

// ==== NEW IMAGE ====
newImageBtn.addEventListener("click", () => {
  resultArea.hidden = true;
  revokeUrls();
  fileInput.value = "";
  dropzoneContent.hidden = false;
  dropzoneLoading.hidden = true;
});

// ==== BRUSH ====
brushSize.addEventListener("input", () => { brushSizeVal.textContent = brushSize.value + "px"; });

function initDrawEvents() {
  const getScaledCoords = (e) => {
    const rect = resultCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) * (resultCanvas.width / rect.width);
    const y = (clientY - rect.top) * (resultCanvas.height / rect.height);
    return { x, y };
  };

  const drawStroke = (x1, y1, x2, y2) => {
    const ctx = resultCanvas.getContext("2d");
    const sz = parseInt(brushSize.value, 10);
    
    // Scale brush size relative to display rendering scale
    const rect = resultCanvas.getBoundingClientRect();
    const brushScale = resultCanvas.width / rect.width;
    const scaledBrushSize = sz * brushScale;

    if (modeRestore.classList.contains("active") && originalImageElement) {
      // Restore Mode
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.save();
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";
      tempCtx.lineWidth = scaledBrushSize;
      tempCtx.strokeStyle = "white";
      tempCtx.beginPath();
      tempCtx.moveTo(x1, y1);
      tempCtx.lineTo(x2, y2);
      tempCtx.stroke();
      tempCtx.restore();

      // Use source-in to crop original image to the stroke
      tempCtx.save();
      tempCtx.globalCompositeOperation = "source-in";
      tempCtx.drawImage(originalImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.restore();

      // Draw the cropped stroke onto resultCanvas
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      // Erase Mode
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = scaledBrushSize;
      ctx.strokeStyle = "black";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawDot = (x, y) => {
    const ctx = resultCanvas.getContext("2d");
    const sz = parseInt(brushSize.value, 10);
    
    const rect = resultCanvas.getBoundingClientRect();
    const brushScale = resultCanvas.width / rect.width;
    const scaledBrushSize = sz * brushScale;

    if (modeRestore.classList.contains("active") && originalImageElement) {
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.save();
      tempCtx.fillStyle = "white";
      tempCtx.beginPath();
      tempCtx.arc(x, y, scaledBrushSize / 2, 0, Math.PI * 2);
      tempCtx.fill();
      tempCtx.restore();

      tempCtx.save();
      tempCtx.globalCompositeOperation = "source-in";
      tempCtx.drawImage(originalImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(x, y, scaledBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const onStart = (e) => {
    if (isProcessing || !rawResultImage) return;
    isDrawing = true;
    const { x, y } = getScaledCoords(e);
    lastX = x;
    lastY = y;
    drawDot(x, y);
  };

  const onMove = (e) => {
    if (!isDrawing || isProcessing || !rawResultImage) return;
    const { x, y } = getScaledCoords(e);
    drawStroke(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
  };

  const onEnd = () => {
    isDrawing = false;
  };

  resultCanvas.addEventListener("mousedown", onStart);
  resultCanvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);

  resultCanvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onStart(e);
  }, { passive: false });
  resultCanvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    onMove(e);
  }, { passive: false });
  resultCanvas.addEventListener("touchend", onEnd);
}

// Init Drawing Events
initDrawEvents();

resetEditsBtn.addEventListener("click", () => {
  if (rawResultImage) {
    const ctx = resultCanvas.getContext("2d");
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    ctx.drawImage(rawResultImage, 0, 0);
  }
});

modeRestore.addEventListener("click", () => {
  modeRestore.classList.add("active");
  modeRestore.setAttribute("aria-checked", "true");
  modeRestore.tabIndex = 0;
  modeErase.classList.remove("active");
  modeErase.setAttribute("aria-checked", "false");
  modeErase.tabIndex = -1;
});
modeErase.addEventListener("click", () => {
  modeErase.classList.add("active");
  modeErase.setAttribute("aria-checked", "true");
  modeErase.tabIndex = 0;
  modeRestore.classList.remove("active");
  modeRestore.setAttribute("aria-checked", "false");
  modeRestore.tabIndex = -1;
});

// ==== HELPERS ====
function revokeUrls() {
  if (originalUrl) { URL.revokeObjectURL(originalUrl); originalUrl = null; }
  originalBlob = null;
  resultBlob = null;
  originalImageElement = null;
  rawResultImage = null;
  const ctx = resultCanvas.getContext("2d");
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  origDimEl.textContent = "";
  outDimEl.textContent = "";
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }


