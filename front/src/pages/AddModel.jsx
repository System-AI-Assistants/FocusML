import './AddModel.css';
import React, { useState } from 'react';
import { Breadcrumb, Descriptions } from 'antd';
import ModelCard from '../components/ModelCard';


import { Form, Input, Select, Upload, Radio, Divider, Button, Typography, Tooltip, Card, Row, Col, Tag } from "antd";
import { InboxOutlined, InfoCircleOutlined } from "@ant-design/icons";




const { Title } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

const modelOptions = [
  {
    key: "deepseek-r1",
    name: "deepseek-r1",
    provider: "Deepseek",
    icon: "/images/models/deepseek.png",
    description: "DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models, such as O3 and Gemini 2.5 Pro.",
    tags: ["tools", "thinking", "1.5b", "7b", "8b", "14b", "32b", "70b", "671b"]
  },
  {
    key: "gemma3n",
    name: "gemma3n",
    provider: "Google",
    icon: "/images/models/gemma.png",
    description: "Gemma 3n models are designed for efficient execution on everyday devices such as laptops, tablets or phones.",
    tags: ["tools", "thinking", "1.5b", "7b", "8b", "14b", "32b", "70b", "671b"]

  }

];

const modelOptionsCloud = [
  {
    key: "deepseek-r1",
    name: "deepseek-r1",
    provider: "Deepseek",
    icon: "/images/models/deepseek.png",
    description: "DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models, such as O3 and Gemini 2.5 Pro."
  },
  {
    key: "gpt-4o",
    name: "gpt-4o",
    provider: "OpenAI",
    description: "Cloud-based, powerful LLM for general-purpose NLP"
  },
  {
    key: "llama3",
    name: "LLaMA 3",
    provider: "Local",
    description: "On-premise LLM using llama.cpp"
  },
  {
    key: "custom-api-model",
    name: "Custom API",
    provider: "Remote",
    description: "Custom endpoint with flexible parameters"
  }
];

const executionTypeOptions = [
  {
    key: "on-premise",
    title: "Host Locally",
    description: "Full control, data privacy, and offline availability."
  },
  {
    key: "cloud",
    title: "Cloud",
    description: "Easy to scale, no hardware needed, maintained by provider."
  },

];

function CreateModel() {

  const exampleModel = {
    name: "Deepseek R1",
    icon: "https://custom.typingmind.com/assets/models/deepseek.png",
    description: "DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models, such as O3 and Gemini 2.5 Pro.",
    tags: [
      "tools",
      "thinking",
      "1.5b",
      "7b",
      "8b",
      "14b",
      "32b",
      "70b",
      "671b"
    ]
  }

  const [form] = Form.useForm();
  const [selectedModel, setSelectedModel] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExecutionType, setSelectedExecutionType] = useState(null);


  const filteredModels = modelOptions.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSelectExecutionType = (key) => {
    setSelectedExecutionType(key);
    form.setFieldsValue({ executionType: key });
  };

  return (
    <>
      <Breadcrumb
        items={[

          {
            title: <a href="/models">Models</a>,
          },
          {
            title: 'Add Model',
          },
        ]}
      />

      {/* <ModelCard model={exampleModel} /> */}
      <div className='add-model-div'>

        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => console.log(values)}
          style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}
        >
          <Title level={3}>1. Model Configuration</Title>

          <Form.Item
            label={
              <span>
                Host Locally or On-Cloud &nbsp;
                <Tooltip title="Choose where your assistant runs: locally on your own infrastructure or on cloud providers.">
                  <InfoCircleOutlined />
                </Tooltip>
              </span>
            }
            name="executionType"
            rules={[{ required: true, message: "Please select where to host the assistant" }]}
          >
            <Row gutter={16}>
              {executionTypeOptions.map(({ key, title, description }) => (
                <Col span={12} key={key}>
                  <Card
                    hoverable
                    onClick={() => onSelectExecutionType(key)}
                    style={{
                      cursor: "pointer",
                      borderColor: selectedExecutionType === key ? "#1890ff" : undefined,
                      borderWidth: selectedExecutionType === key ? 2 : 1,
                      padding: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Radio
                        checked={selectedExecutionType === key}
                        onChange={() => onSelectExecutionType(key)}
                        style={{ marginRight: 16 }}
                      />
                      <div>
                        <Title level={5} style={{ marginBottom: 4, marginTop: 0 }}>
                          {title}
                        </Title>
                        <p style={{ margin: 0, color: "rgba(0,0,0,0.65)" }}>{description}</p>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Form.Item>

          <Form.Item label="Search Model">
            <Input placeholder="Search models..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </Form.Item>

          <Row gutter={[16, 16]}>
            {filteredModels.map((model) => (
              <Col span={24} key={model.key}>

                <Card
                  hoverable
                  bordered={selectedModel !== model.key}
                  onClick={() => {
                    setSelectedModel(model.key);
                    form.setFieldsValue({ model: model.key });
                  }}
                  style={{ cursor: "pointer", borderColor: selectedModel === model.key ? "#1890ff" : undefined }}>
                    
                  <h2 className="model-name" style={{ marginTop: 0 }}>
                    <img src={model.icon} alt="icon" height="32" style={{ verticalAlign: 'middle' }} /> {model.name}
                  </h2>

                  <Divider />
                  <p>{model.description}</p>


                  {(model.tags).map(tag =>
                    <Tag color="blue">{tag}</Tag>
                  )}

                </Card>

              </Col>
            ))}
          </Row>

          <Form.Item name="model" hidden rules={[{ required: true, message: "Please select a model" }]}>
            <Input type="hidden" />
          </Form.Item>

          <Divider />
          <Title level={3}>2. Main</Title>
          <Form.Item label="Assistant Name" name="name" rules={[{ required: true }]}>
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
            <Dragger name="file" multiple={false} beforeUpload={() => false}>
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
            <Button type="primary" htmlType="submit">
              Create Assistant
            </Button>
          </Form.Item>
        </Form>
      </div>



    </>
  );
}


export default CreateModel;
