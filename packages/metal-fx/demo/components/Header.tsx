import React from 'react';
import type { Theme } from '../hooks/useTheme';
import { GitHubIcon, XIcon } from './icons';

const iconBtnClass = 'flex items-center justify-center size-9 border-none rounded-full bg-(--icon-btn-bg) text-inherit cursor-pointer no-underline transition-[background-color] duration-200 [-webkit-tap-highlight-color:transparent] hover:bg-(--icon-btn-hover) focus-visible:outline-2 focus-visible:outline-(--icon-btn-outline) focus-visible:outline-offset-2 [&_svg]:block [&_svg]:shrink-0 [&_svg]:fill-(--icon-btn-fill) [&_svg]:opacity-60 [&_svg]:transition-opacity [&_svg]:duration-200 hover:[&_svg]:opacity-100';

export function Header({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="relative w-full h-[218px] text-center flex flex-col items-center justify-end pb-[53px] max-sm:h-auto max-sm:min-h-[180px] max-sm:pt-[60px] max-sm:pb-8">
      <nav className="absolute top-4 right-0 flex items-center gap-4 max-sm:top-3" aria-label="External links">
        <a className={iconBtnClass} href="https://github.com/Jakubantalik/metal-fx" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository">
          <GitHubIcon />
        </a>
        <a className={iconBtnClass} href="https://x.com/jakubantalik" target="_blank" rel="noopener noreferrer" aria-label="Follow on X (Twitter)">
          <XIcon />
        </a>
      </nav>
      <div className="relative -mt-[190px] -mb-5 cursor-pointer group" aria-hidden="true">
        <img
          className="block relative transition-[filter,transform] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[filter,transform] motion-reduce:!transition-none group-hover:[filter:hue-rotate(45deg)_brightness(1.1)] group-hover:[transform:rotate(8deg)_scale(1.06)]"
          src={theme === 'dark' ? '/header.png' : '/header-light.png'}
          alt=""
          width="207"
          height="138"
          decoding="async"
        />
      </div>
      <h1 className="text-[22px] font-medium leading-[30px] text-(--title-color)">Liquid metal</h1>
      <p className="text-sm font-normal leading-[21px] text-(--subtitle-color) opacity-50">Animated liquid metal border component</p>
    </header>
  );
}
