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
  const [todayAbsentRecords, setTodayAbsentRecords] = useState([]);
  const [courseStatuses, setCourseStatuses] = useState({});
  const [debugMessages, setDebugMessages] = useState([]);
  const [faceMatched, setFaceMatched] = useState(false);
  const [absentDebug, setAbsentDebug] = useState([]);
  const [absentCheckDone, setAbsentCheckDone] = useState(false);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const videoRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));

  const addDebug = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, isError };
    setDebugMessages(prev => [...prev, entry]);
    console.log(`[${timestamp}] ${message}`);
  };

  const addAbsentDebug = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, data: data ? JSON.stringify(data, null, 2) : null };
    setAbsentDebug(prev => [...prev, entry]);
    console.log(`[${timestamp}] 📊 ${message}`, data || '');
  };

  useEffect(() => {
    const loadData = async () => {
      addDebug('🔵 MarkAttendance: Loading data...');
      
      await loadModels();
      setModelsReady(true);
      setModelsLoading(false);
      
      await startWebcam();
      await loadAllData();
    };
    
    loadData();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const runAbsentCheck = async () => {
      if (courses.length > 0) {
        addDebug(`🔵 Running absent check with ${courses.length} courses`);
        await markAbsentForOffCourses();
        setAbsentCheckDone(true);
      } else {
        addDebug('⏳ Waiting for courses to load...');
      }
    };
    
    runAbsentCheck();
  }, [courses, attendanceRefreshKey]);

  const loadAllData = async () => {
    await fetchCourses();
    await fetchTodayAttendance();
    await fetchCourseStatuses();
    setAttendanceRefreshKey(prev => prev + 1);
  };

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
      addDebug('🔵 Fetching enrolled courses...');
      
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
      addDebug(`📋 Enrolled course IDs: ${enrolledIds.length}`);

      if (enrolledIds.length > 0) {
        const { data: coursesData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', enrolledIds);

        if (courseError) {
          addDebug('❌ Courses fetch error: ' + courseError.message, true);
          throw courseError;
        }
        
        addDebug(`✅ Courses fetched: ${coursesData?.length || 0}`);
        setCourses(coursesData || []);
        
      } else {
        addDebug('⚠️ No enrolled courses found');
        setCourses([]);
        setMessage('ℹ️ You are not enrolled in any courses.');
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
      const absentCourses = (data || []).filter(a => a.status === 'absent').map(a => a.course_id);
      
      setTodayAttendance(presentCourses);
      setTodayAbsentRecords(absentCourses);
      
      addDebug(`✅ Today's present: ${presentCourses.length}, absent: ${absentCourses.length}`);
      
      return data || [];
      
    } catch (error) {
      addDebug('❌ Error fetching today\'s attendance: ' + error.message, true);
      return [];
    }
  };

  const fetchCourseStatuses = async () => {
    try {
      addDebug('🔵 Fetching course statuses...');
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
      addDebug(`✅ Course statuses: ${Object.keys(statusMap).length}`);
      
    } catch (error) {
      addDebug('❌ Error fetching course statuses: ' + error.message, true);
    }
  };

  const markAbsentForOffCourses = async () => {
    try {
      addDebug('🔵 ===== STARTING ABSENT CHECK =====');
      
      if (courses.length === 0) {
        addDebug('⚠️ No courses loaded yet');
        return;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      let absentCount = 0;
      
      for (let course of courses) {
        const isPresent = todayAttendance.includes(course.id);
        const isAbsent = todayAbsentRecords.includes(course.id);
        const status = courseStatuses[course.id];
        const isActive = course.is_active;
        const attEnabled = course.attendance_enabled;
        const wasOn = status && status.turned_on_at;
        
        // Skip if already present
        if (isPresent) continue;
        
        // Skip if already has an absent record (don't duplicate)
        if (isAbsent) continue;
        
        let shouldMark = false;
        let reason = '';
        
        if (isActive === false) {
          shouldMark = true;
          reason = 'Inactive';
        } else if (attEnabled === false && wasOn) {
          shouldMark = true;
          reason = 'Class Ended';
        }
        
        if (shouldMark) {
          try {
            const { error: insertError } = await supabase
              .from('attendance')
              .insert({
                student_id: user.id,
                course_id: course.id,
                status: 'absent',
                date: today
              });

            if (!insertError) {
              absentCount++;
              addDebug(`✅ Marked ABSENT for: ${course.course_code} (${reason})`);
            }
          } catch (err) {
            console.error('Error marking absent:', err);
          }
        }
      }
      
      if (absentCount > 0) {
        addDebug(`✅ Marked ${absentCount} course(s) as ABSENT`);
        await fetchTodayAttendance();
      }
      
    } catch (error) {
      addDebug('❌ Error marking absent: ' + error.message, true);
    }
  };

  const getCourseStatus = (course) => {
    const status = courseStatuses[course.id];
    const isPresent = todayAttendance.includes(course.id);
    const isAbsent = todayAbsentRecords.includes(course.id);
    
    // ✅ If already marked present
    if (isPresent) {
      return { 
        status: 'marked', 
        label: '✅ Already Marked', 
        color: 'success',
        canMark: false 
      };
    }
    
    // ✅ If marked absent but course is now ON again - can mark!
    if (isAbsent && course.attendance_enabled === true) {
      return { 
        status: 'can_mark_from_absent', 
        label: '📖 Available (was absent, now ON)', 
        color: 'warning',
        canMark: true 
      };
    }
    
    if (course.is_active === false) {
      return { 
        status: 'inactive', 
        label: '⏳ Inactive', 
        color: 'secondary',
        canMark: false 
      };
    }
    
    if (course.attendance_enabled === false) {
      if (status && status.turned_on_at) {
        return { 
          status: 'ended', 
          label: '❌ Class Ended', 
          color: 'danger',
          canMark: false 
        };
      } else {
        return { 
          status: 'not_started', 
          label: '⏳ Not Started Yet', 
          color: 'warning',
          canMark: false 
        };
      }
    }
    
    if (status && status.is_active === true) {
      return { 
        status: 'lecturing', 
        label: '📖 Lecture in Progress', 
        color: 'success',
        canMark: true 
      };
    }
    
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
    addDebug('📸 Starting attendance marking: ' + selectedCourse);

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
      addDebug(`📋 Found ${storedDescriptors.length} face samples`);
      
      if (storedDescriptors.length === 0) {
        setMessage('❌ No face samples found. Please re-register.');
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
        setMessage('❌ Face does not match your registered profile.');
        setMessageType('danger');
        addDebug('❌ Face did not match');
        setIsMarking(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // ✅ Check if there's an existing record (present or absent)
      const { data: existingRecord } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('student_id', user.id)
        .eq('course_id', selectedCourse)
        .gte('date', today.toISOString());

      if (existingRecord && existingRecord.length > 0) {
        // ✅ If it was absent, update to present!
        if (existingRecord[0].status === 'absent') {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({ status: 'present' })
            .eq('id', existingRecord[0].id);

          if (updateError) {
            addDebug('❌ Update error: ' + updateError.message, true);
            throw updateError;
          }
          addDebug('✅ Updated absent to present (course turned ON again)');
        } else {
          // Already present - shouldn't happen but just in case
          setMessage('⚠️ You have already marked attendance for this course today.');
          setMessageType('warning');
          setIsMarking(false);
          await fetchTodayAttendance();
          return;
        }
      } else {
        // ✅ Insert new present record
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
        addDebug('✅ Inserted present record');
      }

      // ✅ Refresh all data
      await fetchTodayAttendance();
      await fetchCourseStatuses();
      
      const updatedPresent = await supabase
        .from('attendance')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('status', 'present')
        .gte('date', today.toISOString());
      
      const newMarked = (updatedPresent.data || []).map(a => a.course_id);
      setTodayAttendance(newMarked);

      setMessage('✅ Attendance marked successfully! ✓');
      setMessageType('success');

      const course = courses.find(c => c.id === selectedCourse);
      if (course) {
        addDebug(`✅ ${course.course_code} marked present`);
      }

      // ✅ Clear selected course after marking
      setSelectedCourse('');

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

  // ✅ SEPARATE COURSES BY STATUS
  const lecturingCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.canMark && !todayAttendance.includes(c.id);
  });

  const markedCourses = courses.filter(c => todayAttendance.includes(c.id));

  const endedCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'ended' && !todayAttendance.includes(c.id) && !todayAbsentRecords.includes(c.id);
  });

  const notStartedCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'not_started' && !todayAttendance.includes(c.id) && !todayAbsentRecords.includes(c.id);
  });

  const inactiveCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'inactive' && !todayAttendance.includes(c.id) && !todayAbsentRecords.includes(c.id);
  });

  // ✅ Courses marked absent but now ON again (can mark)
  const canMarkFromAbsentCourses = courses.filter(c => {
    const status = getCourseStatus(c);
    return status.status === 'can_mark_from_absent' && !todayAttendance.includes(c.id);
  });

  const progressPercentage = (lecturingCourses.length + markedCourses.length) > 0 
    ? Math.round((markedCourses.length / (lecturingCourses.length + markedCourses.length)) * 100) 
    : 0;

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

              {/* Progress Bar */}
              {(lecturingCourses.length + markedCourses.length) > 0 && (
                <div className="mt-2">
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

              {/* Mark Attendance Button */}
              {lecturingCourses.length > 0 || canMarkFromAbsentCourses.length > 0 ? (
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

          {/* Course Status Section */}
          <Col md={5}>
            <Card className="p-3 shadow-lg" style={{ borderRadius: '15px' }}>
              <h5 className="mb-3">📚 Course Status</h5>

              {/* ✅ LECTURING IN PROGRESS - DROPDOWN */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="fw-bold mb-0" style={{ color: '#28a745' }}>
                    📖 Lecture in Progress
                  </Form.Label>
                  <Badge bg="success">{lecturingCourses.length}</Badge>
                </div>
                {lecturingCourses.length === 0 ? (
                  <div className="p-2 text-muted small" style={{ border: '1px dashed #ced4da', borderRadius: '8px', background: '#f8f9fa' }}>
                    No courses currently lecturing
                  </div>
                ) : (
                  <Form.Select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    style={{ fontSize: '1rem', padding: '10px', borderRadius: '10px', borderColor: '#28a745' }}
                  >
                    <option value="">-- Select Course --</option>
                    {lecturingCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_code} - {course.course_name} 📖
                      </option>
                    ))}
                  </Form.Select>
                )}
                <small className="text-muted">Select a course to mark attendance</small>
              </div>

              {/* ✅ CAN MARK FROM ABSENT (Course was absent, now ON again) */}
              {canMarkFromAbsentCourses.length > 0 && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <Form.Label className="fw-bold mb-0" style={{ color: '#ff8c00' }}>
                      🔄 Available (Was Absent)
                    </Form.Label>
                    <Badge bg="warning">{canMarkFromAbsentCourses.length}</Badge>
                  </div>
                  <Form.Select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    style={{ fontSize: '1rem', padding: '10px', borderRadius: '10px', borderColor: '#ff8c00' }}
                  >
                    <option value="">-- Select Course --</option>
                    {canMarkFromAbsentCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_code} - {course.course_name} 🔄
                      </option>
                    ))}
                  </Form.Select>
                  <small className="text-muted">You were absent but course is now ON - mark now!</small>
                </div>
              )}

              {/* ✅ ALREADY MARKED */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="fw-bold mb-0" style={{ color: '#6c757d' }}>
                    ✅ Already Marked
                  </Form.Label>
                  <Badge bg="success">{markedCourses.length}</Badge>
                </div>
                {markedCourses.length === 0 ? (
                  <div className="p-2 text-muted small" style={{ border: '1px dashed #ced4da', borderRadius: '8px', background: '#f8f9fa' }}>
                    No courses marked today
                  </div>
                ) : (
                  <div className="p-2" style={{ border: '1px solid #28a745', borderRadius: '8px', background: '#f0fff4' }}>
                    {markedCourses.map((course) => (
                      <div key={course.id} className="d-flex justify-content-between align-items-center py-1 px-2">
                        <span className="small text-muted">{course.course_code} - {course.course_name}</span>
                        <Badge bg="success">✅ Done</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ❌ CLASS ENDED / ABSENT */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="fw-bold mb-0" style={{ color: '#dc3545' }}>
                    ❌ Class Ended (Absent)
                  </Form.Label>
                  <Badge bg="danger">{endedCourses.length}</Badge>
                </div>
                {endedCourses.length === 0 ? (
                  <div className="p-2 text-muted small" style={{ border: '1px dashed #ced4da', borderRadius: '8px', background: '#f8f9fa' }}>
                    No missed courses today
                  </div>
                ) : (
                  <div className="p-2" style={{ border: '1px solid #dc3545', borderRadius: '8px', background: '#fff5f5' }}>
                    {endedCourses.map((course) => (
                      <div key={course.id} className="d-flex justify-content-between align-items-center py-1 px-2">
                        <span className="small text-muted">{course.course_code} - {course.course_name}</span>
                        <Badge bg="danger">❌ Missed</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <small className="text-muted">You missed these courses. Class has ended.</small>
              </div>

              {/* ⏳ NOT STARTED YET */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="fw-bold mb-0" style={{ color: '#ffc107' }}>
                    ⏳ Not Started Yet
                  </Form.Label>
                  <Badge bg="warning">{notStartedCourses.length}</Badge>
                </div>
                {notStartedCourses.length === 0 ? (
                  <div className="p-2 text-muted small" style={{ border: '1px dashed #ced4da', borderRadius: '8px', background: '#f8f9fa' }}>
                    All courses have started
                  </div>
                ) : (
                  <div className="p-2" style={{ border: '1px solid #ffc107', borderRadius: '8px', background: '#fff8e1' }}>
                    {notStartedCourses.map((course) => (
                      <div key={course.id} className="d-flex justify-content-between align-items-center py-1 px-2">
                        <span className="small text-muted">{course.course_code} - {course.course_name}</span>
                        <Badge bg="warning">⏳ Waiting</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <small className="text-muted">These courses haven't started yet today.</small>
              </div>

              {/* ⏳ INACTIVE COURSES */}
              {inactiveCourses.length > 0 && (
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <Form.Label className="fw-bold mb-0" style={{ color: '#6c757d' }}>
                      ⏳ Inactive
                    </Form.Label>
                    <Badge bg="secondary">{inactiveCourses.length}</Badge>
                  </div>
                  <div className="p-2" style={{ border: '1px solid #ced4da', borderRadius: '8px', background: '#f8f9fa' }}>
                    {inactiveCourses.map((course) => (
                      <div key={course.id} className="d-flex justify-content-between align-items-center py-1 px-2">
                        <span className="small text-muted">{course.course_code} - {course.course_name}</span>
                        <Badge bg="secondary">⏳ Inactive</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Course Info */}
              {getSelectedCourseDetails() && selectedCourse && (lecturingCourses.length > 0 || canMarkFromAbsentCourses.length > 0) && (
                <div className="p-2 bg-light rounded mt-2" style={{ border: '2px solid #28a745', borderRadius: '10px' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong style={{ color: '#28a745' }}>{getSelectedCourseDetails().course_code}</strong>
                      <br />
                      <small className="text-muted">{getSelectedCourseDetails().course_name}</small>
                      <br />
                      <small className="text-muted">👨‍🏫 {getSelectedCourseDetails().lecturer || 'N/A'}</small>
                    </div>
                    <Badge bg="success">📖 Ready</Badge>
                  </div>
                </div>
              )}

              {/* No Courses Available */}
              {lecturingCourses.length === 0 && canMarkFromAbsentCourses.length === 0 && markedCourses.length === 0 && courses.length > 0 && (
                <div className="text-center py-3">
                  <div style={{ fontSize: '40px' }}>⏳</div>
                  <p className="text-muted mt-2">No courses are currently available.</p>
                  <small className="text-muted">Check back later when a course starts.</small>
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
