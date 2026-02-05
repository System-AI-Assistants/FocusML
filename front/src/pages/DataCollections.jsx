import React, { useState, useRef, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Typography, 
  Upload, 
  Space, 
  message, 
  Input,
  Modal,
  Tooltip,
  Table,
  Tag,
  Dropdown,
  Menu,
  Progress,
  Row,
  Col,
  Select,
  InputNumber,
  Collapse,
  Divider
} from 'antd';
import { 
  // File Icons
  CloudUploadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FileWordOutlined,
  FilePptOutlined,
  FileOutlined,
  FileMarkdownOutlined,
  FileUnknownOutlined,
  FileSearchOutlined,
  SoundOutlined,
  // Other Icons
  LinkOutlined,
  DatabaseOutlined,
  MoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  ScissorOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeycloak } from '@react-keycloak/web';
import { getEmbeddingModels } from '../services/api';
import './DataCollections.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;
const { Panel } = Collapse;

const API_BASE_URL = 'http://localhost:8000';

// Document file extensions that support chunking
const DOCUMENT_EXTENSIONS = ['txt', 'pdf', 'docx'];
const TABULAR_EXTENSIONS = ['csv', 'xlsx', 'xls'];


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
  if (!type) return <FileUnknownOutlined />;

  const normalizedType = type.toLowerCase();

  switch(normalizedType) {
    case 'csv':
    case 'xlsx':
    case 'xls':
    case 'spreadsheet':
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    case 'database':
      return <DatabaseOutlined style={{ color: '#722ed1' }} />;
    case 'web':
    case 'url':
      return <LinkOutlined style={{ color: '#1890ff' }} />;
    case 'text':
    case 'txt':
      return <FileTextOutlined style={{ color: '#13c2c2' }} />;
    default:
      // For unknown types, try to match common file extensions
      if (normalizedType.includes('excel') || normalizedType.includes('sheet')) {
        return <FileExcelOutlined style={{ color: '#52c41a' }} />;
      } else if (normalizedType.includes('word') || normalizedType.includes('doc')) {
        return <FileWordOutlined style={{ color: '#1890ff' }} />;
      } else if (normalizedType.includes('powerpoint') || normalizedType.includes('ppt')) {
        return <FilePptOutlined style={{ color: '#fa8c16' }} />;
      } else if (normalizedType.includes('image')) {
        return <FileImageOutlined style={{ color: '#722ed1' }} />;
      } else if (normalizedType.includes('zip') || normalizedType.includes('rar') || normalizedType.includes('7z')) {
        return <FileZipOutlined style={{ color: '#fa8c16' }} />;
      } else if (normalizedType.includes('audio') || normalizedType.includes('mp3') || normalizedType.includes('wav')) {
        return <SoundOutlined style={{ color: '#13c2c2' }} />;
      } else if (normalizedType.includes('video') || normalizedType.includes('mp4') || normalizedType.includes('mov')) {
        return <VideoCameraOutlined style={{ color: '#eb2f96' }} />;
      } else {
        return <FileOutlined />;
      }
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
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshingStatusId, setRefreshingStatusId] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputMode, setInputMode] = useState(null); // 'url' or 'database'
  const [inputValue, setInputValue] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState({ columns: [], rows: [], content_type: 'tabular' });
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Embedding model state
  const [embeddingModels, setEmbeddingModels] = useState([]);
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState(null);
  
  // Chunking state
  const [chunkingMethods, setChunkingMethods] = useState([]);
  const [selectedChunkingMethod, setSelectedChunkingMethod] = useState('recursive');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [showChunkingOptions, setShowChunkingOptions] = useState(false);
  
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const animationRef = useRef(null);
  const animationTexts = [
    'Analyzing content...',
    'Extracting data...',
    'Processing structure...',
    'Chunking document...',
    'Generating embeddings...',
    'Almost there...'
  ];
  const [textIndex, setTextIndex] = useState(0);

  // Check if file is a document type that supports chunking
  const isDocumentFile = (filename) => {
    if (!filename) return false;
    const ext = filename.split('.').pop()?.toLowerCase();
    return DOCUMENT_EXTENSIONS.includes(ext);
  };

  // Fetch available chunking methods
  const fetchChunkingMethods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/data-collections/chunking-methods/`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
      });
      if (response.ok) {
        const methods = await response.json();
        setChunkingMethods(methods);
      }
    } catch (error) {
      console.error('Failed to fetch chunking methods:', error);
    }
  };

  // Fetch embedding models
  const fetchEmbeddingModels = async () => {
    try {
      const models = await getEmbeddingModels(keycloak);
      setEmbeddingModels(models);
      // Auto-select first model if available
      if (models.length > 0 && !selectedEmbeddingModel) {
        setSelectedEmbeddingModel(models[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch embedding models:', error);
      message.error('Failed to load embedding models');
    }
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file removal
  const handleRemove = () => {
    setFile(null);
    setSelectedEmbeddingModel(embeddingModels.length > 0 ? embeddingModels[0].id : null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle view collection
  const handleView = async (record) => {
    try {
      setPreviewLoading(true);
      setPreviewVisible(true);
      
      const response = await fetch(`${API_BASE_URL}/data-collections/collections/${record.id}/preview`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load preview data');
      }

      const data = await response.json();
      
      // Handle both document and tabular previews
      if (data.content_type === 'document') {
        setPreviewData({
          content_type: 'document',
          file_type: data.file_type,
          chunking_method: data.chunking_method,
          document_metadata: data.document_metadata,
          chunks: data.chunks || [],
          total_chunks: data.total_chunks,
          preview_count: data.preview_count
        });
      } else {
        setPreviewData({
          content_type: 'tabular',
          columns: data.columns || [],
          rows: data.rows || []
        });
      }
      
    } catch (error) {
      console.error('Failed to load preview:', error);
      message.error('Failed to load preview data');
      setPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle download collection
  const handleDownload = async (record) => {
    try {
      const response = await fetch(`${API_BASE_URL}/data-collections/collections/${record.id}/download`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Get the filename from the Content-Disposition header or use the record name
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = record.name;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create a blob from the response and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      message.success(`Downloaded ${filename} successfully`);
    } catch (error) {
      console.error('Download failed:', error);
      message.error(error.message || 'Failed to download file');
    }
  };

  // Handle delete collection
  const handleDelete = async (record) => {
    console.log('Delete button clicked for record:', record);
    
    // Simple JavaScript confirm dialog
    const isConfirmed = window.confirm(`Are you sure you want to delete "${record.name}"? This action cannot be undone.`);
    
    if (!isConfirmed) {
      console.log('Delete operation cancelled by user');
      return;
    }
    
    try {
      console.log('Sending DELETE request to:', `${API_BASE_URL}/data-collections/collections/${record.id}`);
      
      const response = await fetch(`${API_BASE_URL}/data-collections/collections/${record.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        let errorDetail = 'Failed to delete collection';
        try {
          const errorData = await response.json();
          console.error('Delete error response:', errorData);
          errorDetail = errorData.detail || errorDetail;
        } catch (e) {
          const errorText = await response.text();
          console.error('Could not parse error response as JSON:', errorText);
          errorDetail = response.statusText || errorDetail;
        }
        throw new Error(errorDetail);
      }

      const result = await response.json().catch(() => ({}));
      console.log('Delete successful, refreshing collections...');
      
      // Show success message
      alert(result.message || 'Collection deleted successfully');
      
      // Refresh the collections list
      await refreshCollections();
      
    } catch (error) {
      console.error('Delete operation failed:', error);
      alert(error.message || 'Failed to delete collection');
    }
  };

  // Function to check embedding status
  const checkEmbeddingStatus = async (collectionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/data-collections/collections/${collectionId}/embedding-status`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch embedding status');
      }
      
      const data = await response.json();
      
      // Update the collection in the state
      setCollections(prevCollections => 
        prevCollections.map(collection => 
          collection.id === data.collection_id 
            ? { ...collection, ...data } 
            : collection
        )
      );
      
      return data;
    } catch (error) {
      console.error('Error checking embedding status:', error);
      message.error('Failed to check embedding status');
      throw error;
    }
  };

  // Table columns definition
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="file-cell">
          <span className="file-icon">
            {getFileTypeIcon(record.file_type || record.type)}
          </span>
          <span className="file-name">{text}</span>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'file_type',
      key: 'type',
      render: (type, record) => (
        <Space size="small">
          <Tag color={record.content_type === 'document' ? 'blue' : 'green'}>
            {type ? type.toUpperCase() : 'Unknown'}
          </Tag>
          {record.content_type === 'document' && (
            <Tooltip title={`Chunking: ${record.chunking_method || 'default'}`}>
              <Tag color="purple" style={{ fontSize: '11px' }}>
                <ScissorOutlined />
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Size',
      key: 'size',
      render: (_, record) => {
        if (record.file_type === 'url') return 'N/A';
        if (record.file_type === 'database') return 'N/A';
        return record.size ? formatFileSize(record.size) : '-';
      },
    },
    {
      title: 'Records',
      dataIndex: 'row_count',
      key: 'records',
      render: (count, record) => {
        if (!count) return '-';
        const label = record.content_type === 'document' ? 'chunks' : 'rows';
        return `${count.toLocaleString()} ${label}`;
      },
    },
    {
      title: 'Uploaded',
      dataIndex: 'created_at',
      key: 'uploadedAt',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      key: 'status',
      render: () => (
        <Tag color="green">Processed</Tag>
      ),
    },
    {
      title: 'Embedding Status',
      key: 'embedding_status',
      width: 200,
      render: (_, record) => {
        const status = record.embeddings_status || 'pending';
        const isProcessing = status === 'processing' || status === 'pending';
        
        return (
          <Space>
            <Tag 
              color={
                status === 'completed' ? 'success' : 
                status === 'failed' ? 'error' : 'processing'
              }
              icon={
                status === 'completed' ? <CheckCircleOutlined /> :
                status === 'failed' ? <CloseCircleOutlined /> : <ClockCircleOutlined />
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Tag>
            {isProcessing && (
              <Button 
                type="text" 
                size="small" 
                icon={<ReloadOutlined />} 
                onClick={() => checkEmbeddingStatus(record.id)}
                loading={refreshingStatusId === record.id}
              />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Embedding Model',
      key: 'embedding_model',
      width: 200,
      render: (_, record) => {
        const modelName = record.embedding_model_name || 
                         (record.embeddings_metadata && record.embeddings_metadata.embedding_model) ||
                         'N/A';
        return <Tag color="blue">{modelName}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            icon={<FileSearchOutlined />} 
            onClick={() => handleView(record)}
            title="View"
          />
          <Button 
            icon={<DownloadOutlined />} 
            onClick={() => handleDownload(record)}
            title="Download"
          />
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record)}
            title="Delete"
          />
        </Space>
      ),
    },
  ];

  // Focus input when mode changes
  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

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
    
    // Create a preview URL for the file
    const preview = URL.createObjectURL(file);
    
    // Store both the file object and its properties
    setFile({
      file: file,  // Store the actual file object
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      preview: preview
    });
  };

  const handleUpload = async () => {
    if (!file) {
      message.error('Please select a file first!');
      return;
    }

    if (!selectedEmbeddingModel) {
      message.error('Please select an embedding model!');
      return;
    }

    setUploading(true);
    setIsAnimating(true);

    try {
      // Get the actual file object
      const fileObj = file.file || file;
      
      const formData = new FormData();
      // Create a new File object to ensure it's a proper file
      const fileToUpload = new File(
        [fileObj], 
        file.name, 
        { type: file.type, lastModified: file.lastModified }
      );
      
      formData.append('file', fileToUpload, file.name);
      formData.append('embedding_model_id', selectedEmbeddingModel.toString());

      // Add chunking parameters for document files
      if (isDocumentFile(file.name)) {
        formData.append('chunking_method', selectedChunkingMethod);
        formData.append('chunk_size', chunkSize.toString());
        formData.append('chunk_overlap', chunkOverlap.toString());
      }

      console.log('Sending file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        embedding_model_id: selectedEmbeddingModel,
        isDocument: isDocumentFile(file.name),
        chunkingMethod: selectedChunkingMethod,
        isFile: fileToUpload instanceof File
      });

      // Don't set Content-Type header - let the browser set it with the boundary
      const response = await fetch(`${API_BASE_URL}/data-collections/upload/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Upload error:', error);
        throw new Error(error.detail || 'Failed to upload file');
      }

      const result = await response.json();
      message.success('File uploaded successfully!');
      refreshCollections();
      setFile(null);
      // Reset options
      setSelectedEmbeddingModel(embeddingModels.length > 0 ? embeddingModels[0].id : null);
      setSelectedChunkingMethod('recursive');
      setChunkSize(512);
      setChunkOverlap(50);
    } catch (error) {
      console.error('Upload failed:', error);
      message.error(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setIsAnimating(false);
    }
  };

  const refreshCollections = async () => {
    setTableLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/data-collections/collections/`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }

      const data = await response.json();
      
      // Format the data for the table
      const formattedData = data.map(collection => ({
        ...collection,
        key: collection.id.toString(),
        // Ensure all required fields have values
        type: collection.file_type || 'file',
        status: 'processed', // Default status
        uploadedAt: collection.created_at,
        records: collection.row_count || 0,
        size: collection.size || 0
      }));
      
      setCollections(formattedData);
    } catch (error) {
      console.error('Failed to refresh collections:', error);
      message.error('Failed to refresh collections');
    } finally {
      setTableLoading(false);
    }
  };

  const renderInputField = () => {
    const placeholder = inputMode === 'url' 
      ? 'Paste URL (e.g., https://example.com/data)' 
      : 'Enter database connection string';
    
    const icon = inputMode === 'url' ? <LinkOutlined /> : <DatabaseOutlined />;
    
    return (
      <div className="input-field-container">
        <Input
          ref={inputRef}
          size="large"
          placeholder={placeholder}
          prefix={icon}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={() => handleUpload(inputValue)}
          disabled={uploading}
          className="input-field"
        />
        <div className="input-actions">
          <Button 
            type="text" 
            onClick={() => {
              setInputMode(null);
              setInputValue('');
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button 
            type="primary" 
            onClick={handleUpload}
            loading={uploading}
            disabled={!file}
          >
            Process File
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (keycloak && keycloak.authenticated) {
      refreshCollections();
      fetchChunkingMethods();
      fetchEmbeddingModels();
    }
  }, [keycloak]);

  // Update chunking options visibility when file changes
  useEffect(() => {
    if (file && isDocumentFile(file.name)) {
      setShowChunkingOptions(true);
    } else {
      setShowChunkingOptions(false);
    }
  }, [file]);

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
          className={`upload-container ${inputMode ? 'hidden' : ''} ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
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

              {/* Chunking Options for Document Files */}
              {showChunkingOptions && !uploading && (
                <div className="chunking-options" onClick={(e) => e.stopPropagation()}>
                  <div className="chunking-header">
                    <ScissorOutlined />
                    <span>Text Chunking Options</span>
                  </div>
                  
                  <div className="chunking-form">
                    <div className="chunking-field">
                      <label>Chunking Method</label>
                      <Select
                        value={selectedChunkingMethod}
                        onChange={setSelectedChunkingMethod}
                        style={{ width: '100%' }}
                        size="middle"
                      >
                        {chunkingMethods.map(method => (
                          <Option key={method.id} value={method.id}>
                            <div className="chunking-option">
                              <span className="chunking-option-name">{method.name}</span>
                            </div>
                          </Option>
                        ))}
                      </Select>
                      {chunkingMethods.find(m => m.id === selectedChunkingMethod)?.description && (
                        <Text type="secondary" className="chunking-description">
                          {chunkingMethods.find(m => m.id === selectedChunkingMethod)?.description}
                        </Text>
                      )}
                    </div>

                    {(selectedChunkingMethod === 'fixed_size' || selectedChunkingMethod === 'recursive') && (
                      <div className="chunking-field-row">
                        <div className="chunking-field">
                          <label>Chunk Size</label>
                          <InputNumber
                            min={100}
                            max={4000}
                            value={chunkSize}
                            onChange={setChunkSize}
                            style={{ width: '100%' }}
                            addonAfter="chars"
                          />
                        </div>
                        <div className="chunking-field">
                          <label>Overlap</label>
                          <InputNumber
                            min={0}
                            max={500}
                            value={chunkOverlap}
                            onChange={setChunkOverlap}
                            style={{ width: '100%' }}
                            addonAfter="chars"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!uploading && (
                <div className="embedding-model-selector" onClick={(e) => e.stopPropagation()}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>Select Embedding Model:</Text>
                  </div>
                  <Select
                    style={{ width: '100%', marginBottom: 16 }}
                    placeholder="Choose an embedding model"
                    value={selectedEmbeddingModel}
                    onChange={setSelectedEmbeddingModel}
                    size="large"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={embeddingModels.map(model => ({
                      value: model.id,
                      label: `${model.name}${model.family_name ? ` (${model.family_name})` : ''}`
                    }))}
                  />
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
                  disabled={!selectedEmbeddingModel}
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
              onClick={() => setInputMode('url')}
              disabled={!!inputMode}
            >
              Paste URL
            </Button>
            <Button
              type="text"
              icon={<DatabaseOutlined />}
              className="quick-action-btn"
              onClick={() => setInputMode('database')}
              disabled={!!inputMode}
            >
              Connect Database
            </Button>
          </div>
          
          {inputMode && (
            <div className="input-container">
              {renderInputField()}
            </div>
          )}
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
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <div className="empty-table">
                <FileSearchOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                <div>No data collections found</div>
                <Button type="primary" className="mt-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <CloudUploadOutlined /> Upload Your First File
                </Button>
              </div>
            )
          }}
        />
        
        {/* Preview Modal */}
        <Modal
          title={previewData.content_type === 'document' ? 'Document Chunks Preview' : 'Data Preview'}
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={[
            <Button key="close" onClick={() => setPreviewVisible(false)}>
              Close
            </Button>
          ]}
          width={1000}
        >
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="ant-spin ant-spin-lg" />
              <p>Loading preview data...</p>
            </div>
          ) : previewData.content_type === 'document' ? (
            // Document preview with chunks
            <div className="document-preview">
              <div className="document-meta">
                <Space size="middle" wrap>
                  <Tag color="blue">{previewData.file_type?.toUpperCase()}</Tag>
                  <Tag color="purple">
                    <ScissorOutlined /> {previewData.chunking_method}
                  </Tag>
                  <Text type="secondary">
                    Showing {previewData.preview_count} of {previewData.total_chunks} chunks
                  </Text>
                </Space>
                {previewData.document_metadata && (
                  <div className="document-stats">
                    {previewData.document_metadata.word_count && (
                      <Text type="secondary">{previewData.document_metadata.word_count.toLocaleString()} words</Text>
                    )}
                    {previewData.document_metadata.page_count && (
                      <Text type="secondary">{previewData.document_metadata.page_count} pages</Text>
                    )}
                  </div>
                )}
              </div>
              <div className="chunks-list">
                {previewData.chunks?.map((chunk, index) => (
                  <div key={index} className="chunk-item">
                    <div className="chunk-header">
                      <Tag color="geekblue">Chunk {chunk.index + 1}</Tag>
                      <Text type="secondary">{chunk.full_length} chars</Text>
                    </div>
                    <div className="chunk-content">
                      {chunk.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Tabular preview
            <Table 
              dataSource={previewData.rows}
              columns={previewData.columns?.map(column => ({
                title: column,
                dataIndex: column,
                key: column,
                ellipsis: true,
              })) || []}
              pagination={{ pageSize: 5 }}
              size="small"
              scroll={{ x: 'max-content' }}
              rowKey={(record, index) => index}
            />
          )}
        </Modal>
      </Card>
    </div>
  );
};

export default DataCollections;