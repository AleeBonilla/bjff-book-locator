import brandImage from '../assets/brand-main.png';

interface BrandProps {
  readonly light?: boolean;
}

export function Brand({ light = false }: BrandProps) {
  return (
    <span className={light ? 'brand brand--light' : 'brand'}>
      <img src={brandImage} alt="BJFF Book Locator" />
    </span>
  );
}
