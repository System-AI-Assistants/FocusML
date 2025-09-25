import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Typography, 
  Upload, 
  message, 
  Space, 
  Tag, 
  Progress,
  Tooltip,
  Modal
} from 'antd';
import { 
  UploadOutlined, 
  FileOutlined, 
  DeleteOutlined, 
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import './DataCollections.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const DataCollections = () => {
  const { keycloak } = useKeycloak();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [collections, setCollections] = useState([]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);

  // Mock data - replace with actual API call
  useEffect(() => {
    // TODO: Replace with actual API call to fetch collections
    const mockCollections = [
      {
        id: '1',
        name: 'Customer Feedback Q3',
        fileType: 'CSV',
        size: '2.4 MB',
        records: 1245,
        uploadedAt: '2025-09-15T10:30:00',
        status: 'processed'
      },
      {
        id: '2',
        name: 'Product Reviews',
        fileType: 'JSON',
        size: '1.8 MB',
        records: 892,
        uploadedAt: '2025-09-10T14:15:00',
        status: 'processing'
      },
    ];
    setCollections(mockCollections);
  }, []);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    fileList.forEach(file => {
      formData.append('files', file);
    });

    setUploading(true);
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch('/api/data-collections/upload', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${keycloak.token}`,
      //   },
      //   body: formData,
      // });
      // const result = await response.json();
      
      // Mock success response
      message.success('File uploaded successfully');
      setFileList([]);
      
      // Refresh collections
      // fetchCollections();
    } catch (error) {
      console.error('Upload failed:', error);
      message.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (collection) => {
    setCollectionToDelete(collection);
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!collectionToDelete) return;
    
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/data-collections/${collectionToDelete.id}`, {
      //   method: 'DELETE',
      //   headers: {
      //     'Authorization': `Bearer ${keycloak.token}`,
      //   },
      // });
      
      message.success('Collection deleted successfully');
      setCollections(collections.filter(c => c.id !== collectionToDelete.id));
    } catch (error) {
      console.error('Delete failed:', error);
      message.error('Failed to delete collection');
    } finally {
      setIsDeleteModalVisible(false);
      setCollectionToDelete(null);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <FileOutlined style={{ color: '#1890ff' }} />
          <span>{text}</span>
          {record.status === 'processing' && (
            <Tag color="processing" icon={<InfoCircleOutlined />}>Processing</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 100,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 120,
    },
    {
      title: 'Records',
      dataIndex: 'records',
      key: 'records',
      width: 120,
      render: (records) => records.toLocaleString(),
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date) => new Date(date).toLocaleDateString(),
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => {
        const statusMap = {
          processed: { color: 'success', text: 'Ready' },
          processing: { color: 'processing', text: 'Processing' },
          error: { color: 'error', text: 'Error' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: 'Unknown' };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Download">
            <Button 
              type="text" 
              icon={<DownloadOutlined />} 
              disabled={record.status !== 'processed'}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const uploadProps = {
    onRemove: (file) => {
      setFileList((prevList) => 
        prevList.filter((item) => item.uid !== file.uid)
      );
    },
    beforeUpload: (file) => {
      // Check file type
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      const isJSON = file.type === 'application/json' || file.name.endsWith('.json');
      
      if (!isCSV && !isJSON) {
        message.error('You can only upload CSV or JSON files!');
        return Upload.LIST_IGNORE;
      }
      
      // Check file size (10MB max)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('File must be smaller than 10MB!');
        return Upload.LIST_IGNORE;
      }
      
      setFileList((prevList) => [...prevList, file]);
      return false; // Prevent auto upload
    },
    fileList,
    multiple: false,
  };

  return (
    <div className="data-collections-container">
      <div className="page-header">
        <Title level={2}>Data Collections</Title>
        <Text type="secondary">Upload and manage your data collections for analysis</Text>
      </div>

      <Card 
        title="Upload New Collection" 
        className="upload-card"
        style={{ marginBottom: 24 }}
      >
        <Dragger 
          {...uploadProps}
          className="upload-dragger"
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            Click or drag file to this area to upload
          </p>
          <p className="ant-upload-hint">
            Support for a single CSV or JSON file. Max file size: 10MB
          </p>
        </Dragger>
        
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={fileList.length === 0}
            icon={<UploadOutlined />}
          >
            {uploading ? 'Uploading...' : 'Start Upload'}
          </Button>
        </div>
      </Card>

      <Card 
        title="Your Collections"
        className="collections-table"
      >
        <Table 
          columns={columns} 
          dataSource={collections} 
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={!collections.length}
        />
      </Card>

      <Modal
        title="Delete Collection"
        open={isDeleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p>Are you sure you want to delete the collection "{collectionToDelete?.name}"?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default DataCollections;