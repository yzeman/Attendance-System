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
    phone: '',
    gender: '',
    level: '',
    department: ''
  });
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceDescriptors, setFaceDescriptors] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Start webcam
      await startWebcam();
      
      // Load models
      setModelsLoading(true);
      let loaded = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!loaded && attempts < maxAttempts) {
        attempts++;
        try {
          loaded = await loadModels();
        } catch (err) {
          loaded = false;
        }
        if (!loaded && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      setModelsReady(loaded);
      setModelsLoading(false);
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'department') {
      setShowDepartmentDropdown(false);
    }
  };

  const handleDepartmentSelect = (dept) => {
    setFormData({ ...formData, department: dept });
    setSearchTerm(dept);
    setShowDepartmentDropdown(false);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    // Validate required fields
    if (!formData.gender) {
      setError('Please select your gender.');
      setLoading(false);
      return;
    }
    if (!formData.level) {
      setError('Please select your level.');
      setLoading(false);
      return;
    }
    if (!formData.department) {
      setError('Please select your department.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Sign up with Supabase Auth
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

      // Step 2: Insert into users table with all fields
      const insertData = {
        id: authData.user.id,
        full_name: formData.fullName,
        matric_no: formData.matricNo,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        level: formData.level,
        department: formData.department,
        face_descriptors: faceDescriptors,
        role: 'student',
        profile_completed: true // All fields are filled during registration
      };

      const { error: insertError } = await supabase
        .from('users')
        .insert(insertData);

      if (insertError) throw insertError;

      setSuccess('✅ Registration successful! You can now login.');
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        matricNo: '',
        phone: '',
        gender: '',
        level: '',
        department: ''
      });
      setFaceDescriptors([]);
      setSearchTerm('');

      setTimeout(() => {
        navigate('/login');
      }, 3000);

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
                    <Form.Label>Full Name <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Matric Number <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Email Address <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Phone Number <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Password <span className="text-danger">*</span></Form.Label>
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
                    <Form.Label>Confirm Password <span className="text-danger">*</span></Form.Label>
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

              <h5 className="mb-3">Additional Information</h5>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Gender <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Level <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="level"
                      value={formData.level}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Level</option>
                      <option value="ND1">ND1</option>
                      <option value="ND2">ND2</option>
                      <option value="HND1">HND1</option>
                      <option value="HND2">HND2</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                    <div style={{ position: 'relative' }}>
                      <Form.Control
                        type="text"
                        name="department"
                        placeholder="Search for your department..."
                        value={formData.department || searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setShowDepartmentDropdown(true);
                          if (e.target.value === '') {
                            setFormData({ ...formData, department: '' });
                          }
                        }}
                        onFocus={() => setShowDepartmentDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDepartmentDropdown(false), 200)}
                        required
                      />
                      {showDepartmentDropdown && searchTerm && (
                        <div className="dropdown-menu show w-100" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {filteredDepartments.length > 0 ? (
                            filteredDepartments.map((dept) => (
                              <button
                                key={dept.id}
                                className="dropdown-item"
                                type="button"
                                onClick={() => handleDepartmentSelect(dept.name)}
                              >
                                {dept.name}
                              </button>
                            ))
                          ) : (
                            <div className="dropdown-item text-muted">
                              {searchTerm ? `No department found matching "${searchTerm}"` : 'Type to search...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Form.Text className="text-muted">
                      Start typing to search for your department. If not found, contact admin.
                    </Form.Text>
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
                          ⏳ Loading face models...
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
