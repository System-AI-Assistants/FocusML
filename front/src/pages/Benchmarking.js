import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Button, List, Typography, Space, Tag, message, Modal, Select, Table, Divider, Badge, Alert } from 'antd';
import { useKeycloak } from '@react-keycloak/web';
import { getModelFams } from '../services/api';
import { getBenchmarkDatasets, listBenchmarkRuns, createBenchmarkRun, getBenchmarkRun, getBenchmarkRunLogs, cancelBenchmarkRun } from '../services/api';

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
  const [activeRun, setActiveRun] = useState(null); // { id, model, dataset, status, score, created_at }
  const [logItems, setLogItems] = useState([]);
  const logOffsetRef = useRef(0);
  const seenIndexRef = useRef(new Set());
  const pollRef = useRef(null);

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
      const res = await createBenchmarkRun(keycloak, { model: selectedModel, dataset: selectedDataset.name });
      message.success('Benchmark queued');
      setRunModalOpen(false);
      // set active run and start polling
      const run = await getBenchmarkRun(keycloak, res.id);
      setActiveRun(run);
      setLogItems([]);
      logOffsetRef.current = 0;
      seenIndexRef.current = new Set();
      startPollingLogs(run.id);
      await fetchAll();
    } catch (e) {
      console.error(e);
      message.error('Failed to create benchmark run');
    } finally {
      setSubmitting(false);
    }
  };

  const startPollingLogs = useCallback((runId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        if (!keycloak?.authenticated || !runId) return;
        const batch = await getBenchmarkRunLogs(keycloak, runId, logOffsetRef.current, 200);
        if (Array.isArray(batch.items) && batch.items.length > 0) {
          const newOnes = batch.items.filter(it => {
            if (!it || typeof it.index !== 'number') return true;
            if (seenIndexRef.current.has(it.index)) return false;
            seenIndexRef.current.add(it.index);
            return true;
          });
          if (newOnes.length > 0) {
            setLogItems(prev => [...prev, ...newOnes]);
          }
          logOffsetRef.current = batch.next_offset;
        }
        // also refresh run status/score
        const latestRun = await getBenchmarkRun(keycloak, runId);
        setActiveRun(latestRun);
        if (latestRun.status && (latestRun.status.startsWith('error') || latestRun.status === 'completed' || latestRun.status === 'cancelled')) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        console.error('Polling logs failed', e);
      }
    }, 2000);
  }, [keycloak]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const runColumns = [
    { title: 'Run ID', dataIndex: 'id', key: 'id' },
    { title: 'Model', dataIndex: 'model', key: 'model' },
    { title: 'Dataset', dataIndex: 'dataset', key: 'dataset' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => {
      const color = s === 'completed' ? 'green' : s === 'queued' ? 'blue' : s === 'running' ? 'gold' : s === 'cancelled' ? 'volcano' : 'default';
      return <Tag color={color}>{s}</Tag>;
    } },
    { title: 'Score', dataIndex: 'score', key: 'score', render: (v) => v == null ? '-' : v },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? new Date(v).toLocaleString() : '-' },
    { title: 'Actions', key: 'actions', render: (_, rec) => (
      <Button onClick={async () => { 
        setActiveRun(rec); 
        setLogItems([]); 
        logOffsetRef.current = 0; 
        seenIndexRef.current = new Set();
        startPollingLogs(rec.id); 
      }}>View</Button>
    ) },
  ];

  const correctCount = logItems.filter(it => it.correct === true).length;
  const wrongCount = logItems.filter(it => it.correct === false).length;
  const totalCount = logItems.length > 0 ? logItems[logItems.length - 1].total : 0;
  const currentIndex = logItems.length > 0 ? logItems[logItems.length - 1].index : 0;
  const liveScore = logItems.length > 0 ? logItems[logItems.length - 1].score : (activeRun?.score ?? 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-header-title">Benchmarking</h2>
        <span className="page-header-subtitle">Run and compare model performance on datasets</span>
      </div>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>

        {activeRun && (
          <Card title={
            <Space>
              <span>Live Run</span>
              <Tag color="blue">{activeRun.id}</Tag>
              <Tag>{activeRun.model}</Tag>
              <Tag>{activeRun.dataset}</Tag>
              <Tag color={activeRun.status === 'completed' ? 'green' : activeRun.status === 'running' ? 'gold' : 'blue'}>{activeRun.status}</Tag>
            </Space>
          }
          extra={
            (activeRun.status === 'running' || activeRun.status === 'queued') && (
              <Button danger onClick={async () => {
                try {
                  // immediate UI feedback
                  setActiveRun(prev => prev ? { ...prev, status: 'cancelling' } : prev);
                  await cancelBenchmarkRun(keycloak, activeRun.id);
                  message.info('Cancelling run...');
                } catch (e) {
                  console.error(e);
                  message.error('Failed to cancel run');
                }
              }}>Stop</Button>
            )
          }
          >
            <Space size={16} wrap>
              <Badge color='green' text={`Right: ${correctCount}`} />
              <Badge color='red' text={`Wrong: ${wrongCount}`} />
              <Badge color='blue' text={`Progress: ${currentIndex}/${totalCount || '-'}`} />
              <Badge color='purple' text={`Score: ${liveScore}%`} />
            </Space>
            {(activeRun.status === 'cancelling' || activeRun.status === 'cancelled') && (
              <>
                <Divider />
                <Alert type={activeRun.status === 'cancelled' ? 'warning' : 'info'} showIcon message={activeRun.status === 'cancelled' ? 'Run cancelled' : 'Cancelling run...'} />
              </>
            )}
            <Divider />
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {[...logItems].slice().reverse().map((it) => {
                const color = it.correct === true ? '#e6fffb' : it.correct === false ? '#fff1f0' : '#f5f5f5';
                const border = it.correct === true ? '#87e8de' : it.correct === false ? '#ffa39e' : '#d9d9d9';
                return (
                  <div key={it.index} style={{ padding: 12, marginBottom: 12, background: color, border: `1px solid ${border}`, borderRadius: 8 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>Q{it.index}: {it.question}</Text>
                      <div>
                        <Text type="secondary">Options:</Text>
                        <div>
                          {(it.options || []).map((opt, idx) => (
                            <Tag key={idx}>{String.fromCharCode(65 + idx)}. {opt}</Tag>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Text strong>Model answer:</Text>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{it.model_output}</div>
                      </div>
                      <Space>
                        <Tag color="processing">Prediction: {it.pred ?? '-'}</Tag>
                        <Tag color="default">Answer: {it.gold ?? '-'}</Tag>
                        {it.correct === true && <Tag color="green">Correct</Tag>}
                        {it.correct === false && <Tag color="red">Wrong</Tag>}
                      </Space>
                    </Space>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

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
