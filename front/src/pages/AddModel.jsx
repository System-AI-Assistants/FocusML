import React, { useState, useEffect, useCallback } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Breadcrumb, Form, Input, Select, Upload, Radio, Divider, Button, Typography, Tooltip, Card, Row, Col, Tag, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { getModelFams, createAssistant } from '../services/api';
import './AddModel.css';

const { Title } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

const executionTypeOptions = [
  {
    key: 'on-premise',
    title: 'Host Locally',
    description: 'Full control, data privacy, and offline availability.',
  },
  {
    key: 'cloud',
    title: 'Cloud',
    description: 'Easy to scale, no hardware needed, maintained by provider.',
  },
];

const AddModel = () => {
  const { keycloak, initialized } = useKeycloak();
  const [modelFamilies, setModelFamilies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecutionType, setSelectedExecutionType] = useState(null);
  const [fileList, setFileList] = useState([]);

  const fetchModels = useCallback(async () => {
    if (initialized && keycloak.authenticated) {
      setIsLoading(true);
      try {
        const fams = await getModelFams(keycloak);
        setModelFamilies(fams);
      } catch (err) {
        message.error('Failed to fetch models. Is your backend running?');
        console.error('Fetch models error:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      console.warn('Keycloak not initialized or not authenticated');
    }
  }, [initialized, keycloak]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Flatten models from all families for filtering
  const allModels = modelFamilies.flatMap(family => family.models.map(model => ({
    ...model,
    familyTitle: family.title,
    familyDescription: family.description,
    familyIcon: family.icon,
    familyUrl: family.url,
  })));

  const filteredModels = allModels.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) 
  
  );

  const onSelectExecutionType = (key) => {
    setSelectedExecutionType(key);
    form.setFieldsValue({ executionType: key });
  };

  const handleUploadChange = ({ fileList }) => {
    setFileList(fileList);
  };

  const onFinish = async (values) => {
    if (!keycloak.authenticated) {
      message.error('You must be logged in to create an assistant.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: values.name,
        database_url: values.dbUrl || null,
        version: values.versionTag || null,
        stage: values.stage || null,
        model: values.model,
        is_local: values.executionType === 'on-premise',
      };

      const response = await createAssistant(keycloak, payload);
      message.success(`Assistant '${response.name}' created successfully!`);
      form.resetFields();
      setSelectedModel(null);
      setSelectedExecutionType(null);
      setFileList([]);
    } catch (err) {
      message.error(`Failed to create assistant: ${err.message || 'Unknown error'}`);
      console.error('Create assistant error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { title: <a href="/models">Models</a> },
          { title: 'Add Assistant' },
        ]}
      />
      <div className="add-model-div">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}
        >
          <Title level={3}>1. Assistant Configuration</Title>

          <Form.Item
            label={
              <span>
                Host Locally or On-Cloud &nbsp;
                <Tooltip title="Choose where your assistant runs: locally on your own infrastructure or on cloud providers.">
                  {/* <InfoCircleOutlined /> */}
                </Tooltip>
              </span>
            }
            name="executionType"
            rules={[{ required: true, message: 'Please select where to host the assistant' }]}
          >
            <Row gutter={16}>
              {executionTypeOptions.map(({ key, title, description }) => (
                <Col span={12} key={key}>
                  <Card
                    hoverable
                    onClick={() => onSelectExecutionType(key)}
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedExecutionType === key ? '#1890ff' : undefined,
                      borderWidth: selectedExecutionType === key ? 2 : 1,
                      padding: 8,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                      <Radio
                        checked={selectedExecutionType === key}
                        onChange={() => onSelectExecutionType(key)}
                        style={{ marginRight: 16 }}
                      />
                      <div>
                        <Title level={5} style={{ marginBottom: 4, marginTop: 0 }}>
                          {title}
                        </Title>
                        <p style={{ margin: 0, color: 'rgba(0,0,0,0.65)' }}>{description}</p>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Form.Item>

          <Form.Item label="Search Model">
            <Input
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Form.Item>

          {isLoading && <div>Loading models...</div>}
          <div
            style={{
              height: 400,
              overflowY: 'auto',
              padding: 8,
            }}
          >
            <Row gutter={[16, 16]}>
              {filteredModels.map((model) => (
                <Col span={24} key={model.name}>
                  <Card
                    hoverable
                    bordered={selectedModel !== model.name}
                    onClick={() => {
                      setSelectedModel(model.name);
                      form.setFieldsValue({ model: model.name });
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedModel === model.name ? '#1890ff' : undefined,
                    }}
                  >
                    <h2 className="model-name" style={{ marginTop: 0 }}>
                      {model.familyIcon && (
                        <img
                          src={model.familyIcon}
                          alt="icon"
                          height="32"
                          style={{ verticalAlign: 'middle', marginRight: 8 }}
                        />
                      )}
                      {model.name} ({model.familyTitle})
                    </h2>
                    <Divider />
                    <p>{model.familyDescription}</p>
                    <Tag color="blue">{model.size}</Tag>
                    <Tag color="blue">{model.context}</Tag>
                    <Tag color="blue">{model.input}</Tag>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          <Form.Item name="model" hidden rules={[{ required: true, message: 'Please select a model' }]}>
            <Input type="hidden" />
          </Form.Item>

          <Divider />
          <Title level={3}>2. General</Title>
          <Form.Item
            label="Assistant Name"
            name="name"
            rules={[{ required: true, message: 'Please enter an assistant name' }]}
          >
            <Input placeholder="e.g., LegalSummarizer-v1" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={4} placeholder="Short description of the assistant" />
          </Form.Item>

          <Form.Item label="Tags" name="tags">
            <Select mode="tags" placeholder="Enter tags (e.g., NLP, CV, internal)" />
          </Form.Item>

          <Divider />
          <Title level={3}>3. Access Control</Title>

          <Form.Item label="Groups (RBAC)" name="groups">
            <Select mode="multiple" placeholder="Select allowed groups">
              <Option value="ml-engineers">ML Engineers</Option>
              <Option value="data-scientists">Data Scientists</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Visibility" name="visibility">
            <Radio.Group>
              <Radio value="private">Private</Radio>
              <Radio value="org">Organization-wide</Radio>
              <Radio value="public">Public</Radio>
            </Radio.Group>
          </Form.Item>

          <Divider />
          <Title level={3}>4. Data Sources</Title>

          <Form.Item label="Database URL (SQLAlchemy format)" name="dbUrl">
            <Input placeholder="e.g., postgresql://user:pass@host:port/dbname" />
          </Form.Item>

          <Form.Item label="Attach File (optional)" name="dataFile">
            <Dragger
              fileList={fileList}
              multiple={false}
              beforeUpload={() => false}
              onChange={handleUploadChange}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">Supports JSON, CSV, PDF, etc.</p>
            </Dragger>
          </Form.Item>

          <Divider />
          <Title level={3}>5. Versioning</Title>

          <Form.Item label="Initial Version Tag" name="versionTag">
            <Input placeholder="e.g., v1.0.0" />
          </Form.Item>

          <Form.Item label="Stage" name="stage">
            <Select placeholder="Select stage">
              <Option value="staging">Staging</Option>
              <Option value="production">Production</Option>
              <Option value="archived">Archived</Option>
            </Select>
          </Form.Item>

          <Divider />
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              Create Assistant
            </Button>
          </Form.Item>
        </Form>
      </div>
    </>
  );
};

export default AddModel;