import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Layout } from 'antd';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HeaderBar from './components/HeaderBar';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import CreateUser from './pages/CreateUser';
import CreateGroup from './pages/CreateGroup';
import UserProfile from './pages/UserProfile';
import Chat from './pages/Chat';

import './App.css';
import Assistants from './pages/Assistants';
import AddAssistant from './pages/AddAssistant'
import Benchmarking from './pages/Benchmarking';
import DataCollections from "./pages/DataCollections";
import Integration from "./pages/Integration";

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
              <Route path="/users/create" element={<CreateUser />} />
              <Route path="/users/:userId/profile" element={<UserProfile />} />
              <Route path="/groups/create" element={<CreateGroup />} />
              <Route path="/collections" element={<DataCollections />} />
              <Route path="/assistants" element={<Assistants />} />
              <Route path="/assistants/add" element={<AddAssistant />} />
              <Route path="/benchmarking" element={<Benchmarking />} />
              <Route path="/integration" element={<Integration />} />
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
