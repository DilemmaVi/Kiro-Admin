import React, { useEffect, useState } from 'react';
import { Table, Button, message, Tag, Card } from 'antd';
import { ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../services/api';

interface KiroModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  internal_model_id?: string;
  description?: string;
  max_tokens?: number;
}

interface ModelsResponse {
  object: string;
  data: KiroModel[];
}

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<KiroModel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await api.get<ModelsResponse>('/api/models');
      if (response.data && response.data.data) {
        setModels(response.data.data);
      } else {
        setModels([]);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || '获取模型列表失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '模型ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <div>
          <code style={{
            background: '#f5f5f5',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '13px'
          }}>
            {text}
          </code>
        </div>
      ),
    },
    {
      title: '内部模型ID',
      dataIndex: 'internal_model_id',
      key: 'internal_model_id',
      render: (text: string) => (
        <code style={{ fontSize: '12px', color: '#666' }}>{text}</code>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '最大Tokens',
      dataIndex: 'max_tokens',
      key: 'max_tokens',
      width: 120,
      render: (num: number) => num?.toLocaleString() || '-',
    },
    {
      title: '所有者',
      dataIndex: 'owned_by',
      key: 'owned_by',
      width: 120,
      render: (text: string) => (
        <Tag color="blue">{text || 'anthropic'}</Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: () => (
        <Tag icon={<CheckCircleOutlined />} color="success">
          可用
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>模型管理</h2>
          <div style={{ fontSize: '14px', color: '#999', marginTop: '4px' }}>
            支持的 Claude 模型列表
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchModels}
          loading={loading}
        >
          刷新列表
        </Button>
      </div>

      <Card>
        <Table
          dataSource={models}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 个模型`,
          }}
          locale={{
            emptyText: loading ? '加载中...' : '暂无模型数据'
          }}
        />
      </Card>

      <Card style={{ marginTop: 16 }} title="模型说明">
        <div style={{ lineHeight: '1.8' }}>
          <p><strong>支持的模型：</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Claude Sonnet 4.5</strong> - 最新版本，性能最强，适合复杂任务</li>
            <li><strong>Claude Sonnet 4</strong> - 高性能版本，平衡速度和质量</li>
            <li><strong>Claude 3.7 Sonnet</strong> - 稳定版本</li>
            <li><strong>Claude 3.5 Haiku</strong> - 快速响应，适合简单任务</li>
            <li><strong>Claude Haiku 4.5</strong> - 超快速响应版本</li>
          </ul>
          <p style={{ marginTop: '16px' }}><strong>使用说明：</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>模型ID可以直接用于 API 调用</li>
            <li>内部模型ID是 AWS CodeWhisperer 使用的实际模型标识</li>
            <li>所有模型最大支持 200,000 tokens</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ModelManagement;
