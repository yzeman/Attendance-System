import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { loadModels, getFaceDescriptor, areModelsLoaded } from '../../utils/faceUtils';
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
  const [webcamStarted, setWebcamStarted] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load face recognition models
    const initModels = async () => {
      const loaded = await loadModels();
      setModelsReady(loaded);
    };
    initModels();

    // Start webcam
    startWebcam();

    // Cleanup
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
      }
    } catch (err) {
      console.error('Webcam error:', err);
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
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
        setFaceDescriptors(prev => [...prev, descriptor]);
        setSuccess(`✅ Face captured! (${faceDescriptors.length + 1}/3 samples)`);
        setError('');
      } else {
        setError('❌ No face detected. Please look straight at the camera.');
      }
    } catch (err) {
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
      setError(err.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  const handleResetFace = () => {
    setFaceDescriptors([]);
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
                        disabled={capturing || !modelsReady || !webcamStarted}
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
                      {!modelsReady && (
                        <div className="text-warning small mt-2">
                          ⏳ Loading face models...
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
                disabled={loading || faceDescriptors.length < 2}
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
