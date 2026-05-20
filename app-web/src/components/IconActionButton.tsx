import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { Loader2 } from 'lucide-react';

type IconActionButtonVariant = 'neutral' | 'emerald' | 'red' | 'sky';
type IconActionButtonStyle = 'ghost' | 'soft' | 'solid';

type IconActionButtonProps = ComponentPropsWithoutRef<'button'> & {
  icon: ElementType;
  label: string;
  variant?: IconActionButtonVariant;
  styleType?: IconActionButtonStyle;
  loading?: boolean;
};

const variantStyles: Record<IconActionButtonVariant, Record<IconActionButtonStyle, string>> = {
  neutral: {
    ghost: 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900',
    soft: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
    solid: 'border-transparent bg-gray-900 text-white hover:bg-gray-800',
  },
  emerald: {
    ghost: 'border-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
    soft: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
    solid: 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700',
  },
  red: {
    ghost: 'border-transparent text-red-500 hover:bg-red-50 hover:text-red-600',
    soft: 'border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100',
    solid: 'border-transparent bg-red-600 text-white hover:bg-red-700',
  },
  sky: {
    ghost: 'border-transparent text-sky-600 hover:bg-sky-50 hover:text-sky-700',
    soft: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100',
    solid: 'border-transparent bg-sky-600 text-white hover:bg-sky-700',
  },
};

export default function IconActionButton({
  icon: Icon,
  label,
  variant = 'neutral',
  styleType = 'ghost',
  loading = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}: IconActionButtonProps) {
  const classes = [
    'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    variantStyles[variant][styleType],
    variant === 'emerald' ? 'focus:ring-emerald-500' : '',
    variant === 'red' ? 'focus:ring-red-500' : '',
    variant === 'sky' ? 'focus:ring-sky-500' : '',
    variant === 'neutral' ? 'focus:ring-gray-400' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    </button>
  );
}