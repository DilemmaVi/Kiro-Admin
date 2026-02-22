import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Table, DatePicker, Button, Modal, message } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import type { UsageStats } from '../types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const Statistics: React.FC = () => {
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [tokenStats, setTokenStats] = useState<any[]>([]);
  const [modelStats, setModelStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const [usageRes, tokenRes, modelRes] = await Promise.all([
        api.get<UsageStats[]>('/api/stats/usage', { params }),
        api.get('/api/stats/tokens'),
        api.get('/api/stats/models'),
      ]);

      setUsageStats(usageRes.data);
      setTokenStats(tokenRes.data);
      setModelStats(modelRes.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates: any) => {
    setDateRange(dates);
    if (dates) {
      const [start, end] = dates;
      fetchStats(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
    } else {
      fetchStats();
    }
  };

  const handleClearData = () => {
    Modal.confirm({
      title: '确认清理数据',
      icon: <ExclamationCircleOutlined />,
      content: dateRange
        ? `确定要清理 ${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')} 的请求数据吗？`
        : '确定要清理所有请求数据吗？此操作不可恢复！',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setClearLoading(true);
        try {
          const data: any = {};
          if (dateRange) {
            data.startDate = dateRange[0].format('YYYY-MM-DD');
            data.endDate = dateRange[1].format('YYYY-MM-DD');
          }

          const response = await api.delete('/api/stats/clear', { data });
          message.success(`清理成功，共删除 ${response.data.deletedCount} 条记录`);

          // 刷新统计数据
          fetchStats(
            dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
            dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined
          );
        } catch (error: any) {
          message.error(error.response?.data?.error || '清理失败');
        } finally {
          setClearLoading(false);
        }
      },
    });
  };

  const tokenColumns = [
    {
      title: 'Token描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      key: 'usage_count',
    },
    {
      title: '总Token数',
      dataIndex: 'total_tokens',
      key: 'total_tokens',
    },
    {
      title: '最后使用',
      dataIndex: 'last_used',
      key: 'last_used',
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
  ];

  const modelColumns = [
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: '请求次数',
      dataIndex: 'request_count',
      key: 'request_count',
    },
    {
      title: '总Token数',
      dataIndex: 'total_tokens',
      key: 'total_tokens',
    },
    {
      title: '平均响应时间',
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (time: number) => `${Math.round(time)}ms`,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>使用统计</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <RangePicker
            onChange={handleDateChange}
            value={dateRange}
          />
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={handleClearData}
            loading={clearLoading}
          >
            清理数据
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="请求趋势" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usageStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="request_count" stroke="#8884d8" name="请求数" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Token消耗趋势" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usageStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_tokens" fill="#82ca9d" name="总Token数" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Token使用统计" loading={loading}>
            <Table
              dataSource={tokenStats}
              columns={tokenColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="模型使用统计" loading={loading}>
            <Table
              dataSource={modelStats}
              columns={modelColumns}
              rowKey="model"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Statistics;
