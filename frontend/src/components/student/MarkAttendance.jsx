import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { loadModels, getFaceDescriptor, compareDescriptors, areModelsLoaded } from '../../utils/faceUtils';
import { Container, Row, Col, Card, Button, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';

const MarkAttendance = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const videoRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    // Load face recognition models
    const initModels = async () => {
      const loaded = await loadModels();
      setModelsReady(loaded);
    };
    initModels();

    // Start webcam
    startWebcam();

    // Fetch courses and today's attendance
    fetchCourses();
    fetchTodayAttendance();

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
      setMessage('⚠️ Unable to access webcam. Please allow camera permissions.');
      setMessageType('warning');
    }
  };

  const fetchCourses = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('enrolled_courses')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (userData?.enrolled_courses?.length) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', userData.enrolled_courses);

        if (courseError) throw courseError;
        setCourses(coursesData || []);
      } else {
        setMessage('ℹ️ You are not enrolled in any courses. Please contact your lecturer.');
        setMessageType('info');
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      setMessage('❌ Error loading courses.');
      setMessageType('danger');
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('course_id')
        .eq('student_id', user.id)
        .gte('date', today.toISOString());

      if (error) throw error;
      setTodayAttendance((data || []).map(a => a.course_id));
    } catch (error) {
      console.error('Error fetching today attendance:', error);
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

    try {
      // 1. Get live face descriptor
      const liveDescriptor = await getFaceDescriptor(videoRef.current);
      if (!liveDescriptor) {
        setMessage('❌ No face detected. Please look straight at the camera and try again.');
        setMessageType('danger');
        setIsMarking(false);
        return;
      }

      // 2. Fetch stored face descriptors for this student
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('face_descriptors')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const storedDescriptors = userData.face_descriptors || [];
      if (storedDescriptors.length === 0) {
        setMessage('❌ No face samples found. Please re-register with face enrolment.');
        setMessageType('danger');
        setIsMarking(false);
        return;
      }

      // 3. Compare live face with stored descriptors
      let matched = false;
      let matchIndex = -1;
      for (let i = 0; i < storedDescriptors.length; i++) {
        if (compareDescriptors(liveDescriptor, storedDescriptors[i], 0.6)) {
          matched = true;
          matchIndex = i;
          break;
        }
      }

      if (!matched) {
        setMessage('❌ Face does not match your registered profile. Please try again or contact admin.');
        setMessageType('danger');
        setIsMarking(false);
        return;
      }

      // 4. Check if already marked for this course today
      if (todayAttendance.includes(courseId)) {
        setMessage('⚠️ You have already marked attendance for this course today.');
        setMessageType('warning');
        setIsMarking(false);
        return;
      }

      // 5. Insert attendance record
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: user.id,
          course_id: courseId,
          status: 'present'
        });

      if (insertError) throw insertError;

      // 6. Update today's attendance list
      setTodayAttendance(prev => [...prev, courseId]);

      setMessage('✅ Attendance marked successfully! ✓');
      setMessageType('success');

      // 7. Find course name for success message
      const course = courses.find(c => c.id === courseId);
      setSelectedCourse(null);

    } catch (error) {
      console.error('Error marking attendance:', error);
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
                  {modelsReady ? '✅ Models loaded' : '⏳ Loading models...'}
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
                    disabled={isMarking || isCourseMarked(selectedCourse.id)}
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
