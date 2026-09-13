import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--sonavi-control-radius)] text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sonavi-accent)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--sonavi-accent)] text-white hover:bg-[var(--sonavi-accent-hover)]',
        outline:
          'border border-[var(--sonavi-border)] bg-[var(--sonavi-raised)] text-[var(--sonavi-ink)] hover:border-[var(--sonavi-accent)]',
        ghost:
          'text-[var(--sonavi-text-secondary)] hover:bg-black/5 hover:text-[var(--sonavi-ink)]'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'size-10',
        'icon-sm': 'size-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
