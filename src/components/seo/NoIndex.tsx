import { Helmet } from 'react-helmet';
import type { ReactNode } from 'react';

type NoIndexProps = {
  children: ReactNode;
};

export default function NoIndex({ children }: NoIndexProps) {
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="googlebot" content="noindex, nofollow, noarchive" />
      </Helmet>
      {children}
    </>
  );
}
