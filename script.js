const startStopBtn = document.getElementById("startStopBtn");
const pipBtn = document.getElementById("pipBtn");
const video = document.getElementById("video");
const pipVideo = document.getElementById("pipVideo");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const approval = document.getElementById("approval");
const detectBtn = document.getElementById("detectBtn");

const IDLE_GRADIENT =
  "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)";
const ACTIVE_GRADIENT =
  "linear-gradient(135deg, #32ff7e 0%, #00b894 50%, #00cec9 100%)";

let stopDetectionFlag = false;
let detectionFrameId;
let renderFrameId;
let latestPredictions = [];
let dangerUntil = 0;
let model;

async function ultraWideCameraId() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("getUserMedia not supported on this device.");
    return;
  }
  // Prime camera permission with the back camera so device labels become
  // readable without ever lighting up the front camera.
  const primingStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });

  const devices = await navigator.mediaDevices.enumerateDevices();
  // Only one camera can be active at a time on iOS, so release the priming
  // stream before opening the ultra-wide camera.
  primingStream.getTracks().forEach((track) => track.stop());

  const backUltraWide = devices.find(
    (device) =>
      device.kind === "videoinput" &&
      /ultra/i.test(device.label) &&
      !/front/i.test(device.label)
  );

  return backUltraWide && backUltraWide.deviceId;
}

async function startCamera() {
  if (video.srcObject) {
    stopDetection();
    cancelAnimationFrame(renderFrameId);
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    pipVideo.srcObject = null;
    pipVideo.style.display = "none";
    approval.style.display = "none";
    detectBtn.disabled = true;
    detectBtn.innerText = "Start Detection";
    detectBtn.style.background = IDLE_GRADIENT;
    pipBtn.disabled = true;
    pipBtn.style.background = IDLE_GRADIENT;
    startStopBtn.innerText = "Start Preview";
    startStopBtn.style.background = IDLE_GRADIENT;

    return;
  }

  try {
    const wideCameraId = await ultraWideCameraId();

    if (!wideCameraId) {
      alert("No back 'Ultra Wide Camera' found. This device may not support it.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: wideCameraId },
      },
    });

    video.srcObject = stream;
    await new Promise((resolve) =>
      video.addEventListener("loadedmetadata", resolve, { once: true })
    );
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    pipVideo.srcObject = overlay.captureStream();
    pipVideo.style.display = "block";
    renderFrame();

    startStopBtn.innerText = "Stop Preview";
    detectBtn.disabled = false;
    pipBtn.disabled = false;
    startStopBtn.style.background = ACTIVE_GRADIENT;
  } catch (err) {
    alert("Camera error: " + err.message);
    console.error(err);
  }
}

function renderFrame() {
  ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
  latestPredictions.forEach(drawPrediction);
  if (performance.now() < dangerUntil) {
    ctx.fillStyle = "rgba(255, 59, 48, 0.25)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
  }
  renderFrameId = requestAnimationFrame(renderFrame);
}

function drawPrediction(pred) {
  const [x, y, width, height] = pred.bbox;
  const color = isDangerous(pred) ? "#ff3b30" : "#32ff7e";

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, overlay.width / 320);
  ctx.strokeRect(x, y, width, height);

  const fontSize = Math.max(14, overlay.width / 40);
  const label = `${pred.class} ${Math.round(pred.score * 100)}%`;
  ctx.font = `${fontSize}px Roboto, sans-serif`;
  const labelY = Math.max(0, y - fontSize - 6);
  ctx.fillStyle = color;
  ctx.fillRect(x, labelY, ctx.measureText(label).width + 8, fontSize + 6);
  ctx.fillStyle = "#000";
  ctx.fillText(label, x + 4, labelY + fontSize);
}

async function runDetection() {
  stopDetectionFlag = false;
  if (!model) {
    model = await cocoSsd.load();
  }
  video.play();

  async function detectFrame() {
    if (stopDetectionFlag) {
      cancelAnimationFrame(detectionFrameId);
      return;
    }

    const predictions = await model.detect(video);
    latestPredictions = predictions.filter((pred) => pred.score > 0.6);
    if (latestPredictions.some(isDangerous)) {
      dangerUntil = performance.now() + 1000;
    }

    detectionFrameId = requestAnimationFrame(detectFrame);
  }

  detectFrame();
}

function stopDetection() {
  stopDetectionFlag = true;
  latestPredictions = [];
}

function toggleDetection() {
  if (detectBtn.innerText === "Start Detection") {
    detectBtn.innerText = "Stop Detection";
    detectBtn.style.background = ACTIVE_GRADIENT;
    runDetection();
  } else {
    stopDetection();
    detectBtn.style.background = IDLE_GRADIENT;
    detectBtn.innerText = "Start Detection";
    video.play();
  }
}

function isDangerous(prediction) {
  const closeObjects = [
    "person",
    "car",
    "bus",
    "truck",
    "motorcycle",
    "bicycle",
  ];
  const [x, y, width, height] = prediction.bbox;
  const bboxArea = width * height;
  const frameArea = video.videoWidth * video.videoHeight;

  return closeObjects.includes(prediction.class) && bboxArea > 0.1 * frameArea;
}

async function togglePiP() {
  try {
    if (!document.pictureInPictureEnabled) {
      alert("PiP not supported on this device.");
      return;
    }

    if (document.pictureInPictureElement) {
      approval.style.display = "none";
      pipBtn.style.background = IDLE_GRADIENT;
      await document.exitPictureInPicture();
    } else {
      approval.style.display = "block";
      pipBtn.style.background = ACTIVE_GRADIENT;
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
    }
  } catch (err) {
    alert("PiP failed: " + err.message);
    console.error(err);
  }
}
