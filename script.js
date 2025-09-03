const video = document.getElementById("video");
const approval = document.getElementById("approval");
const detectBtn = document.getElementById("detectBtn");
const previewPlaceholder = document.getElementById("preview-placeholder");

// Store original container size and app state
let originalContainerSize = null;
let pipSizeUpdateAttempts = 0;
let appState = 'off'; // 'off', 'preview', 'pip'

function restoreDefaultPlaceholder() {
  const placeholderContent = previewPlaceholder.querySelector('.placeholder-content');
  let content;
  
  if (appState === 'off') {
    content = `
      <div class="camera-icon">📷</div>
      <p>Camera Preview</p>
      <span>Tap here to start</span>
    `;
  } else if (appState === 'preview') {
    content = `
      <div class="camera-icon">📷</div>
      <p>Camera Preview</p>
      <span>Tap for PiP mode</span>
    `;
  }
  
  if (content) {
    placeholderContent.innerHTML = content;
  }
  placeholderContent.style.opacity = "1";
  placeholderContent.style.transform = "scale(1)";
}

let stopDetectionFlag = false;
let detectionFrameId;

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
}

function checkDeviceAndShowContent() {
  const mainContent = document.getElementById("main");
  const desktopMessage = document.getElementById("desktop-message");
  const footer = document.querySelector("footer");
  
  if (isMobileDevice()) {
    mainContent.style.display = "flex";
    desktopMessage.style.display = "none";
    footer.style.display = "block";
  } else {
    mainContent.style.display = "none";
    desktopMessage.style.display = "flex";
    footer.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", checkDeviceAndShowContent);

// Listen for when PiP closes naturally (user closes PiP window)
document.addEventListener('leavepictureinpicture', () => {
  console.log('PiP closed naturally, returning to preview');
  if (appState === 'pip') {
    // Update state first
    appState = 'preview';
    
    // Reset placeholder text to preview state
    const placeholderContent = previewPlaceholder.querySelector('.placeholder-content');
    placeholderContent.innerHTML = `
      <div class="camera-icon">📷</div>
      <p>Camera Preview</p>
      <span>Tap for PiP mode</span>
    `;
    
    // Show video and hide placeholder
    previewPlaceholder.classList.add("hiding");
    video.classList.add("active");
    
    // Make sure video is playing
    video.play();
    
    // Hide approval message
    approval.style.display = "none";
    
    // Try to bring browser to foreground on iOS
    try {
      // First try to focus the current window
      window.focus();
      
      // For iOS, try to trigger a user notification or redirect
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        // On iOS, we can't reliably open new windows from PiP close events
        // Instead, try to make the current tab more visible
        document.title = "👁️ Wype - Camera Active";
        
        // Try a delayed window.open (sometimes works on iOS)
        setTimeout(() => {
          try {
            window.open(window.location.href, '_blank');
          } catch (e) {
            console.log('iOS popup blocked, using current window');
          }
        }, 100);
      } else {
        // On other platforms, open new window
        window.open(window.location.href, '_blank');
      }
    } catch (e) {
      console.log('Could not open new window:', e);
    }
    
    console.log('Returned to preview state, video playing, placeholder text reset, new window opened');
  }
});

async function ultraWideCameraId() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("getUserMedia not supported on this device.");
    return;
  }
  await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) =>
    device.label.includes("Ultra")
  );

  return videoDevices.map((device) => device.deviceId);
}

async function handleCameraClick() {
  console.log('Current state:', appState);
  
  if (appState === 'off') {
    // First tap: Start camera preview
    await startCameraPreview();
  } else if (appState === 'preview') {
    // Second tap: Start PiP
    await startPiP();
  } else if (appState === 'pip') {
    // PiP is active - clicking should stop camera completely
    await stopCamera();
  }
}

async function startCameraPreview() {
  const wideCameraId = await ultraWideCameraId();

  if (!wideCameraId || wideCameraId.length === 0) {
    alert("No 'Ultra Wide Camera' found. This device may not support it.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: wideCameraId },
      },
      audio: false,
    });

    // Remove any audio tracks that might have been added despite audio: false
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    
    console.log(`Stream has ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
    
    audioTracks.forEach(track => {
      console.log('Removing audio track:', track.label);
      track.stop();
      stream.removeTrack(track);
    });

    video.srcObject = stream;
    
    // Wait for video to be ready, then animate
    video.addEventListener('loadedmetadata', () => {
      previewPlaceholder.classList.add("hiding");
      
      setTimeout(() => {
        video.classList.add("active");
        detectBtn.disabled = false;
        appState = 'preview';
        console.log('Camera started, state:', appState);
        
        // Update placeholder content for future use
        const placeholderContent = previewPlaceholder.querySelector('.placeholder-content');
        placeholderContent.innerHTML = `
          <div class="camera-icon">📷</div>
          <p>Camera Preview</p>
          <span>Tap for PiP mode</span>
        `;
      }, 100);
    }, { once: true });
    
  } catch (err) {
    alert("Camera error: " + err.message);
    console.error(err);
  }
}

async function startPiP() {
  if (!document.pictureInPictureEnabled) {
    alert("PiP not supported on this device.");
    return;
  }

  try {
    console.log('Starting PiP...');
    
    // Start placeholder transition immediately
    video.classList.remove("active");
    
    setTimeout(() => {
      previewPlaceholder.classList.remove("hiding");
      
      // Fade out content, change it, then fade back in
      const placeholderContent = previewPlaceholder.querySelector('.placeholder-content');
      placeholderContent.style.opacity = "0";
      placeholderContent.style.transform = "scale(0.9)";
      
      setTimeout(() => {
        placeholderContent.innerHTML = `
          <div class="camera-icon">📺</div>
          <p>PiP Mode Active</p>
          <span>Tap to exit PiP</span>
        `;
        
        placeholderContent.style.opacity = "1";
        placeholderContent.style.transform = "scale(1)";
      }, 150);
    }, 50);
    
    // Start approval animation immediately
    setTimeout(() => {
      approval.style.display = "block";
      approval.style.opacity = "0";
      approval.style.transform = "scale(0.9)";
      
      setTimeout(() => {
        approval.style.opacity = "1";
        approval.style.transform = "scale(1)";
      }, 50);
    }, 50);
    
    // Request PiP after animations
    setTimeout(() => {
      // Disable controls before requesting PiP
      video.controls = false;
      video.disablePictureInPictureControls = true;
      
      video.requestPictureInPicture().then(pipWindow => {
        console.log('PiP started, keeping container size consistent');
        appState = 'pip';
        console.log('PiP active, state:', appState);
      }).catch(err => {
        // Reset to preview state on error
        exitPiPToPreview();
        console.error('PiP failed:', err);
      });
    }, 250);
    
  } catch (err) {
    console.error('PiP error:', err);
  }
}

async function exitPiP() {
  try {
    console.log('Exiting PiP...');
    
    await document.exitPictureInPicture();
    
    // Keep container size consistent - don't change it
    console.log('PiP ended, keeping container size consistent');
    
    // Smooth transition back to video
    const placeholderContent = previewPlaceholder.querySelector('.placeholder-content');
    
    // Fade out PiP content
    placeholderContent.style.opacity = "0";
    placeholderContent.style.transform = "scale(0.9)";
    
    setTimeout(() => {
      // Restore original placeholder content
      restoreDefaultPlaceholder();
      
      // Fade placeholder out and video in
      setTimeout(() => {
        previewPlaceholder.classList.add("hiding");
        video.classList.add("active");
        appState = 'preview';
        console.log('Back to preview, state:', appState);
        
        // Ensure placeholder content is properly reset for future use
        placeholderContent.style.opacity = "1";
        placeholderContent.style.transform = "scale(1)";
      }, 100);
    }, 150);
    
    // Hide approval message
    setTimeout(() => {
      approval.style.opacity = "0";
      approval.style.transform = "scale(0.9)";
      
      setTimeout(() => {
        approval.style.display = "none";
        approval.style.opacity = "1";
        approval.style.transform = "scale(1)";
      }, 300);
    }, 100);
    
  } catch (err) {
    console.error('Exit PiP error:', err);
  }
}

async function stopCamera() {
  if (!video.srcObject) return;
  
  console.log('Stopping camera...');
  
  // Stop detection if running
  if (detectBtn.innerText === "Stop Detection") {
    stopDetection();
    detectBtn.innerText = "Start Detection";
    detectBtn.style.background = "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)";
  }
  
  // Exit PiP if active
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(console.error);
  }
  
  // Stop all camera tracks immediately
  const stream = video.srcObject;
  console.log('Stopping stream with tracks:', stream.getTracks().length);
  
  stream.getTracks().forEach((track) => {
    console.log('Stopping track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
    track.enabled = false;
    track.stop();
    console.log('Track stopped, new readyState:', track.readyState);
  });
  
  // Additional cleanup steps
  video.pause();
  video.srcObject = null;
  video.load();
  
  // Show placeholder and reset state
  video.classList.remove("active");
  previewPlaceholder.classList.remove("hiding");
  approval.style.display = "none";
  detectBtn.disabled = true;
  appState = 'off';
  
  // Always restore default placeholder content when camera stops
  setTimeout(() => {
    restoreDefaultPlaceholder();
  }, 100);
  
  console.log('Camera stopped, state:', appState);
}

function exitPiPToPreview() {
  // Helper function to exit PiP and return to preview state
  previewPlaceholder.classList.add("hiding");
  video.classList.add("active");
  approval.style.display = "none";
  appState = 'preview';
  restoreDefaultPlaceholder();
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

