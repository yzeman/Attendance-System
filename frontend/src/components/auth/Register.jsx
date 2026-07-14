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
  const [debugDetails, setDebugDetails] = useState([]);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  const addDebugLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, data: data ? JSON.stringify(data, null, 2) : null };
    setDebugDetails(prev => [...prev, logEntry]);
    setDebugMessage(message);
    console.log(`[${timestamp}] ${message}`, data || '');
  };

  useEffect(() => {
    const init = async () => {
      addDebugLog('🔵 Register page mounted - starting...');
      await startWebcam();
      
      setModelsLoading(true);
      addDebugLog('🔄 Loading face models (attempt 1/5)...');
      
      let loaded = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!loaded && attempts < maxAttempts) {
        attempts++;
        addDebugLog(`🔄 Loading attempt ${attempts} of ${maxAttempts}...`);
        try {
          loaded = await loadModels();
          addDebugLog(`📥 Models loaded result: ${loaded}`);
        } catch (err) {
          addDebugLog(`❌ Attempt ${attempts} error: ${err.message}`);
          loaded = false;
        }
        
        if (!loaded && attempts < maxAttempts) {
          addDebugLog(`⏳ Waiting 3 seconds before retry ${attempts + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      setModelsReady(loaded);
      setModelsLoading(false);
      
      if (loaded) {
        addDebugLog('✅ Models are ready! You can now capture faces.');
      } else {
        addDebugLog('❌ Models failed after 5 attempts. Please refresh the page.');
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
        addDebugLog('✅ Webcam started!');
      }
    } catch (err) {
      addDebugLog('❌ Webcam error: ' + err.message);
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
    addDebugLog('📸 Capturing face...');
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
        setFaceDescriptors(prev => [...prev, descriptor]);
        addDebugLog(`✅ Captured ${faceDescriptors.length + 1} samples`);
        setSuccess(`✅ Face captured! (${faceDescriptors.length + 1}/3 samples)`);
        setError('');
      } else {
        addDebugLog('❌ No face detected. Please look straight at the camera.');
        setError('❌ No face detected. Please look straight at the camera.');
      }
    } catch (err) {
      addDebugLog('❌ Error: ' + err.message);
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
    addDebugLog('📝 Submitting registration...');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (faceDescriptors.length < 2) {
      setError('Please capture at least 2 face samples for accurate recognition.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Sign up with Supabase Auth
      addDebugLog('🔐 Step 1: Creating auth account...', { email: formData.email });
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

      if (authError) {
        addDebugLog('❌ Auth error: ' + authError.message);
        throw authError;
      }

      addDebugLog('✅ Auth account created! User ID: ' + authData.user.id);

      // ⭐ KEY FIX: Wait 2 seconds for auth to propagate
      addDebugLog('⏳ Waiting 2 seconds for auth to propagate...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Insert into users table
      addDebugLog('💾 Step 2: Inserting into users table...');

      const insertData = {
        id: authData.user.id,
        full_name: formData.fullName,
        matric_no: formData.matricNo,
        phone: formData.phone,
        email: formData.email,
        face_descriptors: faceDescriptors,
        role: 'student'
      };

      addDebugLog('📤 Insert data:', insertData);

      const { data: insertResult, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select();

      if (insertError) {
        addDebugLog('❌ Insert error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        throw insertError;
      }

      addDebugLog('✅ User profile inserted!', insertResult);

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

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      addDebugLog('❌ Registration error: ' + err.message, {
        name: err.name,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
      setError(err.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  const handleResetFace = () => {
    setFaceDescriptors([]);
    addDebugLog('🔄 Face samples reset');
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

            <Alert variant="info" className="mb-3">
              <strong>🔍 Status:</strong> {debugMessage}
            </Alert>

            <div className="mb-3" style={{ maxHeight: '150px', overflowY: 'auto', background: '#f8f9fa', borderRadius: '5px', padding: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
              <strong>📋 Debug Log:</strong>
              {debugDetails.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid #eee', padding: '2px 0' }}>
                  <span style={{ color: '#666' }}>[{log.timestamp}]</span> {log.message}
                  {log.data && (
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#007bff' }}>📄 Show data</summary>
                      <pre style={{ fontSize: '10px', margin: '5px 0', padding: '5px', background: '#fff', borderRadius: '3px', overflow: 'auto', maxHeight: '100px' }}>{log.data}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>

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
