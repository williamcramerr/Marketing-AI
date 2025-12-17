'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  advanceOnboardingStep,
  skipOnboardingStep,
  createOnboardingCampaign,
  getFirstProduct,
} from '@/lib/actions/onboarding';
import { Rocket, ArrowRight, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

const goals = [
  { value: 'awareness', label: 'Brand Awareness', description: 'Increase visibility and reach' },
  { value: 'leads', label: 'Lead Generation', description: 'Capture potential customer information' },
  { value: 'engagement', label: 'Engagement', description: 'Boost interactions and community' },
  { value: 'traffic', label: 'Website Traffic', description: 'Drive visitors to your website' },
  { value: 'sales', label: 'Sales', description: 'Direct conversion and purchases' },
];

const channels = [
  { id: 'blog', label: 'Blog Posts' },
  { id: 'email', label: 'Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'Twitter/X' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];

export default function CampaignPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      const result = await getFirstProduct();
      if (result.success && result.data) {
        setProductId(result.data.id);
      }
    }
    loadProduct();
  }, []);

  function toggleChannel(channelId: string) {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a campaign name');
      return;
    }

    if (!goal) {
      setError('Please select a campaign goal');
      return;
    }

    if (!productId) {
      setError('No product found. Please go back and create a product first.');
      return;
    }

    setIsLoading(true);
    try {
      // Create campaign
      const createResult = await createOnboardingCampaign(
        productId,
        name.trim(),
        goal,
        selectedChannels
      );

      if (!createResult.success) {
        setError(createResult.error || 'Failed to create campaign');
        return;
      }

      // Advance to next step
      const advanceResult = await advanceOnboardingStep('campaign', {
        campaignName: name.trim(),
        campaignId: createResult.data?.campaignId,
        goal,
        channels: selectedChannels,
      });

      if (advanceResult.success && advanceResult.nextStep) {
        router.push(`/onboarding/${advanceResult.nextStep}`);
      } else {
        setError(advanceResult.error || 'Failed to advance to next step');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await skipOnboardingStep('campaign');

      if (result.success && result.nextStep) {
        router.push(`/onboarding/${result.nextStep}`);
      } else {
        setError(result.error || 'Failed to skip step');
      }
    } catch (error) {
      console.error('Error skipping step:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create Your First Campaign</CardTitle>
        <CardDescription className="text-base mt-2">
          Set up a marketing campaign to start generating content. You can skip this and create campaigns later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Q1 Product Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Campaign Goal *</Label>
            <Select value={goal} onValueChange={setGoal} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a goal" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    <div className="flex flex-col">
                      <span>{g.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {g.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Channels (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  type="button"
                  variant={selectedChannels.includes(channel.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleChannel(channel.id)}
                  disabled={isLoading}
                  className={cn(
                    'transition-colors',
                    selectedChannels.includes(channel.id) && 'bg-primary text-primary-foreground'
                  )}
                >
                  {channel.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select the channels where you want to publish content.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="min-w-[200px]"
          >
            {isLoading ? 'Creating...' : 'Create Campaign'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isLoading}
          >
            Skip for now
            <SkipForward className="ml-2 h-3 w-3" />
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
