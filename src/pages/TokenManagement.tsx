import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Switch, message, Tag, Popconfirm, Statistic, Row, Col, Card, Progress, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiOutlined, SyncOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { Token } from '../types';

const { TextArea } = Input;
const { Option } = Select;

const TokenManagement: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingTokens, setCheckingTokens] = useState<Set<number>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [selectedTokenStats, setSelectedTokenStats] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const response = await api.get<Token[]>('/api/tokens');
      setTokens(response.data);
    } catch (error) {
      message.error('获取Token列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckValidity = async (tokenId: number) => {
    setCheckingTokens(prev => new Set(prev).add(tokenId));
    try {
      const response = await api.get(`/api/tokens/${tokenId}/check`);

      // 更新token列表中的有效性信息
      setTokens(prevTokens =>
        prevTokens.map(token =>
          token.id === tokenId
            ? { ...token, validity: response.data }
            : token
        )
      );

      if (response.data.valid) {
        message.success('Token有效');
      } else {
        message.error(`Token无效: ${response.data.message}`);
      }
    } catch (error: any) {
      message.error('检测失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setCheckingTokens(prev => {
        const newSet = new Set(prev);
        newSet.delete(tokenId);
        return newSet;
      });
    }
  };

  const handleCheckAllValidity = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tokens/check-all');

      // 更新所有token的有效性信息
      setTokens(prevTokens =>
        prevTokens.map(token => {
          const result = response.data.find((r: any) => r.id === token.id);
          return result ? { ...token, validity: result.validity } : token;
        })
      );

      const validCount = response.data.filter((r: any) => r.validity.valid).length;
      const invalidCount = response.data.filter((r: any) => !r.validity.valid).length;

      message.success(`检测完成: ${validCount} 个有效, ${invalidCount} 个无效`);
    } catch (error) {
      message.error('批量检测失败');
    } finally {
      setLoading(false);
    }
  };

  const getValidityStatus = (token: Token) => {
    if (token.disabled === 1) {
      return <Tag color="default">已禁用</Tag>;
    }

    if (!token.validity || token.validity.valid === null) {
      if (token.validity?.reason === 'not_checked') {
        return (
          <Tooltip title="点击检测按钮验证Token有效性和查看用量">
            <Tag icon={<QuestionCircleOutlined />} color="default">未检测</Tag>
          </Tooltip>
        );
      }
      return (
        <Tooltip title="点击检测按钮验证Token有效性">
          <Tag icon={<QuestionCircleOutlined />} color="default">未知</Tag>
        </Tooltip>
      );
    }

    if (checkingTokens.has(token.id)) {
      return <Tag icon={<LoadingOutlined />} color="processing">检测中...</Tag>;
    }

    if (token.validity.valid) {
      const details = token.validity.usageDetails;
      const tooltipContent = details ? (
        <div>
          <div>✓ {token.validity.message}</div>
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 8 }}>
            <div>总额度: {details.totalLimit.toFixed(2)}</div>
            <div>已使用: {details.totalUsed.toFixed(2)}</div>
            <div>剩余: {details.available.toFixed(2)}</div>
            {details.freeTrialStatus === 'ACTIVE' && (
              <div style={{ marginTop: 4, color: '#52c41a' }}>
                含免费试用: {details.freeTrialLimit.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      ) : token.validity.message;

      return (
        <Tooltip title={tooltipContent}>
          <Tag icon={<CheckCircleOutlined />} color="success">
            有效 {details && `(${details.available.toFixed(0)})`}
          </Tag>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title={token.validity.message}>
          <Tag icon={<CloseCircleOutlined />} color="error">无效</Tag>
        </Tooltip>
      );
    }
  };

  const handleViewStats = async (token: Token) => {
    try {
      const response = await api.get(`/api/tokens/${token.id}/stats`);
      setSelectedTokenStats(response.data);
      setStatsModalVisible(true);
    } catch (error) {
      message.error('获取统计信息失败');
    }
  };

  const handleAdd = () => {
    setEditingToken(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Token) => {
    setEditingToken(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/tokens/${id}`);
      message.success('删除成功');
      fetchTokens();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await api.patch(`/api/tokens/${id}/toggle`);
      message.success('状态更新成功');
      fetchTokens();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingToken) {
        await api.put(`/api/tokens/${editingToken.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/api/tokens', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTokens();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/api/tokens/export');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kiro_tokens_config.json';
      a.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 50,
      fixed: 'left' as const,
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 90,
      render: (type: string) => (
        <Tag color={type === 'Social' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      ellipsis: true,
    },
    {
      title: '有效性',
      key: 'validity',
      width: 140,
      render: (_: any, record: Token) => getValidityStatus(record),
    },
    {
      title: '使用统计',
      key: 'usage_stats',
      width: 120,
      render: (_: any, record: Token) => (
        <div style={{ fontSize: '12px' }}>
          <div>请求: {formatNumber(record.total_requests)}</div>
          <div>Tokens: {formatNumber(record.total_tokens_used)}</div>
        </div>
      ),
    },
    {
      title: '最后使用',
      dataIndex: 'last_request_time',
      key: 'last_request_time',
      width: 140,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : '-',
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      key: 'disabled',
      width: 70,
      render: (disabled: number, record: Token) => (
        <Tooltip title={disabled === 0 ? '点击禁用' : '点击启用'}>
          <Switch
            checked={disabled === 0}
            onChange={() => handleToggle(record.id)}
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: Token) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleCheckValidity(record.id)}
            loading={checkingTokens.has(record.id)}
            disabled={record.disabled === 1}
          >
            检测
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewStats(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
        <h2>Token管理</h2>
        <Space>
          <Button
            icon={<SyncOutlined />}
            onClick={handleCheckAllValidity}
            loading={loading}
          >
            批量检测
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加Token
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            导出配置
          </Button>
        </Space>
      </div>

      {/* 总览统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总Token数"
              value={tokens.length}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃Token"
              value={tokens.filter(t => t.disabled === 0).length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={tokens.reduce((sum, t) => sum + (t.total_requests || 0), 0)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总Token消耗"
              value={tokens.reduce((sum, t) => sum + (t.total_tokens_used || 0), 0)}
            />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={tokens}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 添加/编辑 Modal */}
      <Modal
        title={editingToken ? '编辑Token' : '添加Token'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="auth_type"
            label="认证类型"
            rules={[{ required: true, message: '请选择认证类型' }]}
          >
            <Select>
              <Option value="Social">Social</Option>
              <Option value="IdC">IdC</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="refresh_token"
            label="Refresh Token"
            rules={[{ required: true, message: '请输入Refresh Token' }]}
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.auth_type !== currentValues.auth_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('auth_type') === 'IdC' ? (
                <>
                  <Form.Item
                    name="client_id"
                    label="Client ID"
                    rules={[{ required: true, message: '请输入Client ID' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="client_secret"
                    label="Client Secret"
                    rules={[{ required: true, message: '请输入Client Secret' }]}
                  >
                    <TextArea rows={2} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>

          {editingToken && (
            <Form.Item name="disabled" label="禁用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 统计详情 Modal */}
      <Modal
        title="Token使用详情"
        open={statsModalVisible}
        onCancel={() => setStatsModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTokenStats && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="总请求数"
                    value={selectedTokenStats.dailyUsage?.reduce((sum: number, day: any) => sum + day.request_count, 0) || 0}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="总Token消耗"
                    value={selectedTokenStats.dailyUsage?.reduce((sum: number, day: any) => sum + day.total_tokens, 0) || 0}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="使用天数"
                    value={selectedTokenStats.dailyUsage?.length || 0}
                    suffix="天"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="模型使用分布" style={{ marginBottom: 16 }}>
              {selectedTokenStats.modelUsage?.map((model: any) => (
                <div key={model.model} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{model.model}</span>
                    <span>{formatNumber(model.request_count)} 次</span>
                  </div>
                  <Progress
                    percent={Math.round((model.request_count / selectedTokenStats.dailyUsage?.reduce((sum: number, day: any) => sum + day.request_count, 0)) * 100)}
                    size="small"
                  />
                </div>
              ))}
            </Card>

            <Card title="最近使用记录">
              <Table
                dataSource={selectedTokenStats.recentLogs}
                columns={[
                  {
                    title: '时间',
                    dataIndex: 'request_time',
                    key: 'request_time',
                    render: (text: string) => new Date(text).toLocaleString('zh-CN'),
                  },
                  {
                    title: '模型',
                    dataIndex: 'model',
                    key: 'model',
                  },
                  {
                    title: 'Tokens',
                    dataIndex: 'total_tokens',
                    key: 'total_tokens',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status: string) => (
                      <Tag color={status === 'success' ? 'green' : 'red'}>
                        {status}
                      </Tag>
                    ),
                  },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TokenManagement;
