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
      
      // Auto-select first UNMARKED AND ACTIVE course
      if (courses.length > 0) {
        const firstUnmarked = courses.find(c => !marked.includes(c.id) && c.attendance_enabled !== false && c.is_active !== false);
        if (firstUnmarked) {
          setSelectedCourse(firstUnmarked.id);
          addDebug(`🔄 Auto-selected unmarked course: ${firstUnmarked.course_code}`);
        } else {
          // Check if all courses are either marked or inactive
          const hasUnmarkedInactive = courses.some(c => !marked.includes(c.id) && (c.attendance_enabled === false || c.is_active === false));
          if (hasUnmarkedInactive) {
            // There are inactive courses, don't auto-select
            setSelectedCourse('');
            addDebug('⚠️ Some courses are inactive or not started');
          } else {
            setSelectedCourse('');
            addDebug('✅ All courses marked today!');
          }
        }
      }
    } catch (error) {
      addDebug('❌ Error fetching today\'s attendance: ' + error.message, true);
    }
  };

  // ✅ CHECK: Can student mark attendance for this course?
  const canMarkCourse = (course) => {
    if (!course) return false;
    if (course.is_active === false) return 'inactive';
    if (course.attendance_enabled === false) return 'not_started';
    return 'available';
  };

  const handleMarkAttendance = async () => {
    if (!selectedCourse) {
      setMessage('⚠️ Please select a course.');
      setMessageType('warning');
      return;
    }

    // ✅ CHECK course status before proceeding
    const selectedCourseData = courses.find(c => c.id === selectedCourse);
    const status = canMarkCourse(selectedCourseData);

    if (status === 'inactive') {
      setMessage('⏳ This course is currently inactive. Please contact your lecturer.');
      setMessageType('warning');
      return;
    }

    if (status === 'not_started') {
      setMessage('⏳ Class hasn\'t commenced yet for this course. Please check back later.');
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
        setMessage('❌ No face detected. Please look straight at the camera and try again.');
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

      // Double check if already marked
      if (todayAttendance.includes(selectedCourse)) {
        setMessage('⚠️ You have already marked attendance for this course today.');
        setMessageType('warning');
        addDebug('⚠️ Already marked today (double-check)');
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
        addDebug(`✅ ${course.course_code} - ${course.course_name} marked present`);
      }

      // Auto-select next unmarked AND ACTIVE course
      const nextUnmarked = courses.find(c => !updatedMarked.includes(c.id) && c.attendance_enabled !== false && c.is_active !== false);
      if (nextUnmarked) {
        setTimeout(() => {
          setSelectedCourse(nextUnmarked.id);
          addDebug(`🔄 Auto-selected next course: ${nextUnmarked.course_code}`);
          setFaceMatched(false);
        }, 1500);
      } else {
        setTimeout(() => {
          setSelectedCourse('');
          addDebug('✅ All available courses marked today!');
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

  const isCourseMarked = (courseId) => {
    return todayAttendance.includes(courseId);
  };

  const getSelectedCourseDetails = () => {
    return courses.find(c => c.id === selectedCourse);
  };

  // ✅ Filter courses by status for display
  const markedCourses = courses.filter(c => todayAttendance.includes(c.id));
  const unmarkedCourses = courses.filter(c => !todayAttendance.includes(c.id));
  
  // ✅ Filter unmarked courses that are available to mark
  const availableUnmarkedCourses = unmarkedCourses.filter(c => c.attendance_enabled !== false && c.is_active !== false);
  const inactiveUnmarkedCourses = unmarkedCourses.filter(c => c.attendance_enabled === false || c.is_active === false);

  return (
    <Container className="mt-4">
      <div className="animate-fade-in">
        <h2 className="mb-4">📷 Mark Attendance</h2>

        <Row>
          {/* Camera Section */}
          <Col md={7}>
            <Card className="p-3 shadow-lg">
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
                    background: 'rgba(0, 255, 0, 0.8)',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    color: '#fff',
                    fontWeight: 'bold',
                    zIndex: 10
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
                    background: 'rgba(255, 165, 0, 0.8)',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    color: '#fff',
                    fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    ⏳ Verifying Face...
                  </div>
                )}
              </div>
              <div className="mt-2 d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted">
                    {modelsReady ? '✅ Models loaded' : modelsLoading ? '⏳ Loading models...' : '❌ Models failed'}
                  </small>
                  <br />
                  <small className="text-muted">
                    {webcamStarted ? '✅ Webcam active' : '⏳ Starting webcam...'}
                  </small>
                </div>
                <div>
                  <small className="text-muted">
                    📊 {todayAttendance.length} / {courses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length} available marked
                  </small>
                </div>
              </div>

              {/* MARK ATTENDANCE BUTTON */}
              {availableUnmarkedCourses.length > 0 ? (
                <Button
                  variant="success"
                  onClick={handleMarkAttendance}
                  disabled={isMarking || !modelsReady || modelsLoading || !selectedCourse}
                  className="w-100 mt-3"
                  size="lg"
                  style={{ padding: '15px', fontSize: '1.2rem', borderRadius: '10px' }}
                >
                  {isMarking ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Verifying Face...
                    </>
                  ) : (
                    `📸 Mark Present (${courses.find(c => c.id === selectedCourse)?.course_code || ''})`
                  )}
                </Button>
              ) : (
                courses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length > 0 && (
                  <Button
                    variant="success"
                    disabled={true}
                    className="w-100 mt-3"
                    size="lg"
                    style={{ padding: '15px', fontSize: '1.2rem', borderRadius: '10px' }}
                  >
                    ✅ All Available Courses Marked Today! 🎉
                  </Button>
                )
              )}
            </Card>
          </Col>

          {/* Controls Section */}
          <Col md={5}>
            <Card className="p-3 shadow-lg">
              <h5 className="mb-3">📚 Course Selection</h5>

              {/* Today's Progress */}
              <div className="mb-3 p-2 bg-light rounded">
                <div className="d-flex justify-content-between align-items-center">
                  <span>📊 Today's Progress:</span>
                  <Badge bg="primary" className="p-2">
                    {todayAttendance.length} / {courses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length} marked
                  </Badge>
                </div>
                <div className="mt-1" style={{ height: '6px', background: '#e9ecef', borderRadius: '3px' }}>
                  <div 
                    style={{ 
                      height: '6px', 
                      width: courses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length > 0 
                        ? `${(todayAttendance.length / courses.filter(c => c.attendance_enabled !== false && c.is_active !== false).length) * 100}%` 
                        : '0%',
                      background: 'linear-gradient(90deg, #28a745, #20c997)',
                      borderRadius: '3px',
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
              </div>

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
                  You are not enrolled in any courses yet.<br />
                  <small>Please contact your lecturer or admin.</small>
                </Alert>
              ) : (
                <>
                  {/* Available Courses to Mark */}
                  {availableUnmarkedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#28a745' }}>
                        ✅ Available to Mark ({availableUnmarkedCourses.length}):
                      </Form.Label>
                      <Form.Select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        disabled={isMarking}
                        style={{ fontSize: '1rem', padding: '10px', borderColor: '#28a745' }}
                      >
                        {availableUnmarkedCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.course_code} - {course.course_name} ✅
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  )}

                  {/* Inactive/Not Started Courses */}
                  {inactiveUnmarkedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#ffc107' }}>
                        ⏳ Inactive / Not Started ({inactiveUnmarkedCourses.length}):
                      </Form.Label>
                      <div className="p-2 bg-light rounded" style={{ border: '1px solid #ffc107', maxHeight: '100px', overflowY: 'auto' }}>
                        {inactiveUnmarkedCourses.map((course) => {
                          const isInactive = course.is_active === false;
                          const isNotStarted = course.attendance_enabled === false;
                          let statusText = '';
                          let statusColor = '#6c757d';
                          
                          if (isInactive) {
                            statusText = '⏳ Inactive';
                            statusColor = '#6c757d';
                          } else if (isNotStarted) {
                            statusText = '⏳ Not Started';
                            statusColor = '#ffc107';
                          }
                          
                          return (
                            <div key={course.id} className="d-flex align-items-center gap-2">
                              <Badge bg="secondary">⏳</Badge>
                              <span className="text-muted">{course.course_code} - {course.course_name}</span>
                              <small style={{ color: statusColor }}>({statusText})</small>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Marked Courses */}
                  {markedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#6c757d' }}>
                        ✅ Already Marked Today ({markedCourses.length}):
                      </Form.Label>
                      <div className="p-2 bg-light rounded" style={{ border: '1px solid #dee2e6', maxHeight: '100px', overflowY: 'auto' }}>
                        {markedCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2">
                            <Badge bg="success">✅</Badge>
                            <span className="text-muted">{course.course_code} - {course.course_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Course Info */}
                  {getSelectedCourseDetails() && selectedCourse && availableUnmarkedCourses.length > 0 && (
                    <div className="p-2 bg-light rounded" style={{ border: '2px solid #28a745' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong style={{ color: '#28a745' }}>{getSelectedCourseDetails().course_code}</strong>
                          <br />
                          <small className="text-muted">{getSelectedCourseDetails().course_name}</small>
                          <br />
                          <small className="text-muted">👨‍🏫 {getSelectedCourseDetails().lecturer || 'N/A'}</small>
                        </div>
                        <Badge bg="warning" className="p-2">
                          ⏳ Pending
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* All Done Message */}
                  {availableUnmarkedCourses.length === 0 && courses.length > 0 && (
                    <div className="text-center mt-2">
                      <div style={{ fontSize: '32px' }}>🎉</div>
                      <p className="text-success fw-bold">All available courses marked today!</p>
                      {inactiveUnmarkedCourses.length > 0 && (
                        <small className="text-muted">
                          ({inactiveUnmarkedCourses.length} course(s) inactive or not started)
                        </small>
                      )}
                    </div>
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
