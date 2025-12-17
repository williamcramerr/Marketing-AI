import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputMode, ...props }, ref) => {
    // Automatically set appropriate inputMode based on type if not explicitly provided
    const defaultInputMode = !inputMode && type === 'email' ? 'email' : inputMode;
    const defaultInputModeForTel = !inputMode && type === 'tel' ? 'tel' : inputMode;
    const finalInputMode = defaultInputModeForTel || defaultInputMode;

    return (
      <input
        type={type}
        inputMode={finalInputMode}
        className={cn(
          'flex h-11 min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm touch-manipulation',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
