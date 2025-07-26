import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, Typography, Tag, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import './Models.css';


const { Title } = Typography;
const { Option } = Select;

const API_URL = 'http://localhost:8000/api';

function Models() {
  const { keycloak, initialized } = useKeycloak();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchModels = useCallback(async () => {
    if (initialized && keycloak.authenticated) {
      try {
        setLoading(true);
        const resp = await axios.get(`${API_URL}/models`, {
          headers: { Authorization: `Bearer ${keycloak.token}` },
        });
        setModels(resp.data);
      } catch (err) {
        message.error('Failed to fetch models.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  }, [initialized, keycloak]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const showModal = () => setIsModalVisible(true);
  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleAddModel = async values => {
    try {
      await axios.post(`${API_URL}/models`, values, { headers: { Authorization: `Bearer ${keycloak.token}` } });
      message.success('Model added successfully');
      fetchModels();
      handleCancel();
    } catch (err) {
      message.error('Failed to add model');
      console.error(err);
    }
  };

  const handleDelete = async id => {
    try {
      await axios.delete(`${API_URL}/models/${id}`, { headers: { Authorization: `Bearer ${keycloak.token}` } });
      message.success('Model deleted');
      fetchModels();
    } catch (err) {
      message.error('Failed to delete model');
      console.error(err);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <CodeSandboxOutlined style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: 'Framework',
      dataIndex: 'framework',
      key: 'framework',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag color={status === 'active' ? 'green' : 'orange'}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const navigate = useNavigate();

  return (
    <div className="models-page-container">
      <div className="models-page-header">
        <Title level={2} style={{ margin: 0 }}>Models</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/models/add')}>Add Model</Button>
      </div>
      <Card className="modern-card">
        <Table
          dataSource={models}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>

      <Modal title="Add New Model" open={isModalVisible} onCancel={handleCancel} footer={null} width={420}>
        <Form form={form} layout="vertical" onFinish={handleAddModel} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Model Name" rules={[{ required: true }]}> <Input placeholder="e.g. sentiment-classifier" /> </Form.Item>
          <Form.Item name="version" label="Version" rules={[{ required: true }]}> <Input placeholder="e.g. 1.0.0" /> </Form.Item>
          <Form.Item name="framework" label="Framework" rules={[{ required: true }]}> <Select placeholder="Select framework"> <Option value="tensorflow">TensorFlow</Option><Option value="pytorch">PyTorch</Option><Option value="sklearn">scikit-learn</Option></Select> </Form.Item>
          <Form.Item name="status" label="Status" initialValue="active"> <Select> <Option value="active">Active</Option><Option value="staging">Staging</Option></Select> </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Models;
