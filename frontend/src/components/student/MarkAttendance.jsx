import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { loadModels, getFaceDescriptor, compareDescriptors } from '../../utils/faceUtils';
import { Container, Row, Col, Card, Button, Alert, Spinner, Form, Badge } from 'react-bootstrap';

const MarkAttendance = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [debugMessages, setDebugMessages] = useState([]);
  const [faceMatched, setFaceMatched] = useState(false);
  const videoRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));

  const addDebug = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages(prev => [...prev, { timestamp, message, isError }]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    const init = async () => {
      addDebug('🔵 MarkAttendance: Initializing...');
      
      await loadModels();
      setModelsReady(true);
      setModelsLoading(false);
      
      await startWebcam();
      await fetchCourses();
      await fetchTodayAttendance();
      
      addDebug('✅ Initialization complete');
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
      addDebug('📷 Starting webcam...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamStarted(true);
        addDebug('✅ Webcam started');
      }
    } catch (err) {
      console.error('Webcam error:', err);
      addDebug('❌ Webcam error: ' + err.message);
      setMessage('⚠️ Unable to access webcam. Please allow camera permissions.');
      setMessageType('warning');
    }
  };

  const fetchCourses = async () => {
    try {
      addDebug('🔵 Fetching enrolled courses for: ' + user?.email);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) {
        addDebug('❌ User fetch error: ' + userError.message, true);
        throw userError;
      }

      let enrolledIds = userData?.enrolled_courses || [];
      enrolledIds = [...new Set(enrolledIds)];
      addDebug(`📋 Enrolled course IDs: ${enrolledIds.length} course(s)`);

      if (enrolledIds.length > 0) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', enrolledIds);

        if (courseError) {
          addDebug('❌ Courses fetch error: ' + courseError.message, true);
          throw courseError;
        }
        
        addDebug(`✅ Courses fetched: ${coursesData?.length || 0} courses`);
        setCourses(coursesData || []);
        
      } else {
        addDebug('⚠️ No enrolled courses found');
        setCourses([]);
        setMessage('ℹ️ You are not enrolled in any courses. Please contact your lecturer.');
        setMessageType('info');
      }
    } catch (error) {
      addDebug('❌ Error fetching courses: ' + error.message, true);
      setMessage('❌ Error loading courses. Please refresh.');
      setMessageType('danger');
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      addDebug('🔵 Fetching today\'s attendance...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('course_id')
        .eq('student_id', user.id)
        .gte('date', today.toISOString());

      if (error) {
        addDebug('❌ Attendance fetch error: ' + error.message, true);
        throw error;
      }
      
      const marked = (data || []).map(a => a.course_id);
      setTodayAttendance(marked);
      addDebug(`✅ Today's attendance: ${marked.length} course(s)`);
      
      // Auto-select first ACTIVE and UNMARKED course
      if (courses.length > 0) {
        const activeCourses = courses.filter(c => c.is_active !== false && c.attendance_enabled !== false);
        const firstUnmarked = activeCourses.find(c => !marked.includes(c.id));
        if (firstUnmarked) {
          setSelectedCourse(firstUnmarked.id);
          addDebug(`🔄 Auto-selected: ${firstUnmarked.course_code}`);
        } else {
          setSelectedCourse('');
        }
      }
    } catch (error) {
      addDebug('❌ Error fetching today\'s attendance: ' + error.message, true);
    }
  };

  // Get only ACTIVE courses (is_active = true AND attendance_enabled = true)
  const activeCourses = courses.filter(c => c.is_active !== false && c.attendance_enabled !== false);
  
  // Separate active courses into marked and unmarked
  const markedActiveCourses = activeCourses.filter(c => todayAttendance.includes(c.id));
  const unmarkedActiveCourses = activeCourses.filter(c => !todayAttendance.includes(c.id));

  const handleMarkAttendance = async () => {
    if (!selectedCourse) {
      setMessage('⚠️ Please select a course.');
      setMessageType('warning');
      return;
    }

    const selectedCourseData = courses.find(c => c.id === selectedCourse);
    
    if (!selectedCourseData || selectedCourseData.is_active === false || selectedCourseData.attendance_enabled === false) {
      setMessage('⏳ This course is not available for attendance.');
      setMessageType('warning');
      return;
    }

    if (todayAttendance.includes(selectedCourse)) {
      setMessage('⚠️ You have already marked attendance for this course today.');
      setMessageType('warning');
      return;
    }

    if (!modelsReady) {
      setMessage('⚠️ Face recognition models are still loading. Please wait.');
      setMessageType('warning');
      return;
    }

    if (!webcamStarted) {
      setMessage('⚠️ Webcam not ready. Please refresh the page.');
      setMessageType('warning');
      return;
    }

    setIsMarking(true);
    setMessage('');
    setMessageType('');
    setFaceMatched(false);
    addDebug('📸 Starting attendance marking for course: ' + selectedCourse);

    try {
      const liveDescriptor = await getFaceDescriptor(videoRef.current);
      if (!liveDescriptor) {
        setMessage('❌ No face detected. Please look straight at the camera.');
        setMessageType('danger');
        addDebug('❌ No face detected');
        setIsMarking(false);
        return;
      }
      addDebug('✅ Face captured');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('face_descriptors')
        .eq('id', user.id)
        .single();

      if (userError) {
        addDebug('❌ User fetch error: ' + userError.message, true);
        throw userError;
      }

      const storedDescriptors = userData.face_descriptors || [];
      addDebug(`📋 Found ${storedDescriptors.length} stored face samples`);
      
      if (storedDescriptors.length === 0) {
        setMessage('❌ No face samples found. Please re-register with face enrolment.');
        setMessageType('danger');
        addDebug('❌ No face samples found');
        setIsMarking(false);
        return;
      }

      let matched = false;
      for (let i = 0; i < storedDescriptors.length; i++) {
        if (compareDescriptors(liveDescriptor, storedDescriptors[i], 0.6)) {
          matched = true;
          setFaceMatched(true);
          addDebug(`✅ Face matched with sample ${i + 1}`);
          break;
        }
      }

      if (!matched) {
        setMessage('❌ Face does not match your registered profile. Please try again.');
        setMessageType('danger');
        addDebug('❌ Face did not match any stored sample');
        setIsMarking(false);
        return;
      }

      if (todayAttendance.includes(selectedCourse)) {
        setMessage('⚠️ You have already marked attendance for this course today.');
        setMessageType('warning');
        addDebug('⚠️ Already marked today');
        setIsMarking(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: user.id,
          course_id: selectedCourse,
          status: 'present'
        });

      if (insertError) {
        addDebug('❌ Insert error: ' + insertError.message, true);
        throw insertError;
      }

      const updatedMarked = [...todayAttendance, selectedCourse];
      setTodayAttendance(updatedMarked);
      addDebug('✅ Attendance saved successfully');

      setMessage('✅ Attendance marked successfully! ✓');
      setMessageType('success');

      const course = courses.find(c => c.id === selectedCourse);
      if (course) {
        addDebug(`✅ ${course.course_code} marked present`);
      }

      // Auto-select next unmarked active course
      const nextUnmarked = activeCourses.find(c => !updatedMarked.includes(c.id));
      if (nextUnmarked) {
        setTimeout(() => {
          setSelectedCourse(nextUnmarked.id);
          addDebug(`🔄 Auto-selected next: ${nextUnmarked.course_code}`);
          setFaceMatched(false);
        }, 1500);
      } else {
        setTimeout(() => {
          setSelectedCourse('');
          addDebug('✅ All active courses marked today!');
          setFaceMatched(false);
        }, 1500);
      }

    } catch (error) {
      addDebug('❌ Error marking attendance: ' + error.message, true);
      setMessage('❌ Error marking attendance. Please try again.');
      setMessageType('danger');
    }

    setIsMarking(false);
  };

  const getSelectedCourseDetails = () => {
    return courses.find(c => c.id === selectedCourse);
  };

  const allActiveCourses = activeCourses.length;
  const allMarkedToday = markedActiveCourses.length;
  const progressPercentage = allActiveCourses > 0 ? Math.round((allMarkedToday / allActiveCourses) * 100) : 0;

  return (
    <Container className="mt-4">
      <div className="animate-fade-in">
        <h2 className="mb-4">📷 Mark Attendance</h2>

        {message && (
          <Alert 
            variant={messageType || 'info'} 
            className="mb-3"
            onClose={() => { setMessage(''); setMessageType(''); }}
            dismissible
          >
            {message}
          </Alert>
        )}

        <Row>
          {/* Left Column - Camera */}
          <Col md={7}>
            <Card className="p-3 shadow-lg" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">📹 Live Camera</h5>
              <div className="video-container bg-dark rounded" style={{ position: 'relative', overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-100"
                  style={{ maxHeight: '400px', minHeight: '300px' }}
                />
                {faceMatched && (
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 255, 0, 0.85)',
                    padding: '8px 24px',
                    borderRadius: '25px',
                    color: '#fff',
                    fontWeight: 'bold',
                    zIndex: 10,
                    fontSize: '1.1rem'
                  }}>
                    ✅ Face Verified!
                  </div>
                )}
                {!faceMatched && isMarking && (
                  <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 165, 0, 0.85)',
                    padding: '8px 24px',
                    borderRadius: '25px',
                    color: '#fff',
                    fontWeight: 'bold',
                    zIndex: 10,
                    fontSize: '1.1rem'
                  }}>
                    ⏳ Verifying...
                  </div>
                )}
              </div>
              <div className="mt-2 d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small">
                    {modelsReady ? '✅ Models ready' : modelsLoading ? '⏳ Loading...' : '❌ Failed'}
                  </span>
                  <span className="text-muted small ms-3">
                    {webcamStarted ? '✅ Webcam active' : '⏳ Starting...'}
                  </span>
                </div>
                <div>
                  <span className="text-muted small">
                    📊 {allMarkedToday} / {allActiveCourses} marked
                  </span>
                </div>
              </div>
            </Card>
          </Col>

          {/* Right Column - Controls */}
          <Col md={5}>
            <Card className="p-3 shadow-lg" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">📚 Select Course</h5>

              {/* Progress Bar */}
              {allActiveCourses > 0 && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small">Progress</span>
                    <span className="small fw-bold">{progressPercentage}%</span>
                  </div>
                  <div className="progress" style={{ height: '8px', borderRadius: '10px' }}>
                    <div 
                      className="progress-bar bg-success" 
                      style={{ 
                        width: `${progressPercentage}%`,
                        borderRadius: '10px',
                        transition: 'width 0.5s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {courses.length === 0 ? (
                <Alert variant="info" className="mt-3">
                  You are not enrolled in any courses.
                </Alert>
              ) : allActiveCourses === 0 ? (
                <Alert variant="warning" className="mt-3">
                  No active courses available for attendance.
                </Alert>
              ) : (
                <>
                  {/* Unmarked Active Courses */}
                  {unmarkedActiveCourses.length > 0 ? (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#28a745' }}>
                        ✅ Available to Mark
                      </Form.Label>
                      <Form.Select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        disabled={isMarking}
                        style={{ fontSize: '1rem', padding: '10px', borderRadius: '10px', borderColor: '#28a745' }}
                      >
                        {unmarkedActiveCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.course_code} - {course.course_name}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <div style={{ fontSize: '40px' }}>🎉</div>
                      <p className="text-success fw-bold mt-2">All courses marked today!</p>
                    </div>
                  )}

                  {/* Already Marked */}
                  {markedActiveCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#6c757d' }}>
                        ✅ Already Marked Today
                      </Form.Label>
                      <div className="p-2 bg-light rounded" style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '10px' }}>
                        {markedActiveCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2 py-1">
                            <Badge bg="success" className="p-1">✅</Badge>
                            <span className="text-muted small">{course.course_code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Course Info */}
                  {getSelectedCourseDetails() && unmarkedActiveCourses.length > 0 && (
                    <div className="p-2 bg-light rounded" style={{ border: '2px solid #28a745', borderRadius: '10px' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong style={{ color: '#28a745' }}>{getSelectedCourseDetails().course_code}</strong>
                          <br />
                          <small className="text-muted">{getSelectedCourseDetails().course_name}</small>
                          <br />
                          <small className="text-muted">👨‍🏫 {getSelectedCourseDetails().lecturer || 'N/A'}</small>
                        </div>
                        <Badge bg="warning">⏳ Pending</Badge>
                      </div>
                    </div>
                  )}

                  {/* Mark Button */}
                  {unmarkedActiveCourses.length > 0 ? (
                    <Button
                      variant="success"
                      onClick={handleMarkAttendance}
                      disabled={isMarking || !modelsReady || modelsLoading || !selectedCourse}
                      className="w-100 mt-3"
                      size="lg"
                      style={{ padding: '14px', fontSize: '1.2rem', borderRadius: '10px' }}
                    >
                      {isMarking ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Verifying...
                        </>
                      ) : (
                        '📸 Mark Present'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="success"
                      disabled={true}
                      className="w-100 mt-3"
                      size="lg"
                      style={{ padding: '14px', fontSize: '1.2rem', borderRadius: '10px' }}
                    >
                      ✅ All Done
                    </Button>
                  )}
                </>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default MarkAttendance;
