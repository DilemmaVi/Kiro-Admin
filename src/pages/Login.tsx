import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Divider, Space, Modal, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, CloudOutlined, CopyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import './Login.css';

const { Text, Paragraph } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [deviceAuthModal, setDeviceAuthModal] = useState(false);
  const [deviceAuthInfo, setDeviceAuthInfo] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const handleDeviceAuth = async () => {
    setOauthLoading(true);
    try {
      const response = await api.post('/api/auth/device-auth/initiate');
      const authInfo = response.data;
      
      setDeviceAuthInfo(authInfo);
      setDeviceAuthModal(true);
      setOauthLoading(false);
      
      // 开始轮询
      startPolling(authInfo.sessionId);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'AWS 设备授权初始化失败');
      setOauthLoading(false);
    }
  };

  const startPolling = async (sessionId: string) => {
    setPolling(true);
    
    const poll = async () => {
      try {
        const response = await api.post('/api/auth/device-auth/poll', { sessionId });
        const { status, token, user, message: msg, tokenInfo } = response.data;
        
        if (status === 'success') {
          // 授权成功
          setPolling(false);
          setDeviceAuthModal(false);
          login(token, user);
          
          // 显示成功消息，包含 token 信息
          if (tokenInfo?.created) {
            message.success({
              content: `AWS OAuth 登录成功！Refresh Token 已自动添加到 Token 管理`,
              duration: 5
            });
          } else {
            message.success('AWS OAuth 登录成功！');
          }
          
          navigate('/');
        } else if (status === 'pending') {
          // 继续等待
          setTimeout(poll, (deviceAuthInfo?.interval || 5) * 1000);
        } else if (status === 'expired') {
          // 已过期
          setPolling(false);
          message.warning(msg || '授权已过期，请重新开始');
          setDeviceAuthModal(false);
        } else {
          // 错误
          setPolling(false);
          message.error(msg || '授权失败');
          setDeviceAuthModal(false);
        }
      } catch (error: any) {
        setPolling(false);
        message.error('轮询失败，请重试');
        setDeviceAuthModal(false);
      }
    };
    
    // 开始第一次轮询
    setTimeout(poll, 2000);
  };

  const copyUserCode = () => {
    if (deviceAuthInfo?.userCode) {
      navigator.clipboard.writeText(deviceAuthInfo.userCode);
      message.success('验证码已复制');
    }
  };

  const openVerificationUrl = () => {
    if (deviceAuthInfo?.verificationUriComplete) {
      window.open(deviceAuthInfo.verificationUriComplete, '_blank');
    } else if (deviceAuthInfo?.verificationUri) {
      window.open(deviceAuthInfo.verificationUri, '_blank');
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

        <Divider plain>或</Divider>

        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            icon={<CloudOutlined />}
            onClick={handleDeviceAuth}
            loading={oauthLoading}
            className="oauth-button"
            block
            size="large"
          >
            使用 AWS Builder ID 登录
          </Button>
        </Space>

        <div className="login-footer">
          <p>默认账号：admin / admin123</p>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            AWS 登录将自动获取 refresh token
          </p>
        </div>
      </Card>

      {/* 设备授权弹窗 */}
      <Modal
        title="AWS Builder ID 设备授权"
        open={deviceAuthModal}
        onCancel={() => {
          setDeviceAuthModal(false);
          setPolling(false);
        }}
        footer={null}
        width={500}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {polling ? (
            <>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 20, fontSize: 16 }}>
                等待授权中...
              </Paragraph>
              <Text type="secondary">
                请在浏览器中完成授权后，此窗口将自动关闭
              </Text>
            </>
          ) : (
            <>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 20 }} />
              <Paragraph style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
                请完成以下步骤：
              </Paragraph>
              
              <div style={{ textAlign: 'left', background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ marginBottom: 15 }}>
                  <Text strong>1. 复制验证码：</Text>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                    <Input
                      value={deviceAuthInfo?.userCode}
                      readOnly
                      size="large"
                      style={{ flex: 1, marginRight: 8, fontSize: 20, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 }}
                    />
                    <Button
                      icon={<CopyOutlined />}
                      onClick={copyUserCode}
                      size="large"
                    >
                      复制
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Text strong>2. 打开授权页面并输入验证码：</Text>
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={openVerificationUrl}
                    style={{ marginTop: 8 }}
                  >
                    打开 AWS 授权页面
                  </Button>
                </div>
              </div>
              
              <Text type="secondary" style={{ fontSize: 12 }}>
                验证码将在 {Math.floor((deviceAuthInfo?.expiresIn || 0) / 60)} 分钟后过期
              </Text>
            </>
          )}
        </div>
      </Modal>

      {/* 装饰元素 */}
      <div className="decoration decoration-1"></div>
      <div className="decoration decoration-2"></div>
      <div className="decoration decoration-3"></div>
    </div>
  );
};

export default Login;
