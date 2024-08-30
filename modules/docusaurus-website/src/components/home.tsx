import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styled from 'styled-components';
import {isMobile} from './common.js';

const Banner = styled.section`
  position: relative;
  height: 30rem;
  background: var(--ifm-color-gray-400);
  color: ${(props) =>
    props.theme === 'light' ? 'var(--ifm-color-gray-900)' : 'var(--ifm-color-gray-200)'};
  z-index: 0;
  ${isMobile} {
    height: 80vh;
  }
`;

const Container = styled.div`
  position: relative;
  padding: 2rem;
  max-width: 80rem;
  width: 100%;
  height: 100%;
  margin: 0;
`;

const BannerContainer = styled(Container)`
  position: absolute;
  bottom: 0;
  height: auto;
  padding-left: 4rem;
  z-index: 0;
  pointer-events: none;
`;

const HeroExampleContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
`;

// const Section = styled.section`
//   &:nth-child(2n + 1) {
//     background: var(--ifm-color-gray-300);
//   }
// `;

const ProjectName = styled.h1`
  font-size: 5em;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 4px;
  font-weight: 700;
  margin: 0;
  margin-bottom: 16px;
`;

const GetStartedLink = styled.a`
  pointer-events: all;
  font-size: 12px;
  line-height: 44px;
  letter-spacing: 2px;
  font-weight: bold;
  margin: 24px 0;
  padding: 0 4rem;
  display: inline-block;
  text-decoration: none;
  transition:
    background-color 250ms ease-in,
    color 250ms ease-in;
  border: solid 2px var(--ifm-color-primary);
  color: inherit;
  border-image: linear-gradient(
    to right,
    var(--ifm-color-gray-700) 0%,
    var(--ifm-color-gray-400) 100%
  );
  border-image-slice: 2;
  &:visited {
    color: inherit;
  }
  &:active {
    color: var(--ifm-color-white);
  }
  &:hover {
    color: var(--ifm-color-white);
    background-color: var(--ifm-color-primary);
  }
`;

export function Home({
  HeroExample,
  getStartedLink = './docs',
  theme = 'light'
}: {
  /** Component to render in the banner background */
  HeroExample?: () => React.ReactElement;

  /** Target URL of the "get started" button. If null, will hide the button.
   * @default './docs'
   */
  getStartedLink?: string | null;

  /** Color theme
   * @default 'light'
   */
  theme?: 'light' | 'dark';
}) {
  const {siteConfig} = useDocusaurusContext();

  // Note: The Layout "wrapper" component adds header and footer etc
  return (
    <Banner theme={theme}>
      <HeroExampleContainer>{HeroExample && <HeroExample />}</HeroExampleContainer>
      <BannerContainer>
        <ProjectName>{siteConfig.title}</ProjectName>
        <p>{siteConfig.tagline}</p>
        {getStartedLink && <GetStartedLink href={getStartedLink}>GET STARTED</GetStartedLink>}
      </BannerContainer>
    </Banner>
  );
}
