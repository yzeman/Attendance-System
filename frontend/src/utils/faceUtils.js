import * as faceapi from 'face-api.js';

// Use the models from your Vercel deployment
const MODEL_URL = '/models/';

// Track loading state
let modelsLoaded = false;
let loadingPromise = null;

export const loadModels = async () => {
  // If already loaded, return immediately
  if (modelsLoaded) return true;
  
  // If already loading, wait for it
  if (loadingPromise) return loadingPromise;

  console.log('🔄 Starting to load face models...');
  
  loadingPromise = new Promise(async (resolve) => {
    try {
      console.log('Loading from:', MODEL_URL);
      
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      console.log('✅ TinyFaceDetector loaded');
      
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      console.log('✅ FaceLandmark68 loaded');
      
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      console.log('✅ FaceRecognition loaded');
      
      modelsLoaded = true;
      console.log('✅ All face models loaded successfully!');
      resolve(true);
    } catch (error) {
      console.error('❌ Error loading face models:', error);
      modelsLoaded = false;
      resolve(false);
    } finally {
      loadingPromise = null;
    }
  });

  return loadingPromise;
};

// Function to check if models are loaded
export const areModelsReady = () => modelsLoaded;

// Rest of the file stays the same...
export const getFaceDescriptor = async (videoElement) => {
  try {
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    return Array.from(detection.descriptor);
  } catch (error) {
    console.error('Error detecting face:', error);
    return null;
  }
};

export const compareDescriptors = (descriptor1, descriptor2, threshold = 0.6) => {
  if (!descriptor1 || !descriptor2) return false;
  if (descriptor1.length !== descriptor2.length) return false;

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    sum += Math.pow(descriptor1[i] - descriptor2[i], 2);
  }
  const distance = Math.sqrt(sum);
  return distance < threshold;
};
