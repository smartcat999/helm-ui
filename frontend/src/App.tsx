import React from 'react';
import Home from './pages/Home';
import { ConfigProvider } from 'antd';

const App: React.FC = () => {
  return (
    <ConfigProvider>
      <Home />
    </ConfigProvider>
  );
};

export default App;
