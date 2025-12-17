import uehLogo from '@/assets/ueh-logo.png';

interface UEHLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function UEHLogo({ className = '', width = 120, height = 40 }: UEHLogoProps) {
  return (
    <img
      src={uehLogo}
      alt="UEH Logo"
      className={className}
      style={{ width, height: 'auto' }}
    />
  );
}
