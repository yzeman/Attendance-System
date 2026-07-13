import * as faceapi from 'face-api.js';

// Use CDN models instead of local files
// This is more reliable on Render
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// Track loading state
let modelsLoaded = false;
let loadingPromise = null;

export const loadModels = async () => {
  // If already loaded, return immediately
  if (modelsLoaded) {
    console.log('✅ Models already loaded');
    return true;
  }
  
  // If already loading, wait for it
  if (loadingPromise) {
    console.log('⏳ Models already loading, waiting...');
    return loadingPromise;
  }

  console.log('🔄 Starting to load face models from CDN:', MODEL_URL);
  
  loadingPromise = new Promise(async (resolve) => {
    try {
      // Load TinyFaceDetector
      console.log('📥 Loading TinyFaceDetector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      console.log('✅ TinyFaceDetector loaded');
      
      // Load FaceLandmark68
      console.log('📥 Loading FaceLandmark68...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      console.log('✅ FaceLandmark68 loaded');
      
      // Load FaceRecognition
      console.log('📥 Loading FaceRecognition...');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      console.log('✅ FaceRecognition loaded');
      
      modelsLoaded = true;
      console.log('✅ ALL face models loaded successfully from CDN!');
      resolve(true);
    } catch (error) {
      console.error('❌ Error loading face models from CDN:', error);
      modelsLoaded = false;
      resolve(false);
    } finally {
      loadingPromise = null;
    }
  });

  return loadingPromise;
};

// Function to check if models are ready
export const areModelsLoaded = () => modelsLoaded;

// Detect face and extract descriptor from video element
export const getFaceDescriptor = async (videoElement) => {
  if (!modelsLoaded) {
    console.warn('⚠️ Models not loaded yet!');
    return null;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('👤 No face detected');
      return null;
    }

    console.log('✅ Face detected with descriptor');
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error('Error detecting face:', error);
    return null;
  }
};

// Compare two face descriptors using Euclidean distance
export const compareDescriptors = (descriptor1, descriptor2, threshold = 0.6) => {
  if (!descriptor1 || !descriptor2) {
    console.warn('⚠️ Missing descriptors for comparison');
    return false;
  }
  if (descriptor1.length !== descriptor2.length) {
    console.warn('⚠️ Descriptor lengths do not match');
    return false;
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    sum += Math.pow(descriptor1[i] - descriptor2[i], 2);
  }
  const distance = Math.sqrt(sum);
  
  console.log(`📊 Face distance: ${distance.toFixed(4)} (threshold: ${threshold})`);
  return distance < threshold;
};

// Capture multiple face samples for enrolment
export const captureFaceSamples = async (videoElement, numberOfSamples = 3) => {
  console.log(`📸 Capturing ${numberOfSamples} face samples...`);
  const samples = [];
  let attempts = 0;
  const maxAttempts = numberOfSamples * 5;

  while (samples.length < numberOfSamples && attempts < maxAttempts) {
    attempts++;
    const descriptor = await getFaceDescriptor(videoElement);
    if (descriptor) {
      samples.push(descriptor);
      console.log(`✅ Sample ${samples.length}/${numberOfSamples} captured`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`📸 Captured ${samples.length} face samples`);
  return samples;
};
