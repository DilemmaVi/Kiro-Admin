import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Switch, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { ApiKey } from '../types';

const ApiKeyManagement: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiKey[]>('/api/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      message.error('获取API密钥列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingKey(null);
    form.resetFields();
    form.setFieldsValue({ key_value: generateRandomKey() });
    setModalVisible(true);
  };

  const handleEdit = (record: ApiKey) => {
    setEditingKey(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/api-keys/${id}`);
      message.success('删除成功');
      fetchApiKeys();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.patch(`/api/api-keys/${id}/toggle`);
      message.success('状态更新成功');
      fetchApiKeys();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingKey) {
        await api.put(`/api/api-keys/${editingKey.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/api-keys', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchApiKeys();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const generateRandomKey = () => {
    return 'kiro_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '名称',
      dataIndex: 'key_name',
      key: 'key_name',
    },
    {
      title: 'API密钥',
      dataIndex: 'key_value',
      key: 'key_value',
      render: (text: string) => (
        <Space>
          <code>{text.substring(0, 20)}...</code>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(text)}
          />
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      key: 'disabled',
      render: (disabled: number, record: ApiKey) => (
        <Switch
          checked={disabled === 0}
          onChange={() => handleToggle(record.id)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ApiKey) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>API密钥管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加API密钥
        </Button>
      </div>

      <Table
        dataSource={apiKeys}
        columns={columns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingKey ? '编辑API密钥' : '添加API密钥'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key_name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="key_value"
            label="API密钥"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  onClick={() => form.setFieldsValue({ key_value: generateRandomKey() })}
                >
                  生成
                </Button>
              }
            />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>

          {editingKey && (
            <Form.Item name="disabled" label="禁用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ApiKeyManagement;
