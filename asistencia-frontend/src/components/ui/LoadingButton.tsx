import type { ButtonHTMLAttributes, ReactNode } from 'react'

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'dark'
  children: ReactNode
}

const variantClasses = {
  primary: 'bg-brand-blue text-white hover:brightness-95',
  secondary: 'bg-brand-orange text-white hover:brightness-95',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dark: 'bg-slate-950 text-white hover:bg-slate-800',
}

export function LoadingButton({
  loading = false,
  loadingText,
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      <span>{loading ? loadingText ?? children : children}</span>
    </button>
  )
}
