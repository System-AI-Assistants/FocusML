import React, { useEffect, useState, useCallback } from 'react';
import { Card, Button, List, Typography, Space, Tag, message, Modal, Select, Table } from 'antd';
import { useKeycloak } from '@react-keycloak/web';
import { getModelFams } from '../services/api';
import { getBenchmarkDatasets, listBenchmarkRuns, createBenchmarkRun } from '../services/api';

const { Title, Text } = Typography;

function Benchmarking() {
  const { keycloak, initialized } = useKeycloak();
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!initialized || !keycloak?.authenticated) return;
    try {
      setLoading(true);
      const [ds, modelFams, rns] = await Promise.all([
        getBenchmarkDatasets(keycloak),
        getModelFams(keycloak),
        listBenchmarkRuns(keycloak),
      ]);
      setDatasets(ds || []);
      // Flatten models from families for a select list
      const flatModels = (modelFams || []).flatMap(f => (f.models || []).map(m => ({
        value: m.name,
        label: `${m.name} (${f.name})`,
      })));
      setModels(flatModels);
      setRuns(rns || []);
    } catch (e) {
      console.error(e);
      message.error('Failed to load benchmarking data');
    } finally {
      setLoading(false);
    }
  }, [initialized, keycloak]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openRunModal = (dataset) => {
    setSelectedDataset(dataset);
    setSelectedModel(null);
    setRunModalOpen(true);
  };

  const handleCreateRun = async () => {
    if (!selectedDataset || !selectedModel) {
      message.warning('Select a model first');
      return;
    }
    try {
      setSubmitting(true);
      await createBenchmarkRun(keycloak, { model: selectedModel, dataset: selectedDataset.name });
      message.success('Benchmark queued');
      setRunModalOpen(false);
      await fetchAll();
    } catch (e) {
      console.error(e);
      message.error('Failed to create benchmark run');
    } finally {
      setSubmitting(false);
    }
  };

  const runColumns = [
    { title: 'Run ID', dataIndex: 'id', key: 'id' },
    { title: 'Model', dataIndex: 'model', key: 'model' },
    { title: 'Dataset', dataIndex: 'dataset', key: 'dataset' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'completed' ? 'green' : s === 'queued' ? 'blue' : 'default'}>{s}</Tag> },
    { title: 'Score', dataIndex: 'score', key: 'score', render: (v) => v == null ? '-' : v },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? new Date(v).toLocaleString() : '-' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Title level={3}>Benchmarking</Title>
        <Card title="Datasets" loading={loading}>
          <List
            dataSource={datasets}
            renderItem={(ds) => (
              <List.Item
                actions={[<Button type="primary" onClick={() => openRunModal(ds)}>Run Benchmark</Button>]}
              >
                <List.Item.Meta
                  title={<Space><Text strong>{ds.name}</Text><Tag>{ds.task_type || 'task'}</Tag></Space>}
                  description={
                    <Space direction="vertical">
                      <Text>{ds.description}</Text>
                      {ds.url && <a href={ds.url} target="_blank" rel="noreferrer">Dataset link</a>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="Recent Runs" loading={loading}>
          <Table rowKey="id" dataSource={runs} columns={runColumns} pagination={{ pageSize: 10 }} />
        </Card>
      </Space>

      <Modal
        title={`Run Benchmark${selectedDataset ? `: ${selectedDataset.name}` : ''}`}
        open={runModalOpen}
        onCancel={() => setRunModalOpen(false)}
        onOk={handleCreateRun}
        okButtonProps={{ loading: submitting, disabled: !selectedModel }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Select model</Text>
          <Select
            showSearch
            placeholder="Choose a model"
            value={selectedModel}
            onChange={setSelectedModel}
            options={models}
            style={{ width: '100%' }}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Space>
      </Modal>
    </div>
  );
}

export default Benchmarking;
