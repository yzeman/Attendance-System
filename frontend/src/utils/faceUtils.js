import * as faceapi from 'face-api.js';

// Path to the model files (inside public/models/)
const MODEL_URL = '/models';

// Load all face-api.js models
export const loadModels = async () => {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('✅ Face models loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Error loading face models:', error);
    return false;
  }
};

// Detect face and extract descriptor from video element
export const getFaceDescriptor = async (videoElement) => {
  try {
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return null; // No face detected
    }

    // Convert Float32Array to regular array for storage
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error('Error detecting face:', error);
    return null;
  }
};

// Compare two face descriptors using Euclidean distance
export const compareDescriptors = (descriptor1, descriptor2, threshold = 0.6) => {
  if (!descriptor1 || !descriptor2) return false;
  if (descriptor1.length !== descriptor2.length) return false;

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    sum += Math.pow(descriptor1[i] - descriptor2[i], 2);
  }
  const distance = Math.sqrt(sum);
  
  // Lower distance = better match
  // 0.6 is a typical threshold for face-api.js
  return distance < threshold;
};

// Capture multiple face samples for enrolment
export const captureFaceSamples = async (videoElement, numberOfSamples = 3) => {
  const samples = [];
  let attempts = 0;
  const maxAttempts = numberOfSamples * 5;

  while (samples.length < numberOfSamples && attempts < maxAttempts) {
    attempts++;
    const descriptor = await getFaceDescriptor(videoElement);
    if (descriptor) {
      samples.push(descriptor);
    }
    // Wait a bit before next capture
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return samples;
};

// Check if models are loaded
export const areModelsLoaded = async () => {
  try {
    const tinyFaceDetector = await faceapi.nets.tinyFaceDetector.isLoaded();
    const faceLandmark68 = await faceapi.nets.faceLandmark68Net.isLoaded();
    const faceRecognition = await faceapi.nets.faceRecognitionNet.isLoaded();
    return tinyFaceDetector && faceLandmark68 && faceRecognition;
  } catch {
    return false;
  }
};
