import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { Container, Row, Col, Form, Button, Card, Alert } from 'react-bootstrap';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      // 2. Fetch user role from our 'users' table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, full_name, matric_no, phone')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      // 3. Store user data in localStorage
      const user = {
        id: authData.user.id,
        email: authData.user.email,
        ...userData
      };
      localStorage.setItem('user', JSON.stringify(user));

      // 4. Redirect based on role
      if (userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/student');
      }

    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={6} lg={5}>
          <Card className="p-4 shadow-lg animate-fade-in">
            <div className="text-center mb-4">
              <h2 className="fw-bold">Welcome Back</h2>
              <p className="text-muted">Sign in to mark your attendance</p>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>

              <Button
                variant="primary"
                type="submit"
                className="w-100"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Form>

            <div className="text-center mt-3">
              <p className="text-muted">
                Don't have an account? <Link to="/register" className="text-primary fw-bold">Register here</Link>
              </p>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
