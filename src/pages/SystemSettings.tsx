import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Space, Divider, Modal } from 'antd';
import { SaveOutlined, DownloadOutlined, LockOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { SystemConfig } from '../types';

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await api.get<SystemConfig[]>('/api/config');
      setConfigs(response.data);
      const formValues: any = {};
      response.data.forEach((config) => {
        formValues[config.config_key] = config.config_value;
      });
      form.setFieldsValue(formValues);
    } catch (error) {
      message.error('获取配置失败');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const configArray = Object.keys(values).map((key) => ({
        config_key: key,
        config_value: values[key],
        description: configs.find((c) => c.config_key === key)?.description || '',
      }));
      await api.post('/api/config/batch', configArray);
      message.success('保存成功');
      fetchConfigs();
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/api/config/export', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      a.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleChangePassword = async () => {
    setPasswordLoading(true);
    try {
      const values = await passwordForm.validateFields();
      await api.post('/api/auth/change-password', values);
      message.success('密码修改成功，请重新登录');
      passwordForm.resetFields();
      setPasswordModalVisible(false);
      // 3秒后跳转到登录页
      setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }, 3000);
    } catch (error: any) {
      message.error(error.response?.data?.error || '密码修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>系统设置</h2>
        <Space>
          <Button
            icon={<LockOutlined />}
            onClick={() => setPasswordModalVisible(true)}
          >
            修改密码
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出.env文件
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading}
          >
            保存配置
          </Button>
        </Space>
      </div>

      <Card>
        <Form form={form} layout="vertical">
          <Divider>基础配置</Divider>

          <Form.Item
            name="PORT"
            label="服务端口"
            rules={[{ required: true, message: '请输入服务端口' }]}
          >
            <Input placeholder="8080" />
          </Form.Item>

          <Form.Item
            name="GIN_MODE"
            label="运行模式"
            rules={[{ required: true, message: '请选择运行模式' }]}
          >
            <Input placeholder="release / debug / test" />
          </Form.Item>

          <Divider>日志配置</Divider>

          <Form.Item
            name="LOG_LEVEL"
            label="日志级别"
            rules={[{ required: true, message: '请选择日志级别' }]}
          >
            <Input placeholder="debug / info / warn / error" />
          </Form.Item>

          <Form.Item
            name="LOG_FORMAT"
            label="日志格式"
            rules={[{ required: true, message: '请选择日志格式' }]}
          >
            <Input placeholder="text / json" />
          </Form.Item>

          <Divider>工具配置</Divider>

          <Form.Item
            name="MAX_TOOL_DESCRIPTION_LENGTH"
            label="工具描述最大长度"
          >
            <Input placeholder="10000" type="number" />
          </Form.Item>
        </Form>
      </Card>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        confirmLoading={passwordLoading}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少为6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemSettings;
