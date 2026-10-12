
'use client';

import { ConfigProvider, theme } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { ReactNode } from 'react';
import globalConfig from '@/config/global.config.json';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const { token, components } = globalConfig.theme;

  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token,
          components,
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
