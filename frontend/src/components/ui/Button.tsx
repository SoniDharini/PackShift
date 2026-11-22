import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

function styles(variant: Variant, size: Size, fullWidth?: boolean) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium motion-safe:transition motion-safe:active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-deep disabled:pointer-events-none disabled:opacity-45',
    size === 'sm' && 'h-9 px-3 text-sm',
    size === 'md' && 'h-11 px-4 text-sm',
    size === 'lg' && 'h-12 px-5 text-base',
    fullWidth && 'w-full',
    variant === 'primary' && 'bg-forest text-white hover:bg-[#1C3A32]',
    variant === 'accent' && 'bg-emerald-deep text-white hover:bg-[#0F5A46]',
    variant === 'secondary' && 'border border-line bg-white text-forest hover:border-[#C5D1CA]',
    variant === 'ghost' && 'bg-transparent text-forest hover:bg-white',
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button({ variant = 'primary', size = 'md', fullWidth, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(styles(variant, size, fullWidth), className)} {...props} />
}

export function ButtonLink({
  to,
  children,
  variant = 'primary',
  size = 'md',
  className,
}: {
  to: string
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
}) {
  return (
    <Link to={to} className={cn(styles(variant, size), className)}>
      {children}
    </Link>
  )
}
