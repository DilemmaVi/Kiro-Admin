import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState('');
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const refreshCaptcha = () => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    setCaptchaUrl(`${baseURL}/api/auth/captcha?t=${Date.now()}`);
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', values);
      login(response.data.token, response.data.user);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 背景动画 */}
      <div className="login-background">
        <div className="gradient-bg"></div>
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`
            }}></div>
          ))}
        </div>
      </div>

      {/* 登录卡片 */}
      <Card className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-icon">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e3c72" />
                    <stop offset="100%" stopColor="#2a5298" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" fill="url(#logoGradient)" opacity="0.2" />
                <path d="M30 35 L50 25 L70 35 L70 65 L50 75 L30 65 Z"
                      fill="none"
                      stroke="url(#logoGradient)"
                      strokeWidth="3" />
                <circle cx="50" cy="50" r="8" fill="url(#logoGradient)" />
              </svg>
            </div>
          </div>
          <h1 className="login-title">Kiro Admin</h1>
          <p className="login-subtitle">AI 代理管理平台</p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined className="input-icon" />}
              placeholder="用户名"
              className="login-input"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="input-icon" />}
              placeholder="密码"
              className="login-input"
            />
          </Form.Item>

          <Form.Item
            name="captcha"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <Input
                prefix={<SafetyOutlined className="input-icon" />}
                placeholder="验证码"
                className="login-input"
                style={{ flex: 1 }}
              />
              <div
                className="captcha-image"
                onClick={refreshCaptcha}
                title="点击刷新验证码"
              >
                <img src={captchaUrl} alt="验证码" />
              </div>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="login-button"
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <p>默认账号：admin / admin123</p>
        </div>
      </Card>

      {/* 装饰元素 */}
      <div className="decoration decoration-1"></div>
      <div className="decoration decoration-2"></div>
      <div className="decoration decoration-3"></div>
    </div>
  );
};

export default Login;
