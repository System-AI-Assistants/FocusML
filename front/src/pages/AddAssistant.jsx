import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import {
    Breadcrumb,
    Form,
    Input,
    Select,
    Upload,
    Radio,
    Divider,
    Button,
    Typography,
    Tooltip,
    Card,
    Row,
    Col,
    Tag,
    message,
    Modal,
    Progress,
    Spin
} from 'antd';
import { InboxOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getModelFams, createAssistant, getAssistantStatus } from '../services/api';
import './AddAssistant.css';

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
  const navigate = useNavigate();
  const [modelFamilies, setModelFamilies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecutionType, setSelectedExecutionType] = useState(null);
  const [fileList, setFileList] = useState([]);

    // New state for initialization tracking

    const [initializationModal, setInitializationModal] = useState(false);

    const [initializingAssistant, setInitializingAssistant] = useState(null);

    const [initializationStatus, setInitializationStatus] = useState('initializing');

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

    // Poll for initialization status

    const pollInitializationStatus = useCallback(async (assistantId) => {

        if (!keycloak.authenticated || !assistantId) return;



        try {

            const status = await getAssistantStatus(keycloak, assistantId);

            setInitializationStatus(status.status);



            if (status.is_ready) {

                setInitializationStatus('running');

                message.success('Assistant initialized successfully!');

                setTimeout(() => {

                    setInitializationModal(false);

                    navigate('/assistants');

                }, 2000);

                return;

            }



            if (status.status === 'failed') {

                setInitializationStatus('failed');

                message.error('Assistant initialization failed');

                return;

            }



            // Continue polling if still initializing

            if (status.status === 'initializing') {

                setTimeout(() => pollInitializationStatus(assistantId), 2000);

            }

        } catch (error) {

            console.error('Error polling status:', error);

            setInitializationStatus('failed');

            message.error('Failed to check initialization status');

        }

    }, [keycloak, navigate]);

  // Flatten models from all families for filtering
  const allModels = modelFamilies.flatMap(family => family.models.map(model => ({
    ...model,
    familyName: family.name, // Store family name for reference
    familyDescription: family.description,
    familyIcon: family.icon,
    familyUrl: family.url,
    fullName: model.name, // Use model.name directly (e.g., mistral:7b)
  })));

  console.log('All models:', allModels); // Debug: Log all models

  const filteredModels = allModels.filter(model =>
    model.fullName.toLowerCase().includes(searchTerm.toLowerCase())
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
      const selectedModelObj = allModels.find(model => model.fullName === values.model);
      console.log('Selected model:', selectedModelObj); // Debug: Log selected model
      if (!selectedModelObj) {
        throw new Error('Selected model not found');
      }

      const payload = {
        name: values.name,
        database_url: values.dbUrl || null,
        version: values.versionTag || null,
        stage: values.stage || null,
        model: selectedModelObj.fullName, // Use full model name (e.g., mistral:7b)
        is_local: values.executionType === 'on-premise',
      };

      console.log('Payload:', payload); // Debug: Log payload

      const response = await createAssistant(keycloak, payload);

        // Show initialization modal and start polling

        setInitializingAssistant(response);

        setInitializationStatus('initializing');

        setInitializationModal(true);



        // Reset form but don't navigate yet

      form.resetFields();
      setSelectedModel(null);
      setSelectedExecutionType(null);
      setFileList([]);
      pollInitializationStatus(response.id);
    } catch (err) {
      message.error(`Failed to create assistant: ${err.message || 'Unknown error'}`);
      console.error('Create assistant error:', err);
    } finally {
      setIsLoading(false);
    }
  };

    const handleModalCancel = () => {

        setInitializationModal(false);

        navigate('/assistants');

    };



    const renderInitializationContent = () => {

        switch (initializationStatus) {

            case 'initializing':

                return (

                    <div style={{ textAlign: 'center', padding: '20px' }}>

                        <Spin size="large" />

                        <div style={{ marginTop: '16px' }}>

                            <Title level={4}>Initializing Assistant</Title>

                            <p>Setting up your assistant "{initializingAssistant?.name}"...</p>

                            <p>This may take a few minutes as we prepare the ML model.</p>

                            <Progress percent={50} status="active" />

                        </div>

                    </div>

                );

            case 'running':

                return (

                    <div style={{ textAlign: 'center', padding: '20px' }}>

                        <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />

                        <div style={{ marginTop: '16px' }}>

                            <Title level={4}>Assistant Ready!</Title>

                            <p>"{initializingAssistant?.name}" has been successfully initialized.</p>

                            <p>Redirecting to assistants page...</p>

                        </div>

                    </div>

                );

            case 'failed':

                return (

                    <div style={{ textAlign: 'center', padding: '20px' }}>

                        <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />

                        <div style={{ marginTop: '16px' }}>

                            <Title level={4}>Initialization Failed</Title>

                            <p>Failed to initialize assistant "{initializingAssistant?.name}".</p>

                            <p>Please try again or contact support if the issue persists.</p>

                        </div>

                    </div>

                );

            default:

                return null;

        }

    };

  return (
    <>
      <Breadcrumb
        items={[
          { title: <a href="/assistants">Assistants</a> },
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
                      borderColor: selectedExecutionType === key ? '#1890ff' : '#d9d9d9',
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
                        <p style={{ color: 'rgba(0,0,0,0.65)' }}>{description}</p>
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
                <Col span={24} key={model.fullName}>
                  <Card
                    hoverable
                    style={{
                      cursor: 'pointer',
                      borderColor: selectedModel === model.fullName ? '#1890ff' : '#d9d9d9',
                      borderWidth: selectedModel === model.fullName ? 2 : 1,
                      padding: 8,
                    }}
                    onClick={() => {
                      setSelectedModel(model.fullName);
                      form.setFieldsValue({ model: model.fullName });
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
                      {model.fullName} {/* Display only the full model name (e.g., mistral:7b) */}
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


        {/* Initialization Progress Modal */}

        <Modal

            title="Assistant Initialization"

            open={initializationModal}

            onCancel={handleModalCancel}

            footer={

                initializationStatus === 'failed' || initializationStatus === 'running'

                    ? [

                        <Button key="ok" type="primary" onClick={handleModalCancel}>

                            {initializationStatus === 'running' ? 'Go to Assistants' : 'Close'}

                        </Button>

                    ]

                    : null

            }

            closable={initializationStatus !== 'initializing'}

            maskClosable={false}

            width={500}

        >

            {renderInitializationContent()}

        </Modal>
    </>
  );
};

export default AddModel;