'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  createExperiment,
  updateExperiment,
  type Experiment,
  type ExperimentVariant,
} from '@/lib/actions/experiments';
import { toast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
}

interface ExperimentFormProps {
  experiment?: Experiment;
  campaigns: Campaign[];
}

const metricOptions = [
  { value: 'conversion_rate', label: 'Conversion Rate' },
  { value: 'click_rate', label: 'Click-Through Rate' },
  { value: 'open_rate', label: 'Open Rate' },
  { value: 'engagement_rate', label: 'Engagement Rate' },
  { value: 'revenue_per_user', label: 'Revenue Per User' },
  { value: 'time_on_page', label: 'Time on Page' },
  { value: 'bounce_rate', label: 'Bounce Rate' },
];

function generateVariantId(): string {
  return `var_${Math.random().toString(36).substring(2, 9)}`;
}

export function ExperimentForm({ experiment, campaigns }: ExperimentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    campaign_id: experiment?.campaign_id || '',
    name: experiment?.name || '',
    hypothesis: experiment?.hypothesis || '',
    metric_name: experiment?.metric_name || 'conversion_rate',
    min_sample_size: experiment?.min_sample_size || 100,
    confidence_level: experiment?.confidence_level || 0.95,
  });

  const [variants, setVariants] = useState<ExperimentVariant[]>(
    experiment?.variants || [
      { id: generateVariantId(), name: 'Control', weight: 50 },
      { id: generateVariantId(), name: 'Variant A', weight: 50 },
    ]
  );

  function addVariant() {
    const newWeight = Math.floor(100 / (variants.length + 1));
    const updatedVariants = variants.map((v) => ({ ...v, weight: newWeight }));
    const remainder = 100 - newWeight * (variants.length + 1);

    setVariants([
      ...updatedVariants.map((v, i) => ({
        ...v,
        weight: i === 0 ? v.weight + remainder : v.weight,
      })),
      { id: generateVariantId(), name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`, weight: newWeight },
    ]);
  }

  function removeVariant(index: number) {
    if (variants.length <= 2) {
      toast({
        title: 'Minimum Variants',
        description: 'An experiment must have at least 2 variants.',
        variant: 'destructive',
      });
      return;
    }

    const newVariants = variants.filter((_, i) => i !== index);
    const totalWeight = newVariants.reduce((sum, v) => sum + v.weight, 0);
    const diff = 100 - totalWeight;

    if (diff !== 0 && newVariants.length > 0) {
      newVariants[0].weight += diff;
    }

    setVariants(newVariants);
  }

  function updateVariant(index: number, field: keyof ExperimentVariant, value: any) {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;
    setVariants(newVariants);
  }

  function balanceWeights() {
    const equalWeight = Math.floor(100 / variants.length);
    const remainder = 100 - equalWeight * variants.length;

    setVariants(
      variants.map((v, i) => ({
        ...v,
        weight: equalWeight + (i === 0 ? remainder : 0),
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.campaign_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a campaign',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an experiment name',
        variant: 'destructive',
      });
      return;
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      toast({
        title: 'Validation Error',
        description: `Variant weights must sum to 100% (currently ${totalWeight}%)`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let result;

      if (experiment) {
        result = await updateExperiment(experiment.id, {
          name: formData.name,
          hypothesis: formData.hypothesis || undefined,
          variants,
          metric_name: formData.metric_name,
          min_sample_size: formData.min_sample_size,
          confidence_level: formData.confidence_level,
        });
      } else {
        result = await createExperiment({
          campaign_id: formData.campaign_id,
          name: formData.name,
          hypothesis: formData.hypothesis || undefined,
          variants,
          metric_name: formData.metric_name,
          min_sample_size: formData.min_sample_size,
          confidence_level: formData.confidence_level,
        });
      }

      if (result.success) {
        toast({
          title: experiment ? 'Experiment Updated' : 'Experiment Created',
          description: experiment
            ? 'Your experiment has been updated.'
            : 'Your new experiment has been created.',
        });
        router.push('/dashboard/experiments');
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save experiment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Experiment Details</CardTitle>
          <CardDescription>Set up your A/B test configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Select
                value={formData.campaign_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, campaign_id: value }))
                }
                disabled={!!experiment}
              >
                <SelectTrigger id="campaign">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric">Success Metric</Label>
              <Select
                value={formData.metric_name}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, metric_name: value }))
                }
              >
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Experiment Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Homepage CTA Button Color Test"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hypothesis">Hypothesis (Optional)</Label>
            <Textarea
              id="hypothesis"
              value={formData.hypothesis}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, hypothesis: e.target.value }))
              }
              placeholder="e.g., Changing the CTA button color from blue to green will increase click-through rates by 15%"
              className="h-20"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sample_size">Minimum Sample Size</Label>
              <Input
                id="sample_size"
                type="number"
                min={10}
                value={formData.min_sample_size}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    min_sample_size: parseInt(e.target.value) || 100,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Per variant, before results are considered statistically significant
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Level</Label>
              <Select
                value={formData.confidence_level.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    confidence_level: parseFloat(value),
                  }))
                }
              >
                <SelectTrigger id="confidence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">90%</SelectItem>
                  <SelectItem value="0.95">95%</SelectItem>
                  <SelectItem value="0.99">99%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Variants</CardTitle>
              <CardDescription>
                Define the different versions you want to test (weights must sum to 100%)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={balanceWeights}>
                Balance Weights
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="mr-1 h-4 w-4" />
                Add Variant
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.id}
              className="flex items-start gap-4 rounded-lg border p-4"
            >
              <GripVertical className="mt-3 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Variant Name</Label>
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                      placeholder="e.g., Control"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Traffic Weight (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={variant.weight}
                      onChange={(e) =>
                        updateVariant(index, 'weight', parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeVariant(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    value={variant.description || ''}
                    onChange={(e) => updateVariant(index, 'description', e.target.value)}
                    placeholder="Describe what's different in this variant"
                  />
                </div>
              </div>
            </div>
          ))}

          <div
            className={`text-sm ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}
          >
            Total Weight: {totalWeight}%{' '}
            {totalWeight !== 100 && '(must equal 100%)'}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/experiments')}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? 'Saving...'
            : experiment
              ? 'Update Experiment'
              : 'Create Experiment'}
        </Button>
      </div>
    </form>
  );
}
