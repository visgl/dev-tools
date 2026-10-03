import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const capabilities = [
  {
    title: 'Build',
    description: 'Compile single-package repositories and monorepos with shared, predictable defaults.'
  },
  {
    title: 'Test',
    description: 'Run Node.js and browser test suites with Vitest and Playwright.'
  },
  {
    title: 'Lint',
    description: 'Format and lint JavaScript and TypeScript with the shared Biome configuration.'
  },
  {
    title: 'Publish',
    description: 'Bundle, measure, version, and publish packages using the project conventions.'
  }
];

export default function Home() {
  return (
    <Layout title="dev-tools" description="Shared development tools for vis.gl projects">
      <header className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>VIS.GL DEVELOPER INFRASTRUCTURE</p>
            <h1>dev-tools</h1>
            <p className={styles.tagline}>
              Shared tools for building, testing, linting, bundling, and publishing open source
              JavaScript frameworks.
            </p>
            <div className={styles.actions}>
              <Link className="button button--primary button--lg" to="/docs/dev-tools">
                Get started
              </Link>
              <Link className="button button--secondary button--lg" to="/docs">
                Explore the docs
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.section}>
          <div className="container">
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>ONE TOOLKIT, SHARED ACROSS PROJECTS</p>
              <h2>Build better libraries with less setup</h2>
              <p>
                dev-tools collects the build, test, and release workflows used across the vis.gl
                ecosystem into reusable commands and configurations.
              </p>
            </div>
            <div className="row">
              {capabilities.map(capability => (
                <div className="col col--3" key={capability.title}>
                  <article className={styles.card}>
                    <span className={styles.cardNumber}>0{capabilities.indexOf(capability) + 1}</span>
                    <h3>{capability.title}</h3>
                    <p>{capability.description}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionMuted}`}>
          <div className="container">
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>THE TOOLKIT</p>
              <h2>Packages for the vis.gl ecosystem</h2>
            </div>
            <div className="row">
              <div className="col col--4">
                <article className={styles.packageCard}>
                  <h3>@vis.gl/dev-tools</h3>
                  <p>Build, lint, test, bundle, measure, and publish JavaScript packages.</p>
                  <Link to="/docs/dev-tools">Read dev-tools docs →</Link>
                </article>
              </div>
              <div className="col col--4">
                <article className={styles.packageCard}>
                  <h3>@vis.gl/ts-plugins</h3>
                  <p>TypeScript transforms and compiler helpers for modern graphics projects.</p>
                  <Link to="/docs/ts-plugins/ts-transform-webgpu">Read TypeScript plugin docs →</Link>
                </article>
              </div>
              <div className="col col--4">
                <article className={styles.packageCard}>
                  <h3>@vis.gl/docusaurus-website</h3>
                  <p>Shared configuration and components for current vis.gl documentation sites.</p>
                  <Link to="/docs/docusaurus-website">Read website docs →</Link>
                </article>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
