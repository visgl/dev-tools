import React from 'react';
// Note: this is internal API and may change in a future release
// https://github.com/facebook/docusaurus/discussions/7457
import {useDocsSidebar} from '@docusaurus/theme-common/internal';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styled from 'styled-components';
import {isMobile} from './common.js';

export const ExampleHeader = styled.div`
  font: bold 20px/28px var(--ifm-font-family-base);
  color: var(--ifm-color-gray-800);
  margin: 0 20px;
  border-bottom: 1px solid 20px;
  display: inline-block;
  padding: 20px 20px 4px 0;
`;

export const MainExamples = styled.main`
  padding: 16px 0;
`;

export const ExamplesGroup = styled.main`
  display: flex;
  flex-wrap: wrap;
  padding: 16px;
`;

export const ExampleCard = styled.a`
  cursor: pointer;
  text-decoration: none;
  width: 50%;
  max-width: 240px;
  line-height: 0;
  outline: none;
  padding: 4px;
  position: relative;
  img {
    transition-property: filter;
    transition-duration: var(--ifm-transition-slow);
    transition-timing-function: var(--ifm-transition-timing-default);
  }
  &:hover {
    box-shadow: var(--ifm-global-shadow-md);
  }
  &:hover img {
    filter: contrast(0.2);
  }
  ${isMobile} {
    width: 33%;
    min-width: 200px;
  }
  @media screen and (max-width: 632px) {
    width: 50%;
  }
`;

export const ExampleTitle = styled.div`
  position: absolute;
  display: flex;
  justify-content: center;
  flex-direction: column;
  color: var(--ifm-color-white);
  font-size: 1.5em;
  text-align: center;
  line-height: initial;
  width: 90%;
  height: 90%;
  top: 5%;
  left: 5%;
  border: solid 1px var(--ifm-color-white);
  opacity: 0;
  transition-property: opacity;
  transition-duration: var(--ifm-transition-slow);
  transition-timing-function: var(--ifm-transition-timing-default);
  &:hover {
    opacity: 1;
  }
`;

function renderItem(item, getThumbnail) {
  const imageUrl = useBaseUrl(getThumbnail(item));
  const {label, href} = item;

  return (
    <ExampleCard key={label} href={href}>
      <img width="100%" src={imageUrl} alt={label} />
      <ExampleTitle>
        <span>{label}</span>
      </ExampleTitle>
    </ExampleCard>
  );
}

function renderCategory({label, items}, getThumbnail) {
  return [
    <ExampleHeader key={`${label}-header`}>{label}</ExampleHeader>,
    <ExamplesGroup key={label}>{items.map((item) => renderItem(item, getThumbnail))}</ExamplesGroup>
  ];
}

export default function ExamplesIndex({getThumbnail}) {
  const sidebar = useDocsSidebar();

  const pages = sidebar.items.filter((item) => item.type !== 'category' && item.docId !== 'index');
  const categories = sidebar.items.filter((item) => item.type === 'category');

  return (
    <MainExamples>
      <ExamplesGroup>{pages.map((item) => renderItem(item, getThumbnail))}</ExamplesGroup>
      {categories.map((item) => renderCategory(item, getThumbnail))}
    </MainExamples>
  );
}
