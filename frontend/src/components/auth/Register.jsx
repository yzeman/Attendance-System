import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { loadModels, getFaceDescriptor } from '../../utils/faceUtils';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    matricNo: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceDescriptors, setFaceDescriptors] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [debugMessage, setDebugMessage] = useState('⏳ Initializing...');
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      setDebugMessage('🔵 Starting registration page...');
      console.log('🔵 Register page mounted - starting...');
      
      // 1. Start webcam first
      setDebugMessage('📷 Starting webcam...');
      await startWebcam();
      
      // 2. Load models with retry
      setModelsLoading(true);
      setDebugMessage('🔄 Loading face models (attempt 1/5)...');
      console.log('🔵 Loading face models...');
      
      let loaded = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!loaded && attempts < maxAttempts) {
        attempts++;
        setDebugMessage(`🔄 Loading attempt ${attempts} of ${maxAttempts}...`);
        console.log(`🔵 Loading attempt ${attempts}...`);
        
        try {
          loaded = await loadModels();
        } catch (err) {
          console.error('Attempt error:', err);
          loaded = false;
        }
        
        if (!loaded && attempts < maxAttempts) {
          setDebugMessage(`⏳ Waiting 3 seconds before retry ${attempts + 1}...`);
          console.log('⏳ Waiting 3 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      setModelsReady(loaded);
      setModelsLoading(false);
      
      if (loaded) {
        setDebugMessage('✅ Models are ready! You can now capture faces.');
        console.log('✅ Models are ready!');
      } else {
        setDebugMessage('❌ Models failed after 5 attempts. Please refresh the page.');
        console.log('❌ Models failed after 5 attempts');
        setError('Face models failed to load. Please refresh the page and try again.');
      }
    };
    
    init();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamStarted(true);
        setDebugMessage('✅ Webcam started!');
        console.log('✅ Webcam started');
      }
    } catch (err) {
      console.error('Webcam error:', err);
      setDebugMessage('❌ Webcam error: ' + err.message);
      setError('Unable to access webcam. Please allow camera permissions.');
    }
  };

  const handleCaptureFace = async () => {
    if (!modelsReady) {
      setError('Face recognition models are still loading. Please wait.');
      return;
    }

    if (!videoRef.current || !webcamStarted) {
      setError('Webcam not ready. Please refresh the page.');
      return;
    }

    setCapturing(true);
    setDebugMessage('📸 Capturing face...');
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
        setFaceDescriptors(prev => [...prev, descriptor]);
        setSuccess(`✅ Face captured! (${faceDescriptors.length + 1}/3 samples)`);
        setDebugMessage(`✅ Captured ${faceDescriptors.length + 1} samples`);
        setError('');
      } else {
        setDebugMessage('❌ No face detected. Please look straight at the camera.');
        setError('❌ No face detected. Please look straight at the camera.');
      }
    } catch (err) {
      setDebugMessage('❌ Error: ' + err.message);
      setError('Error capturing face: ' + err.message);
    }
    setCapturing(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setDebugMessage('📝 Submitting registration...');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Validate face samples
    if (faceDescriptors.length < 2) {
      setError('Please capture at least 2 face samples for accurate recognition.');
      setLoading(false);
      return;
    }

    try {
      // 1. Sign up with Supabase Auth
      setDebugMessage('🔐 Creating account...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            matric_no: formData.matricNo
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Registration failed. Please try again.');
      }

      // 2. Insert user profile into our 'users' table
      setDebugMessage('💾 Saving profile...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          full_name: formData.fullName,
          matric_no: formData.matricNo,
          phone: formData.phone,
          face_descriptors: faceDescriptors,
          role: 'student'
        });

      if (insertError) throw insertError;

      setDebugMessage('✅ Registration successful!');
      setSuccess('✅ Registration successful! You can now login.');
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        matricNo: '',
        phone: ''
      });
      setFaceDescriptors([]);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setDebugMessage('❌ Error: ' + err.message);
      setError(err.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  const handleResetFace = () => {
    setFaceDescriptors([]);
    setDebugMessage('🔄 Face samples reset');
    setSuccess('Face samples reset. Please capture new samples.');
  };

  return (
    <Container className="mt-4 mb-5">
      <Row className="justify-content-center">
        <Col md={10} lg={8}>
          <Card className="p-4 shadow-lg animate-fade-in">
            <div className="text-center mb-4">
              <h2 className="fw-bold">Student Registration</h2>
              <p className="text-muted">Create your account with face enrolment</p>
            </div>

            {/* 🔍 Debug Message Box - Shows what's happening */}
            <Alert variant="info" className="mb-3">
              <strong>🔍 Status:</strong> {debugMessage}
            </Alert>

            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="fullName"
                      placeholder="Enter full name"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Matric Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="matricNo"
                      placeholder="Enter matric number"
                      value={formData.matricNo}
                      onChange={handleChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      placeholder="Enter email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Phone Number</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      placeholder="Create password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Confirm Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <hr className="my-4" />

              <div className="text-center">
                <h5 className="mb-3">📸 Face Enrolment</h5>
                <p className="text-muted small">
                  Look straight at the camera and click "Capture Face" at least 3 times
                </p>
              </div>

              <Row>
                <Col md={7}>
                  <div className="video-container bg-dark rounded">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-100"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                </Col>
                <Col md={5}>
                  <div className="d-flex flex-column h-100 justify-content-center">
                    <div className="text-center mb-3">
                      <div className="display-6">{faceDescriptors.length}</div>
                      <small className="text-muted">Face Samples Captured</small>
                    </div>
                    <div className="d-grid gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleCaptureFace}
                        disabled={capturing || !modelsReady || !webcamStarted || modelsLoading}
                      >
                        {capturing ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Capturing...
                          </>
                        ) : (
                          '📷 Capture Face'
                        )}
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={handleResetFace}
                        disabled={faceDescriptors.length === 0}
                      >
                        🔄 Reset Samples
                      </Button>
                      {modelsLoading && (
                        <div className="text-warning small mt-2">
                          ⏳ Loading face models... Please wait (10-15 seconds)
                        </div>
                      )}
                      {!modelsLoading && !modelsReady && (
                        <div className="text-danger small mt-2">
                          ❌ Models failed to load. Please refresh.
                        </div>
                      )}
                      {modelsReady && (
                        <div className="text-success small mt-2">
                          ✅ Face models ready!
                        </div>
                      )}
                      {faceDescriptors.length >= 2 && (
                        <div className="text-success small mt-2">
                          ✅ Enough samples captured!
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>

              <hr className="my-4" />

              <Button
                variant="primary"
                type="submit"
                className="w-100"
                disabled={loading || faceDescriptors.length < 2 || !modelsReady || modelsLoading}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Registering...
                  </>
                ) : (
                  'Register Now'
                )}
              </Button>

              <div className="text-center mt-3">
                <p className="text-muted">
                  Already have an account? <Link to="/login" className="text-primary fw-bold">Login here</Link>
                </p>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Register;
