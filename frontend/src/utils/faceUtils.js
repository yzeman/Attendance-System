import * as faceapi from 'face-api.js';

// Try multiple sources - one will work!
const MODEL_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
  'https://unpkg.com/face-api.js@0.22.2/weights/',
  '/models/'
];

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

  loadingPromise = new Promise(async (resolve) => {
    console.log('🔄 Starting to load face models...');
    
    let loaded = false;
    
    // Try each source until one works
    for (let source of MODEL_SOURCES) {
      console.log(`📥 Trying to load from: ${source}`);
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(source);
        console.log('✅ TinyFaceDetector loaded from:', source);
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(source);
        console.log('✅ FaceLandmark68 loaded from:', source);
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(source);
        console.log('✅ FaceRecognition loaded from:', source);
        
        loaded = true;
        console.log(`✅ ALL models loaded successfully from: ${source}`);
        break; // Success - exit the loop
      } catch (error) {
        console.warn(`❌ Failed to load from ${source}:`, error.message);
        // Continue to next source
      }
    }

    if (!loaded) {
      console.error('❌ All model loading attempts failed');
    }
    
    modelsLoaded = loaded;
    loadingPromise = null;
    resolve(loaded);
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
