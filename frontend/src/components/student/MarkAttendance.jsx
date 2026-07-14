import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { loadModels, getFaceDescriptor, compareDescriptors } from '../../utils/faceUtils';
import { Container, Row, Col, Card, Button, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';

const MarkAttendance = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [debugMessage, setDebugMessage] = useState('⏳ Initializing...');
  const videoRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));

  // Add debug function
  const addDebug = (msg) => {
    console.log(msg);
    setDebugMessage(msg);
  };

  useEffect(() => {
    const init = async () => {
      addDebug('🔵 MarkAttendance: Initializing...');
      
      // 1. Load face recognition models
      addDebug('🔄 Loading face models...');
      setModelsLoading(true);
      const loaded = await loadModels();
      setModelsReady(loaded);
      setModelsLoading(false);
      addDebug(loaded ? '✅ Models loaded successfully' : '❌ Models failed to load');
      
      // 2. Start webcam
      await startWebcam();
      
      // 3. Fetch courses and today's attendance
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
      
      // Get the student's enrolled course IDs
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ User fetch error:', userError);
        addDebug('❌ User fetch error: ' + userError.message);
        throw userError;
      }

      console.log('🔵 Enrolled course IDs:', userData?.enrolled_courses);
      addDebug('📋 Enrolled course IDs: ' + JSON.stringify(userData?.enrolled_courses));

      if (userData?.enrolled_courses?.length) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', userData.enrolled_courses);

        if (courseError) {
          console.error('❌ Courses fetch error:', courseError);
          addDebug('❌ Courses fetch error: ' + courseError.message);
          throw courseError;
        }
        
        console.log('✅ Courses fetched:', coursesData);
        addDebug(`✅ Courses fetched: ${coursesData?.length || 0} courses`);
        setCourses(coursesData || []);
        
        if (coursesData?.length === 0) {
          setMessage('ℹ️ You are enrolled but no courses found in the system.');
          setMessageType('info');
        }
      } else {
        console.log('⚠️ No enrolled courses found');
        addDebug('⚠️ No enrolled courses found');
        setCourses([]);
        setMessage('ℹ️ You are not enrolled in any courses. Please contact your lecturer.');
        setMessageType('info');
      }
    } catch (error) {
      console.error('❌ Error fetching courses:', error);
      addDebug('❌ Error fetching courses: ' + error.message);
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
        console.error('❌ Attendance fetch error:', error);
        addDebug('❌ Attendance fetch error: ' + error.message);
        throw error;
      }
      
      const marked = (data || []).map(a => a.course_id);
      setTodayAttendance(marked);
      addDebug(`✅ Today's attendance: ${marked.length} course(s)`);
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      addDebug('❌ Error fetching today\'s attendance: ' + error.message);
    }
  };

  const handleMarkAttendance = async (courseId) => {
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
    addDebug('📸 Starting attendance marking for course: ' + courseId);

    try {
      // 1. Get live face descriptor
      addDebug('📸 Capturing face...');
      const liveDescriptor = await getFaceDescriptor(videoRef.current);
      if (!liveDescriptor) {
        setMessage('❌ No face detected. Please look straight at the camera and try again.');
        setMessageType('danger');
        addDebug('❌ No face detected');
        setIsMarking(false);
        return;
      }
      addDebug('✅ Face captured');

      // 2. Fetch stored face descriptors for this student
      addDebug('🔵 Fetching stored face descriptors...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('face_descriptors')
        .eq('id', user.id)
        .single();

      if (userError) {
        addDebug('❌ User fetch error: ' + userError.message);
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

      // 3. Compare live face with stored descriptors
      addDebug('🔍 Comparing faces...');
      let matched = false;
      for (let i = 0; i < storedDescriptors.length; i++) {
        if (compareDescriptors(liveDescriptor, storedDescriptors[i], 0.6)) {
          matched = true;
          addDebug(`✅ Face matched with sample ${i + 1}`);
          break;
        }
      }

      if (!matched) {
        setMessage('❌ Face does not match your registered profile. Please try again or contact admin.');
        setMessageType('danger');
        addDebug('❌ Face did not match any stored sample');
        setIsMarking(false);
        return;
      }

      // 4. Check if already marked for this course today
      if (todayAttendance.includes(courseId)) {
        setMessage('⚠️ You have already marked attendance for this course today.');
        setMessageType('warning');
        addDebug('⚠️ Already marked today');
        setIsMarking(false);
        return;
      }

      // 5. Insert attendance record
      addDebug('💾 Saving attendance record...');
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: user.id,
          course_id: courseId,
          status: 'present'
        });

      if (insertError) {
        addDebug('❌ Insert error: ' + insertError.message);
        throw insertError;
      }

      // 6. Update today's attendance list
      setTodayAttendance(prev => [...prev, courseId]);
      addDebug('✅ Attendance saved successfully');

      setMessage('✅ Attendance marked successfully! ✓');
      setMessageType('success');

      // Find course name for success message
      const course = courses.find(c => c.id === courseId);
      if (course) {
        addDebug(`✅ ${course.course_code} - ${course.course_name} marked present`);
      }
      setSelectedCourse(null);

    } catch (error) {
      console.error('Error marking attendance:', error);
      addDebug('❌ Error marking attendance: ' + error.message);
      setMessage('❌ Error marking attendance. Please try again.');
      setMessageType('danger');
    }

    setIsMarking(false);
  };

  const isCourseMarked = (courseId) => {
    return todayAttendance.includes(courseId);
  };

  return (
    <Container className="mt-4">
      <div className="animate-fade-in">
        <h2 className="mb-4">📷 Mark Attendance</h2>

        {/* Debug Status */}
        <Alert variant="info" className="mb-3">
          <strong>🔍 Status:</strong> {debugMessage}
        </Alert>

        <Row>
          {/* Camera Section */}
          <Col md={6}>
            <Card className="p-3 shadow-lg">
              <h5 className="mb-3">Live Camera</h5>
              <div className="video-container bg-dark rounded">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-100"
                  style={{ maxHeight: '350px' }}
                />
              </div>
              <div className="mt-2 d-flex justify-content-between">
                <small className="text-muted">
                  {modelsReady ? '✅ Models loaded' : modelsLoading ? '⏳ Loading models...' : '❌ Models failed'}
                </small>
                <small className="text-muted">
                  {webcamStarted ? '✅ Webcam active' : '⏳ Starting webcam...'}
                </small>
              </div>
            </Card>
          </Col>

          {/* Course Selection Section */}
          <Col md={6}>
            <Card className="p-3 shadow-lg">
              <h5 className="mb-3">📚 Select Course</h5>

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

              {courses.length === 0 ? (
                <Alert variant="info">
                  You are not enrolled in any courses yet.
                </Alert>
              ) : (
                <ListGroup className="mb-3">
                  {courses.map((course) => (
                    <ListGroup.Item
                      key={course.id}
                      action
                      onClick={() => setSelectedCourse(course)}
                      active={selectedCourse?.id === course.id}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <strong>{course.course_code}</strong>
                        <br />
                        <small className="text-muted">{course.course_name}</small>
                      </div>
                      {isCourseMarked(course.id) && (
                        <Badge bg="success" pill>
                          ✅ Marked Today
                        </Badge>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}

              {selectedCourse && (
                <div className="mt-2">
                  <div className="p-2 bg-light rounded mb-3">
                    <strong>Selected:</strong> {selectedCourse.course_code} - {selectedCourse.course_name}
                  </div>
                  <Button
                    variant="success"
                    onClick={() => handleMarkAttendance(selectedCourse.id)}
                    disabled={isMarking || isCourseMarked(selectedCourse.id) || !modelsReady || modelsLoading}
                    className="w-100"
                    size="lg"
                  >
                    {isMarking ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Verifying Face...
                      </>
                    ) : isCourseMarked(selectedCourse.id) ? (
                      '✅ Already Marked Today'
                    ) : (
                      '📸 Mark Present'
                    )}
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Today's Summary */}
        <Row className="mt-4">
          <Col md={12}>
            <Card className="p-3 shadow-sm">
              <h5 className="mb-3">Today's Attendance Summary</h5>
              {todayAttendance.length === 0 ? (
                <p className="text-muted">No attendance marked today yet.</p>
              ) : (
                <div>
                  <p>✅ You have marked <strong>{todayAttendance.length}</strong> course(s) today:</p>
                  <div className="d-flex flex-wrap gap-2">
                    {todayAttendance.map((courseId) => {
                      const course = courses.find(c => c.id === courseId);
                      return course ? (
                        <Badge key={courseId} bg="success" className="p-2">
                          {course.course_code}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
};

export default MarkAttendance;
