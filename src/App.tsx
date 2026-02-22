import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TokenManagement from './pages/TokenManagement';
import ApiKeyManagement from './pages/ApiKeyManagement';
import ModelManagement from './pages/ModelManagement';
import ModelTest from './pages/ModelTest';
import Statistics from './pages/Statistics';
import SystemSettings from './pages/SystemSettings';
import ApiDocumentation from './pages/ApiDocumentation';

function App() {
  const { isAuthenticated, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="tokens" element={<TokenManagement />} />
            <Route path="api-keys" element={<ApiKeyManagement />} />
            <Route path="models" element={<ModelManagement />} />
            <Route path="model-test" element={<ModelTest />} />
            <Route path="stats" element={<Statistics />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="api-docs" element={<ApiDocumentation />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
