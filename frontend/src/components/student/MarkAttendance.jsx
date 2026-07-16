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
  const [courseStatuses, setCourseStatuses] = useState({});
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
      await fetchCourseStatuses();
      await markAbsentForOffCourses();
      
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
        .select('course_id, status')
        .eq('student_id', user.id)
        .gte('date', today.toISOString());

      if (error) {
        addDebug('❌ Attendance fetch error: ' + error.message, true);
        throw error;
      }
      
      const presentCourses = (data || []).filter(a => a.status === 'present').map(a => a.course_id);
      setTodayAttendance(presentCourses);
      addDebug(`✅ Today's present: ${presentCourses.length} course(s)`);
      
    } catch (error) {
      addDebug('❌ Error fetching today\'s attendance: ' + error.message, true);
    }
  };

  const fetchCourseStatuses = async () => {
    try {
      addDebug('🔵 Fetching course statuses for today...');
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('course_schedule')
        .select('course_id, is_active, turned_on_at, turned_off_at')
        .eq('date', today);

      if (error) {
        addDebug('❌ Course status fetch error: ' + error.message, true);
        return;
      }

      const statusMap = {};
      data.forEach(record => {
        statusMap[record.course_id] = {
          is_active: record.is_active,
          turned_on_at: record.turned_on_at,
          turned_off_at: record.turned_off_at
        };
      });
      setCourseStatuses(statusMap);
      addDebug(`✅ Course statuses fetched: ${Object.keys(statusMap).length} course(s)`);
      
    } catch (error) {
      addDebug('❌ Error fetching course statuses: ' + error.message, true);
    }
  };

  const markAbsentForOffCourses = async () => {
    try {
      addDebug('🔵 Checking for absent courses...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get all courses that are OFF or Inactive
      const offCourses = courses.filter(c => c.is_active === false || c.attendance_enabled === false);
      
      let absentCount = 0;
      
      for (let course of offCourses) {
        // Check if already has attendance record today
        const { data: existing, error: checkError } = await supabase
          .from('attendance')
          .select('id, status')
          .eq('student_id', user.id)
          .eq('course_id', course.id)
          .gte('date', today.toISOString());

        if (checkError) {
          console.error('Error checking attendance:', checkError);
          continue;
        }

        // If no record exists, mark as absent
        if (!existing || existing.length === 0) {
          const { error: insertError } = await supabase
            .from('attendance')
            .insert({
              student_id: user.id,
              course_id: course.id,
              status: 'absent',
              date: today
            });

          if (insertError) {
            console.error('Error marking absent:', insertError);
          } else {
            absentCount++;
            addDebug(`✅ Marked absent for: ${course.course_code}`);
          }
        }
      }

      if (absentCount > 0) {
        addDebug(`✅ Marked ${absentCount} course(s) as absent`);
      }
      
      // Refresh today's attendance
      await fetchTodayAttendance();
      
    } catch (error) {
      addDebug('❌ Error marking absent: ' + error.message, true);
    }
  };

  const getCourseStatus = (course) => {
    const status = courseStatuses[course.id];
    const isMarked = todayAttendance.includes(course.id);
    
    // If already marked present
    if (isMarked) {
      return { 
        status: 'marked', 
        label: '✅ Already Marked', 
        color: 'success',
        canMark: false 
      };
    }
    
    // If course is inactive
    if (course.is_active === false) {
      return { 
        status: 'inactive', 
        label: '⏳ Course Inactive', 
        color: 'secondary',
        canMark: false 
      };
    }
    
    // If attendance is disabled (OFF)
    if (course.attendance_enabled === false) {
      // Check if it was ever turned ON today
      if (status && status.turned_on_at) {
        // It was turned ON at some point but now OFF → Student missed it
        return { 
          status: 'ended', 
          label: '❌ Class Ended', 
          color: 'danger',
          canMark: false 
        };
      } else {
        // Never turned ON today
        return { 
          status: 'not_started', 
          label: '⏳ Not Started Yet', 
          color: 'warning',
          canMark: false 
        };
      }
    }
    
    // Course is ON (attendance_enabled = true)
    if (status && status.is_active === true) {
      return { 
        status: 'lecturing', 
        label: '📖 Lecture in Progress', 
        color: 'success',
        canMark: true 
      };
    }
    
    // Default: not started
    return { 
      status: 'not_started', 
      label: '⏳ Not Started Yet', 
      color: 'warning',
      canMark: false 
    };
  };

  const handleMarkAttendance = async () => {
    if (!selectedCourse) {
      setMessage('⚠️ Please select a course.');
      setMessageType('warning');
      return;
    }

    const selectedCourseData = courses.find(c => c.id === selectedCourse);
    const courseStatus = getCourseStatus(selectedCourseData);
    
    if (!courseStatus.canMark) {
      setMessage(`⏳ This course is ${courseStatus.label.toLowerCase()}.`);
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

      // Double check if already marked
      if (todayAttendance.includes(selectedCourse)) {
        setMessage('⚠️ You have already marked attendance for this course today.');
        setMessageType('warning');
        addDebug('⚠️ Already marked today');
        setIsMarking(false);
        return;
      }

      // Check if course is still ON
      const currentCourse = courses.find(c => c.id === selectedCourse);
      const currentStatus = getCourseStatus(currentCourse);
      if (!currentStatus.canMark) {
        setMessage('⏳ This course is no longer accepting attendance.');
        setMessageType('warning');
        setIsMarking(false);
        return;
      }

      // Check if there's an absent record to update to present
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: existingAbsent } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', selectedCourse)
        .eq('status', 'absent')
        .gte('date', today.toISOString());

      if (existingAbsent && existingAbsent.length > 0) {
        // Update absent to present
        const { error: updateError } = await supabase
          .from('attendance')
          .update({ status: 'present' })
          .eq('id', existingAbsent[0].id);

        if (updateError) {
          addDebug('❌ Update error: ' + updateError.message, true);
          throw updateError;
        }
        addDebug('✅ Updated absent to present');
      } else {
        // Insert new present record
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            student_id: user.id,
            course_id: selectedCourse,
            status: 'present',
            date: today
          });

        if (insertError) {
          addDebug('❌ Insert error: ' + insertError.message, true);
          throw insertError;
        }
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

      // Auto-select next available course
      const availableCourses = courses.filter(c => {
        const status = getCourseStatus(c);
        return status.canMark && !updatedMarked.includes(c.id);
      });
      
      if (availableCourses.length > 0) {
        setTimeout(() => {
          setSelectedCourse(availableCourses[0].id);
          addDebug(`🔄 Auto-selected next: ${availableCourses[0].course_code}`);
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

  const getSelectedCourseDetails = () => {
    return courses.find(c => c.id === selectedCourse);
  };

  // Separate courses by status
  const lecturingCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.canMark && !todayAttendance.includes(c.id);
  });

  const markedCourses = courses.filter(c => todayAttendance.includes(c.id));

  const endedCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'ended' && !todayAttendance.includes(c.id);
  });

  const notStartedCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'not_started' && !todayAttendance.includes(c.id);
  });

  const inactiveCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'inactive' && !todayAttendance.includes(c.id);
  });

  const allAvailableCourses = lecturingCourses.length + markedCourses.length + endedCourses.length + notStartedCourses.length + inactiveCourses.length;
  const progressPercentage = allAvailableCourses > 0 ? Math.round((markedCourses.length / (lecturingCourses.length + markedCourses.length)) * 100) : 0;

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
          {/* Camera Section */}
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
                    📊 {markedCourses.length} / {lecturingCourses.length + markedCourses.length} marked
                  </span>
                </div>
              </div>

              {/* Mark Attendance Button */}
              {lecturingCourses.length > 0 ? (
                <Button
                  variant="success"
                  onClick={handleMarkAttendance}
                  disabled={isMarking || !modelsReady || modelsLoading || !selectedCourse}
                  className="w-100 mt-3"
                  size="lg"
                  style={{ padding: '16px', fontSize: '1.3rem', borderRadius: '12px' }}
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
                markedCourses.length > 0 && (
                  <Button
                    variant="success"
                    disabled={true}
                    className="w-100 mt-3"
                    size="lg"
                    style={{ padding: '16px', fontSize: '1.3rem', borderRadius: '12px' }}
                  >
                    ✅ All Done
                  </Button>
                )
              )}
            </Card>
          </Col>

          {/* Controls Section */}
          <Col md={5}>
            <Card className="p-3 shadow-lg" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">📚 Course Selection</h5>

              {/* Progress Bar */}
              {(lecturingCourses.length + markedCourses.length) > 0 && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small">Today's Progress</span>
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
              ) : (
                <>
                  {/* Lecturing Courses (ON) - Available to Mark */}
                  {lecturingCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#28a745' }}>
                        📖 Lecture in Progress ({lecturingCourses.length})
                      </Form.Label>
                      <Form.Select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        disabled={isMarking}
                        style={{ fontSize: '1rem', padding: '10px', borderRadius: '10px', borderColor: '#28a745' }}
                      >
                        <option value="">-- Select Course --</option>
                        {lecturingCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.course_code} - {course.course_name} 📖
                          </option>
                        ))}
                      </Form.Select>
                      <small className="text-muted">These courses are currently lecturing. Mark your attendance now!</small>
                    </div>
                  )}

                  {/* Already Marked Today */}
                  {markedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#6c757d' }}>
                        ✅ Already Marked ({markedCourses.length})
                      </Form.Label>
                      <div className="p-2 bg-light rounded" style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '10px' }}>
                        {markedCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2 py-1">
                            <Badge bg="success" className="p-1">✅</Badge>
                            <span className="text-muted small">{course.course_code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Class Ended (Was ON but turned OFF) */}
                  {endedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#dc3545' }}>
                        ❌ Class Ended ({endedCourses.length})
                      </Form.Label>
                      <div className="p-2 rounded" style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #dc3545', borderRadius: '10px', background: '#fff5f5' }}>
                        {endedCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2 py-1">
                            <Badge bg="danger" className="p-1">❌</Badge>
                            <span className="text-muted small">{course.course_code}</span>
                          </div>
                        ))}
                      </div>
                      <small className="text-muted">You missed these courses. Class has ended.</small>
                    </div>
                  )}

                  {/* Not Started Yet */}
                  {notStartedCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#ffc107' }}>
                        ⏳ Not Started Yet ({notStartedCourses.length})
                      </Form.Label>
                      <div className="p-2 rounded" style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #ffc107', borderRadius: '10px', background: '#fff8e1' }}>
                        {notStartedCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2 py-1">
                            <Badge bg="warning" className="p-1">⏳</Badge>
                            <span className="text-muted small">{course.course_code}</span>
                          </div>
                        ))}
                      </div>
                      <small className="text-muted">These courses haven't started yet today.</small>
                    </div>
                  )}

                  {/* Inactive Courses */}
                  {inactiveCourses.length > 0 && (
                    <div className="mb-3">
                      <Form.Label className="fw-bold" style={{ color: '#6c757d' }}>
                        ⏳ Inactive ({inactiveCourses.length})
                      </Form.Label>
                      <div className="p-2 rounded" style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #ced4da', borderRadius: '10px', background: '#f8f9fa' }}>
                        {inactiveCourses.map((course) => (
                          <div key={course.id} className="d-flex align-items-center gap-2 py-1">
                            <Badge bg="secondary" className="p-1">⏳</Badge>
                            <span className="text-muted small">{course.course_code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Course Info */}
                  {getSelectedCourseDetails() && lecturingCourses.length > 0 && selectedCourse && (
                    <div className="p-2 bg-light rounded" style={{ border: '2px solid #28a745', borderRadius: '10px' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong style={{ color: '#28a745' }}>{getSelectedCourseDetails().course_code}</strong>
                          <br />
                          <small className="text-muted">{getSelectedCourseDetails().course_name}</small>
                          <br />
                          <small className="text-muted">👨‍🏫 {getSelectedCourseDetails().lecturer || 'N/A'}</small>
                        </div>
                        <Badge bg="success">📖 In Progress</Badge>
                      </div>
                    </div>
                  )}

                  {/* No Courses Available */}
                  {lecturingCourses.length === 0 && markedCourses.length === 0 && courses.length > 0 && (
                    <div className="text-center py-3">
                      <div style={{ fontSize: '40px' }}>⏳</div>
                      <p className="text-muted mt-2">No courses are currently available.</p>
                      <small className="text-muted">Check back later when a course starts.</small>
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
