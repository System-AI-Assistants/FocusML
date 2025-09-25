import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Typography, 
  Upload, 
  message, 
  Space,
  Input,
  Tooltip,
  Table,
  Tag,
  Dropdown,
  Menu,
  Progress,
  Card,
  Row,
  Col
} from 'antd';
import { 
  CloudUploadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  LinkOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FileWordOutlined,
  FileMarkdownOutlined,
  FileUnknownOutlined,
  MoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeycloak } from '@react-keycloak/web';
import './DataCollections.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const fileTypeIcons = {
  // Documents
  'application/pdf': <FilePdfOutlined />,
  'application/msword': <FileWordOutlined />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileWordOutlined />,
  'application/vnd.ms-excel': <FileExcelOutlined />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileExcelOutlined />,
  'text/csv': <FileExcelOutlined />,
  'text/plain': <FileTextOutlined />,
  'application/json': <FileTextOutlined />,
  'text/markdown': <FileMarkdownOutlined />,
  'application/xml': <FileTextOutlined />,
  // Images
  'image/jpeg': <FileImageOutlined />,
  'image/png': <FileImageOutlined />,
  'image/gif': <FileImageOutlined />,
  'image/svg+xml': <FileImageOutlined />,
  // Archives
  'application/zip': <FileZipOutlined />,
  'application/x-rar-compressed': <FileZipOutlined />,
  'application/x-7z-compressed': <FileZipOutlined />,
  // Default
  'default': <FileUnknownOutlined />
};

// Mock data for the table - replace with actual API call
const mockCollections = [
  {
    id: '1',
    name: 'Quarterly Sales Report',
    type: 'spreadsheet',
    size: '2.4 MB',
    status: 'processed',
    uploadedAt: '2023-09-20T10:30:00',
    records: 1245
  },
  {
    id: '2',
    name: 'Customer Feedback Q3',
    type: 'pdf',
    size: '5.1 MB',
    status: 'processing',
    progress: 65,
    uploadedAt: '2023-09-22T14:15:00',
    records: 0
  },
  {
    id: '3',
    name: 'Product Database',
    type: 'database',
    size: '15.7 MB',
    status: 'error',
    uploadedAt: '2023-09-23T09:45:00',
    records: 0,
    error: 'Connection timeout'
  },
  {
    id: '4',
    name: 'Website Content',
    type: 'web',
    size: '3.2 MB',
    status: 'processed',
    uploadedAt: '2023-09-24T16:20:00',
    records: 87
  },
];

const getFileTypeIcon = (type) => {
  switch(type) {
    case 'spreadsheet':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    case 'database':
      return <DatabaseOutlined style={{ color: '#722ed1' }} />;
    case 'web':
      return <LinkOutlined style={{ color: '#1890ff' }} />;
    case 'text':
      return <FileTextOutlined style={{ color: '#13c2c2' }} />;
    default:
      return <FileUnknownOutlined />;
  }
};

const getStatusTag = (status, progress, error) => {
  switch(status) {
    case 'processed':
      return <Tag icon={<CheckCircleOutlined />} color="success">Processed</Tag>;
    case 'processing':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag icon={<ClockCircleOutlined />} color="processing">Processing</Tag>
          <Progress percent={progress} size="small" style={{ width: 100, margin: 0 }} />
        </div>
      );
    case 'error':
      return <Tag icon={<CloseCircleOutlined />} color="error">Error: {error}</Tag>;
    default:
      return <Tag>Unknown</Tag>;
  }
};

const DataCollections = () => {
  const { keycloak } = useKeycloak();
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [collections, setCollections] = useState(mockCollections);
  const [tableLoading, setTableLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef(null);
  const animationRef = useRef(null);
  const animationTexts = [
    'Analyzing content...',
    'Extracting data...',
    'Processing structure...',
    'Optimizing for analysis...',
    'Almost there...'
  ];
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    if (uploading) {
      animationRef.current = setInterval(() => {
        setTextIndex(prev => (prev + 1) % animationTexts.length);
      }, 2000);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Hold at 90% until actual upload completes
          }
          return prev + 10;
        });
      }, 300);

      return () => {
        clearInterval(animationRef.current);
        clearInterval(progressInterval);
      };
    }
  }, [uploading]);

  const getFileIcon = (fileType) => {
    return fileTypeIcons[fileType] || fileTypeIcons['default'];
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    // Reset any previous state
    setFile(null);
    setUploadProgress(0);

    // Set the new file
    setFile({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      preview: URL.createObjectURL(file)
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setIsAnimating(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // TODO: Replace with actual API call
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${keycloak.token}`,
      //   },
      //   body: formData,
      // });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setUploadProgress(100);
      message.success('File uploaded and processed successfully!');
      
      // Reset after success
      setTimeout(() => {
        setFile(null);
        setUploading(false);
        setUploadProgress(0);
        setIsAnimating(false);
      }, 1500);

    } catch (error) {
      console.error('Upload failed:', error);
      message.error('Upload failed. Please try again.');
      setUploading(false);
      setIsAnimating(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setUploadProgress(0);
    setUploading(false);
    setIsAnimating(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="file-cell">
          <span className="file-icon">
            {getFileTypeIcon(record.type)}
          </span>
          <span className="file-name">{text}</span>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'spreadsheet' ? 'green' : type === 'pdf' ? 'red' : type === 'database' ? 'purple' : 'blue'}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: 'Records',
      dataIndex: 'records',
      key: 'records',
      render: (records) => records > 0 ? records.toLocaleString() : '-',
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record.progress, record.error),
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Dropdown
          overlay={
            <Menu
              items={[
                {
                  key: 'view',
                  label: 'View Details',
                  icon: <EyeOutlined />,
                  onClick: () => message.info(`Viewing ${record.name}`),
                },
                {
                  key: 'download',
                  label: 'Download',
                  icon: <DownloadOutlined />,
                  disabled: record.status !== 'processed',
                  onClick: () => message.info(`Downloading ${record.name}`),
                },
                {
                  type: 'divider',
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => {
                    setCollections(collections.filter(item => item.id !== record.id));
                    message.success(`${record.name} deleted`);
                  },
                },
              ]}
            />
          }
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const refreshCollections = async () => {
    setTableLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/collections', {
      //   headers: {
      //     'Authorization': `Bearer ${keycloak.token}`,
      //   },
      // });
      // const data = await response.json();
      // setCollections(data);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to load collections:', error);
      message.error('Failed to load collections');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    refreshCollections();
  }, []);

  return (
    <div className="data-collections-container">
      <div className="page-header">
        <Title level={3} style={{ marginBottom: 0 }}>Data Collections</Title>
        <Text type="secondary">Upload and manage your data sources</Text>
      </div>

      <Card 
        className="upload-card"
        title={
          <div className="card-header">
            <CloudUploadOutlined />
            <span>Upload New Data</span>
          </div>
        }
        bordered={false}
      >

        <div
          className={`upload-container ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          multiple={false}
        />
        
        {!file ? (
          <div className="upload-placeholder">
            <CloudUploadOutlined className="upload-icon" />
            <h3>Drag & Drop your file here</h3>
            <p>or click to browse files</p>
            <div className="file-types">
              <span>Supports: </span>
              <span className="file-type-tag">PDF</span>
              <span className="file-type-tag">DOCX</span>
              <span className="file-type-tag">XLSX</span>
              <span className="file-type-tag">CSV</span>
              <span className="file-type-tag">TXT</span>
              <span className="file-type-tag">JSON</span>
              <span className="file-type-tag">and more...</span>
            </div>
          </div>
        ) : (
          <div className="file-preview">
            <div className="file-info">
              <div className="file-icon">
                {getFileIcon(file.type)}
              </div>
              <div className="file-details">
                <h4>{file.name}</h4>
                <p>{formatFileSize(file.size)} • {file.type || 'Unknown type'}</p>
              </div>
              <Button
                type="text"
                danger
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                Remove
              </Button>
            </div>

            {uploading && (
              <div className="upload-progress">
                <div className="progress-text">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={textIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      {animationTexts[textIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-percent">{uploadProgress}%</div>
              </div>
            )}

            {!uploading && (
              <Button
                type="primary"
                size="large"
                className="upload-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                icon={<CloudUploadOutlined />}
              >
                Process File
              </Button>
            )}
          </div>
        )}
        </div>

        <div className="additional-options">
          <div className="divider">
            <span>or</span>
          </div>

          <div className="quick-actions">
            <Button
              type="text"
              icon={<LinkOutlined />}
              className="quick-action-btn"
            >
              Paste URL
            </Button>
            <Button
              type="text"
              icon={<DatabaseOutlined />}
              className="quick-action-btn"
            >
              Connect Database
            </Button>
          </div>
        </div>
      </Card>

      <Card 
        className="collections-card"
        title={
          <div className="card-header">
            <span>My Data Collections</span>
            {/* <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={refreshCollections}
              loading={tableLoading}
            >
              Refresh
            </Button> */}
          </div>
        }
        bordered={false}
      >
        <Table 
          columns={columns} 
          dataSource={collections} 
          rowKey="id"
          loading={tableLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} collections`,
          }}
          locale={{
            emptyText: (
              <div className="empty-table">
                <FileSearchOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                <div>No data collections found</div>
                <Button type="primary" className="mt-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <CloudUploadOutlined /> Upload Your First File
                </Button>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default DataCollections;