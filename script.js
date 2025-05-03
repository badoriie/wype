const startStopBtn = document.getElementById("startStopBtn");
const pipBtn = document.getElementById("pipBtn");
const video = document.getElementById("video");
const approval = document.getElementById("approval");
const detectBtn = document.getElementById("detectBtn");

let stopDetectionFlag = false;
let detectionFrameId;

async function ultraWideCameraId() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("getUserMedia not supported on this device.");
    return;
  }
  await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) =>
    device.label.includes("Ultra")
  );

  return videoDevices.map((device) => device.deviceId);
}

async function startCamera() {
  const wideCameraId = await ultraWideCameraId();

  if (!wideCameraId || wideCameraId.length === 0) {
    alert("No 'Ultra Wide Camera' found. This device may not support it.");
    return;
  }

  try {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      video.style.display = "none";
      detectBtn.disabled = true;
      pipBtn.disabled = true;
      startStopBtn.innerText = "Start Preview";
      startStopBtn.style.background =
        "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)";

      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: wideCameraId },
      },
    });

    video.srcObject = stream;
    video.style.display = "block";
    startStopBtn.innerText = "Stop Preview";
    detectBtn.disabled = false;
    pipBtn.disabled = false;
    startStopBtn.style.background =
      "linear-gradient(135deg, #32ff7e 0%, #00b894 50%, #00cec9 100%)";
  } catch (err) {
    alert("Camera error: " + err.message);
    console.error(err);
  }
}

async function runDetection() {
  stopDetectionFlag = false;
  const model = await cocoSsd.load();
  video.play();

  async function detectFrame() {
    if (stopDetectionFlag) {
      cancelAnimationFrame(detectionFrameId);
      return;
    }

    const predictions = await model.detect(video);
    predictions.forEach((pred) => {
      if (pred.score > 0.6 && isDangerous(pred)) {
        video.style.filter =
          "sepia(1) hue-rotate(-20deg) saturate(2) brightness(1.1)";
        setTimeout(() => {
          video.style.filter = "none";
        }, 1000);
      }
    });

    detectionFrameId = requestAnimationFrame(detectFrame);
  }

  detectFrame();
}

function stopDetection() {
  stopDetectionFlag = true;
}

function toggleDetection() {
  if (detectBtn.innerText === "Start Detection") {
    detectBtn.innerText = "Stop Detection";
    detectBtn.style.background =
      "linear-gradient(135deg, #32ff7e 0%, #00b894 50%, #00cec9 100%)";
    runDetection();
  } else {
    stopDetection();
    detectBtn.style.background =
      "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)";
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
      pipBtn.style.background =
        "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)";
      await document.exitPictureInPicture();
    } else {
      approval.style.display = "block";
      pipBtn.style.background =
        "linear-gradient(135deg, #32ff7e 0%, #00b894 50%, #00cec9 100%)";
      await video.requestPictureInPicture();
    }
  } catch (err) {
    alert("PiP failed: " + err.message);
    console.error(err);
  }
}
