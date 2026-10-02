import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function Home() {
  return (
    <Layout title="vis.gl development tools" description="Shared development tools for vis.gl projects">
      <main className="container margin-vert--lg">
        <h1>vis.gl development tools</h1>
        <p>Shared tools for building, testing, linting, bundling, and publishing vis.gl projects.</p>
        <Link className="button button--primary" to="/docs">Read the documentation</Link>
      </main>
    </Layout>
  );
}
