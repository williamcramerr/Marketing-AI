'use client';

import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ToneSettings } from '@/lib/actions/brand-voice';

interface ToneSelectorProps {
  value: ToneSettings;
  onChange: (value: ToneSettings) => void;
  disabled?: boolean;
}

interface ToneSliderProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function ToneSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  disabled,
}: ToneSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">{value}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-24 text-right text-xs text-muted-foreground">{leftLabel}</span>
        <Slider
          value={[value]}
          onValueChange={([val]) => onChange(val)}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          className="flex-1"
        />
        <span className="w-24 text-xs text-muted-foreground">{rightLabel}</span>
      </div>
    </div>
  );
}

export function ToneSelector({ value, onChange, disabled }: ToneSelectorProps) {
  const handleChange = (key: keyof ToneSettings, newValue: number) => {
    onChange({
      ...value,
      [key]: newValue,
    });
  };

  return (
    <div className="space-y-6">
      <ToneSlider
        label="Formality"
        leftLabel="Casual"
        rightLabel="Formal"
        value={value.formality}
        onChange={(v) => handleChange('formality', v)}
        disabled={disabled}
      />

      <ToneSlider
        label="Friendliness"
        leftLabel="Professional"
        rightLabel="Friendly"
        value={value.friendliness}
        onChange={(v) => handleChange('friendliness', v)}
        disabled={disabled}
      />

      <ToneSlider
        label="Humor"
        leftLabel="Serious"
        rightLabel="Playful"
        value={value.humor}
        onChange={(v) => handleChange('humor', v)}
        disabled={disabled}
      />

      <ToneSlider
        label="Confidence"
        leftLabel="Humble"
        rightLabel="Assertive"
        value={value.confidence}
        onChange={(v) => handleChange('confidence', v)}
        disabled={disabled}
      />

      <ToneSlider
        label="Enthusiasm"
        leftLabel="Calm"
        rightLabel="Energetic"
        value={value.enthusiasm}
        onChange={(v) => handleChange('enthusiasm', v)}
        disabled={disabled}
      />
    </div>
  );
}

// Visual representation of the current tone
export function ToneVisualizer({ tone }: { tone: ToneSettings }) {
  const getColor = (value: number) => {
    if (value < 33) return 'bg-blue-500';
    if (value < 66) return 'bg-purple-500';
    return 'bg-pink-500';
  };

  const getDescription = (tone: ToneSettings): string => {
    const traits: string[] = [];

    if (tone.formality > 60) traits.push('formal');
    else if (tone.formality < 40) traits.push('casual');

    if (tone.friendliness > 60) traits.push('friendly');
    else if (tone.friendliness < 40) traits.push('professional');

    if (tone.humor > 60) traits.push('witty');
    else if (tone.humor < 40) traits.push('serious');

    if (tone.confidence > 60) traits.push('confident');
    if (tone.enthusiasm > 60) traits.push('enthusiastic');

    return traits.length > 0 ? traits.join(', ') : 'balanced';
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Voice Profile</span>
        <span className="text-xs capitalize text-muted-foreground">{getDescription(tone)}</span>
      </div>
      <div className="flex gap-1">
        {Object.entries(tone).map(([key, value]) => (
          <div
            key={key}
            className="flex-1"
            title={`${key}: ${value}%`}
          >
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                getColor(value)
              )}
              style={{ opacity: 0.3 + (value / 100) * 0.7 }}
            />
            <p className="mt-1 text-center text-[10px] text-muted-foreground capitalize">
              {key.slice(0, 3)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
