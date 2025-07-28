import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Layout } from 'antd';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HeaderBar from './components/HeaderBar';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import Models from './pages/Models';
import AddModel from './pages/AddModel';
import Chat from './pages/Chat';

import './App.css';

const { Content } = Layout;

function App() {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!keycloak.authenticated) {
    keycloak.login();
    return <div>Redirecting to login...</div>;
  }

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout className="site-layout">
          <HeaderBar />
          <Content>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/models" element={<Models />} />
              <Route path="/models/add" element={<AddModel />} />
              <Route path="/chat/:assistantId" element={<Chat />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}


export default App;
